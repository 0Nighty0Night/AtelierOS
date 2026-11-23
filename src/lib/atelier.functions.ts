import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SKILL_KEYS = ["anatomy", "pose", "line", "color", "light", "detail"] as const;

const Input = z.object({
  mode: z.enum(["review", "task", "chat"]),
  message: z.string().max(4000).default(""),
  image: z.string().max(6_000_000).optional(),
  skills: z.record(z.string(), z.number()),
  streak: z.number(),
  recent: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).max(12),
});

const SYSTEM = `Jesteś ATELIER OS — profesjonalny, ciepły, ale wymagający mentor rysunku cyfrowego (tablet graficzny, styl stylizowany/anime/alt-aesthetic).
Odpowiadasz ZAWSZE po polsku, w ładnym markdownie stylizowanym na menu aplikacji (nagłówki z emoji, pogrubienia, krótkie listy, sekcje typu "MODUŁ"). Bez lania wody.
Umiejętności (skala 1-100): anatomy=Anatomia i proporcje, pose=Poza ruch i gest, line=Linia i cleanup, color=Kolor i klimat, light=Światłocień i bryła, detail=Detal ubiór i styl.
Zmieniaj oceny ostrożnie (zwykle -3..+5 na pracę), uczciwie, na podstawie tego co widzisz. Zwracaj WYŁĄCZNIE json o kształcie:
{"reply": string (markdown), "skills": {anatomy,pose,line,color,light,detail: number} | null, "task": {"title": string, "minutes": number, "steps": string[], "focus": string} | null}
- mode=review: oceń pracę, podaj mocne strony, 2-3 rzeczy do poprawy, zaktualizowane skills. task może być null.
- mode=task: daj zadanie dnia celujące w najsłabsze paski, skills=null.
- mode=chat: rozmowa/pomysły/systemy; skills i task zwykle null.`;

export const askAtelier = createServerFn({ method: "POST" })
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { error: "Brak klucza AI na serwerze." };
    const ctx = `Kontekst: mode=${data.mode}, obecne paski=${JSON.stringify(data.skills)}, seria dni=${data.streak}, data=${new Date().toISOString().slice(0, 10)}.`;
    const userContent: unknown[] = [{ type: "text", text: `${ctx}\n\n${data.message || "(brak opisu)"}` }];
    if (data.image) userContent.push({ type: "image_url", image_url: { url: data.image } });
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
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
          skills[k] = Number.isFinite(v) ? Math.max(1, Math.min(100, Math.round(v))) : (data.skills[k] ?? 30);
        }
      }
      return { reply: String(p.reply ?? ""), skills, task: p.task ?? null };
    } catch {
      return { reply: raw, skills: null, task: null };
    }
  });
