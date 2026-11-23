export const SKILLS = [
  { key: "anatomy", label: "Anatomia i proporcje" },
  { key: "pose", label: "Poza, ruch i gest" },
  { key: "line", label: "Linia i cleanup" },
  { key: "color", label: "Kolor i klimat" },
  { key: "light", label: "Światłocień i bryła" },
  { key: "detail", label: "Detal, ubiór i styl" },
] as const;
export type SkillKey = (typeof SKILLS)[number]["key"];
export type Skills = Record<SkillKey, number>;
export type Task = { title: string; minutes: number; steps: string[]; focus: string; date: string; done?: boolean };
export type Msg = { role: "user" | "assistant"; content: string; image?: string | undefined; at: number };
export type State = {
  skills: Skills;
  history: { date: string; skills: Skills }[];
  task: Task | null;
  doneDays: string[];
  messages: Msg[];
  gallery: { image: string; date: string; note: string }[];
  theme: string;
  apiKey: string;
};
const iso = (d: Date) => d.toLocaleDateString("sv-SE");
export const today = () => iso(new Date());
export const initialState = (): State => {
  const skills: Skills = { anatomy: 0, pose: 0, line: 0, color: 0, light: 0, detail: 0 };
  return { skills, history: [{ date: today(), skills }], task: null, doneDays: [], messages: [], gallery: [], theme: "atrament", apiKey: "" };
};
const KEY = "atelieros-v2";
export function load(): State {
  try { const s = localStorage.getItem(KEY); if (s) return { ...initialState(), ...JSON.parse(s) }; } catch { /* ignore */ }
  return initialState();
}
export function save(s: State) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); }
  catch { localStorage.setItem(KEY, JSON.stringify({ ...s, gallery: s.gallery.slice(-3), messages: s.messages.slice(-20).map(({ image: _i, ...m }) => m) })); }
}
export function streak(days: string[]): number {
  const set = new Set(days); let n = 0; const d = new Date();
  if (!set.has(today())) d.setDate(d.getDate() - 1);
  while (set.has(iso(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
export function rank(avg: number) {
  if (avg === 0) return "Nieoceniony";
  if (avg < 16) return "Nowicjusz"; if (avg < 31) return "Szkicownik"; if (avg < 46) return "Czeladnik";
  if (avg < 61) return "Rzemieślnik"; if (avg < 76) return "Ilustrator"; if (avg < 89) return "Profesjonalista";
  if (avg < 98) return "Mistrz"; return "Perfekcja";
  if (avg < 25) return "Szkicownik"; if (avg < 45) return "Czeladnik"; if (avg < 65) return "Rzemieślnik";
  if (avg < 85) return "Artysta"; return "Mistrz Atelier";
}
export async function compressImage(file: File, max = 1280): Promise<string> {
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((ok, err) => { const i = new Image(); i.onload = () => ok(i); i.onerror = err; i.src = url; });
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas"); c.width = img.width * scale; c.height = img.height * scale;
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  return c.toDataURL("image/jpeg", 0.82);
}

export const THEMES = [
  { id: "atrament", name: "Atrament", colors: ["#16181f", "#5b9cf0", "#f0a64a"] },
  { id: "sakura", name: "Sakura", colors: ["#1f1519", "#f08cb4", "#f5d58a"] },
  { id: "terminal", name: "Terminal", colors: ["#0c120d", "#4ee07a", "#c8f04e"] },
  { id: "neon", name: "Neon", colors: ["#120d1f", "#3ee0f0", "#f04ec8"] },
  { id: "pergamin", name: "Pergamin", colors: ["#f3ecdc", "#3b5f9a", "#c0582e"] },
];
