import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SKILL_KEYS = ["anatomy", "pose", "line", "color", "light", "detail"] as const;

const Input = z.object({
  mode: z.enum(["review", "task", "chat"]),
  message: z.string().max(4000).default(""),
  image: z.string().max(6_000_000).optional(),
  skills: z.record(z.string(), z.number()),
  streak: z.number(),
  apiKey: z.string().max(200).optional(),
  recent: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).max(12),
});

const SYSTEM = `Jesteś ATELIER OS — profesjonalny, ciepły, ale wymagający mentor rysunku cyfrowego (tablet graficzny, styl stylizowany/anime/alt-aesthetic).
Odpowiadasz ZAWSZE po polsku, w ładnym markdownie stylizowanym na menu aplikacji (nagłówki z emoji, pogrubienia, krótkie listy, sekcje typu "MODUŁ"). Bez lania wody.
Umiejętności (skala 1-100): anatomy=Anatomia i proporcje, pose=Poza ruch i gest, line=Linia i cleanup, color=Kolor i klimat, light=Światłocień i bryła, detail=Detal ubiór i styl.
SKALA (absolutna, bezlitośnie uczciwa): 0 = jeszcze nieoceniane. 1-15 = początkujący, 16-30 = amator uczący się podstaw, 31-45 = ambitny hobbysta, 46-60 = solidny, pewny warsztat, 61-75 = poziom półprofesjonalny/portfolio, 76-88 = profesjonalista branżowy, 89-97 = światowa czołówka, 98-100 = totalna perfekcja (praktycznie nieosiągalne).
Jeśli pasek wynosi 0, ustaw go wprost według skali na podstawie pracy. Jeśli praca nie pokazuje danej umiejętności (np. brak koloru), zostaw obecną wartość. Gdy pasek ma już wartość, zmieniaj ją ostrożnie: zwykle -2..+3 na pracę, więcej tylko przy wyraźnym skoku jakości. Im wyżej, tym trudniej o punkt. Zwracaj WYŁĄCZNIE json o kształcie:
{"reply": string (markdown), "skills": {anatomy,pose,line,color,light,detail: number} | null, "task": {"title": string, "minutes": number, "steps": string[], "focus": string} | null}
- mode=review: oceń pracę, podaj mocne strony, 2-3 rzeczy do poprawy, zaktualizowane skills. task może być null.
- mode=task: daj zadanie dnia celujące w najsłabsze paski, skills=null.
- mode=chat: rozmowa/pomysły/systemy; skills i task zwykle null.`;

export const askAtelier = createServerFn({ method: "POST" })
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data }) => {
    const own = data.apiKey?.trim();
    const key = own || process.env["LOVABLE_API_KEY"];
    if (!key) return { error: "Brak klucza AI — dodaj klucz Gemini w Ustawieniach." };
    const url = own ? "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions" : "https://ai.gateway.lovable.dev/v1/chat/completions";
    const model = own ? "gemini-2.5-flash" : "google/gemini-3.8-flash";
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
      const t = await res.text();
      if (res.status === 429) return { error: "Za dużo zapytań — spróbuj za chwilę." };
      if (own && (res.status === 400 || res.status === 401 || res.status === 403)) return { error: "Twój klucz Gemini został odrzucony — sprawdź go w Ustawieniach." };
      if (res.status === 402) return { error: "Skończyły się kredyty AI w workspace." };
      return { error: `Błąd AI (${res.status}): ${t.slice(0, 200)}` };
    }
    const json = await res.json();
    const raw: string = json.choices?.[0]?.message?.content ?? "";
    try {
      const cleaned = raw.replace(/^```json\s*|```$/g, "").trim();
      const p = JSON.parse(cleaned);
      let skills: Record<string, number> | null = null;
      if (p.skills && typeof p.skills === "object") {
        skills = {};
        for (const k of SKILL_KEYS) {
          const v = Number(p.skills[k]);
          skills[k] = Number.isFinite(v) ? Math.max(1, Math.min(100, Math.round(v))) : (data.skills[k] ?? 0);
        }
      }
      return { reply: String(p.reply ?? ""), skills, task: p.task ?? null };
    } catch {
      return { reply: raw, skills: null, task: null };
    }
  });
