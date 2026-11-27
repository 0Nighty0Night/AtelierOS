import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assessSkills, type Skills } from "./atelier-scoring";
import { taskSchema } from "./atelier";

// Every user talks directly to Google AI Studio using their own Gemini API key stored in user_ai_keys.
// gemini-2.0-flash and gemini-2.5-flash are retired by Google (HTTP 404); gemini-3.8-flash is often 503 there.
export const OWN_MODEL_ID = "gemini-3.6-flash";

const Input = z.object({
  mode: z.enum(["review", "task", "chat"]),
  message: z.string().max(4000).default(""),
  image: z.string().max(6_000_000).regex(/^data:image\/(jpeg|png|webp);base64,/).optional(),
  skills: z.record(z.string(), z.number()),
  streak: z.number(),
  recent: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).max(12),
});

const SYSTEM = `Jesteś ATELIER OS — profesjonalny, ciepły, ale wymagający mentor rysunku cyfrowego (tablet graficzny, styl stylizowany/anime/alt-aesthetic).
Odpowiadasz ZAWSZE po polsku, w ładnym markdownie stylizowanym na menu aplikacji (nagłówki z emoji, pogrubienia, krótkie listy, sekcje typu "MODUŁ"). Bez lania wody.
Umiejętności (skala 1-100): anatomy=Anatomia i proporcje, pose=Poza ruch i gest, line=Linia i cleanup, color=Kolor i klimat, light=Światłocień i bryła, detail=Detal ubiór i styl.
SKALA (absolutna, wyważona i uczciwa): 0 = jeszcze nieoceniane. 1-15 = początkujący, 16-30 = amator uczący się podstaw, 31-45 = ambitny hobbysta, 46-60 = solidny, pewny warsztat, 61-75 = poziom półprofesjonalny/portfolio, 76-88 = profesjonalista branżowy, 89-97 = światowa czołówka, 98-99 = niemal perfekcyjne opanowanie, 100 = totalna perfekcja w danym zakresie (punkt docelowy, nie przyznawaj za samą aktywność).
Jeśli pasek wynosi 0, ustaw go wprost według skali na podstawie pracy. Jeśli praca nie pokazuje danej umiejętności (np. brak koloru), zostaw obecną wartość. Każdy wynik musi odzwierciedlać jakość rysunku, a nie liczbę przesłań. Nie dodawaj automatycznych punktów za przesłanie, serię dni, prośbę użytkownika ani wykonanie zadania. Ten sam poziom pracy powinien dawać podobny wynik. Pierwsza ocena może być od razu wysoka, jeśli warsztat na to zasługuje. Po kolejnych pracach uwzględnij wcześniejszy poziom i faktyczne dowody poprawy; dopuszczaj spadki. Jeżeli kryterium nie jest widoczne, zwróć null dla tego kryterium. Uwzględniaj WIP, szkic, stylizację i użycie kukły bez karania za sam wybór stylu; nie przypisuj autorowi konstrukcji dostarczonej przez podkład. Wyjaśnij wyniki konkretnie i motywująco. Zwracaj WYŁĄCZNIE json o kształcie:
{"reply": string (markdown), "skills": {anatomy,pose,line,color,light,detail: number} | null, "task": {"title": string, "minutes": number, "steps": string[], "focus": string} | null}
- mode=review: oceń pracę, podaj mocne strony, 2-3 rzeczy do poprawy, zaktualizowane skills. task może być null.
- mode=task: daj zadanie dnia celujące w najsłabsze paski, skills=null.
- mode=chat: rozmowa/pomysły/systemy; skills i task zwykle null.`;

export const askAtelier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data, context }) => {
    if (data.mode === "review" && !data.image) return { error: "Dodaj rysunek do oceny. Same wiadomości nie zmieniają pasków." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: keyRow } = await supabaseAdmin
      .from("user_ai_keys")
      .select("gemini_key")
      .eq("user_id", context.userId)
      .maybeSingle();
    const key = keyRow?.gemini_key?.trim();
    if (!key) return { error: "Brak klucza Gemini API. Dodaj swój klucz w Profilu artysty, aby korzystać z Mentora." };
    const url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    const model = OWN_MODEL_ID;
    const ctx = `Kontekst: mode=${data.mode}, obecne paski=${JSON.stringify(data.skills)}, seria dni=${data.streak}, data=${new Date().toISOString().slice(0, 10)}.`;
    const userContent: unknown[] = [{ type: "text", text: `${ctx}\n\n${data.message || "(brak opisu)"}` }];
    if (data.image) userContent.push({ type: "image_url", image_url: { url: data.image } });
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          ...data.recent.map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: userContent },
        ],
      }),
    });
    if (!res.ok) {
      const body: unknown = await res.json().catch(() => null);
      const parsed = z.object({ error: z.object({ message: z.string().optional() }).optional(), message: z.string().optional() }).safeParse(body);
      const reason = parsed.success ? (parsed.data.error?.message ?? parsed.data.message ?? "") : "";
      const safeReason = reason.replaceAll(key, "[ukryte]");
      if (res.status === 429) return { error: "Za dużo zapytań — spróbuj za chwilę." };
      if (res.status === 402) return { error: safeReason || "Brak kredytów AI. Sprawdź saldo workspace." };
      return { error: `Błąd AI (${res.status}): ${safeReason || "Nie udało się uzyskać odpowiedzi."}` };
    }
    const json = await res.json();
    const raw: string = json.choices?.[0]?.message?.content ?? "";
    try {
      const cleaned = raw.replace(/^```json\s*|```$/g, "").trim();
      const p = JSON.parse(cleaned);
      const reply = z.string().min(1).parse(p.reply);
      const skills = assessSkills(data.skills as Skills, p.skills, data.mode, Boolean(data.image));
      const taskResult = taskSchema.safeParse(p.task);
      return { reply, skills, task: taskResult.success ? taskResult.data : null };
    } catch {
      return { error: "Mentor nie zwrócił poprawnej oceny. Paski nie zostały zmienione." };
    }
  });
