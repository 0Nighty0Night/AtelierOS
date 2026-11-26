import { z } from 'zod';
import { zeroSkills } from './atelier-scoring';
import { DEFAULT_COLORS } from './atelier-theme';
export type { Skills } from './atelier-scoring';
export const SKILLS = [
  { key: 'anatomy', label: 'Anatomia i proporcje' },
  { key: 'pose', label: 'Poza, ruch i gest' },
  { key: 'line', label: 'Linia i cleanup' },
  { key: 'color', label: 'Kolor i klimat' },
  { key: 'light', label: 'Światłocień i bryła' },
  { key: 'detail', label: 'Detal, ubiór i styl' },
] as const;
export type SkillKey = (typeof SKILLS)[number]['key'];
export const THEMES = [
  { id: 'atrament', name: 'Atrament' }, { id: 'sakura', name: 'Sakura' },
  { id: 'terminal', name: 'Terminal' }, { id: 'neon', name: 'Neon' }, { id: 'pergamin', name: 'Pergamin' },
] as const;
const score = z.number().finite().min(0).max(100);
const skillsSchema = z.object({ anatomy: score, pose: score, line: score, color: score, light: score, detail: score });
export const taskSchema = z.object({ title: z.string(), minutes: z.number().positive(), steps: z.array(z.string()), focus: z.string() });
const imageSchema = z.string().regex(/^data:image\/(jpeg|png|webp);base64,/);
export const sessionSchema = z.object({
  status: z.enum(['offline', 'booting', 'online', 'standby']),
  date: z.string().nullable(),
}).default({ status: 'offline', date: null });
export type Session = z.infer<typeof sessionSchema>;
export type SessionStatus = Session['status'];
const stateSchema = z.object({
  session: sessionSchema,
  skills: skillsSchema,
  history: z.array(z.object({ date: z.string(), skills: skillsSchema })),
  task: taskSchema.extend({ date: z.string(), done: z.boolean().optional() }).nullable(),
  doneDays: z.array(z.string()),
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string(), image: imageSchema.optional(), at: z.number() })),
  gallery: z.array(z.object({ image: imageSchema, date: z.string(), note: z.string() })),
  theme: z.enum(['atrament', 'sakura', 'terminal', 'neon', 'pergamin']).default('atrament'),
  customColors: z.object({
    background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    enabled: z.boolean(),
  }).default(DEFAULT_COLORS),
  aiProvider: z.enum(['built-in', 'own']).default('built-in'),
});
export type State = z.infer<typeof stateSchema>;
export type Task = NonNullable<State['task']>;
export type Msg = State['messages'][number];
const iso = (d: Date) => d.toLocaleDateString('sv-SE');
export const today = () => iso(new Date());
export function startSession(session: Session, date = today()): Session {
  if (session.status !== 'offline' && session.status !== 'standby') return session;
  return { status: 'booting', date: session.date ?? date };
}
export function finishBoot(session: Session): Session {
  return session.status === 'booting' ? { ...session, status: 'online' } : session;
}
export function pauseSession(session: Session): Session {
  return session.status === 'online' ? { ...session, status: 'standby' } : session;
}
export function endSession(session: Session): Session {
  return session.status === 'online' || session.status === 'standby' ? { status: 'offline', date: null } : session;
}
export function endDayState(state: State): State {
  const session = endSession(state.session);
  return session === state.session ? state : { ...state, session, messages: [] };
}
export const initialState = (): State => ({
  session: { status: 'offline', date: null },
  skills: zeroSkills(), history: [], task: null, doneDays: [], messages: [], gallery: [], theme: 'atrament', customColors: { ...DEFAULT_COLORS }, aiProvider: 'built-in',
});
const KEY = 'atelieros-v2';
export function parseBackup(value: unknown): State {
  const s = stateSchema.parse(value);
  if (!s.gallery.length) { s.skills = zeroSkills(); s.history = []; }
  // A reload cannot resume a half-finished animation; return safely to the start screen.
  if (s.session.status === 'booting') s.session = { status: 'offline', date: null };
  return s;
}
export function load(): State {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem('atelieros-v1');
    if (raw) {
      const parsed = parseBackup(JSON.parse(raw));
      // Re-save the validated state to remove old insecure apiKey fields.
      localStorage.setItem(KEY, JSON.stringify(parsed));
      localStorage.removeItem('atelieros-v1');
      return parsed;
    }
  } catch { /* malformed data does not crash the UI */ }
  return initialState();
}
export function save(s: State) { localStorage.setItem(KEY, JSON.stringify(s)); }
export function streak(days: string[]): number {
  const set = new Set(days); let n = 0; const d = new Date();
  if (!set.has(today())) d.setDate(d.getDate() - 1);
  while (set.has(iso(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
export function rank(avg: number) {
  if (avg === 0) return 'Nieoceniony';
  if (avg < 16) return 'Nowicjusz'; if (avg < 31) return 'Szkicownik'; if (avg < 46) return 'Czeladnik';
  if (avg < 61) return 'Rzemieślnik'; if (avg < 76) return 'Ilustrator'; if (avg < 89) return 'Profesjonalista';
  if (avg < 98) return 'Mistrz'; if (avg < 100) return 'Wirtuoz'; return 'Perfekcja';
}
export async function compressImage(file: File, max = 1280): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Wybierz obraz JPG, PNG lub WebP.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, err) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => err(new Error('Nie udało się otworzyć obrazu.')); i.src = url; });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('Nie udało się przygotować obrazu.');
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.82);
  } finally { URL.revokeObjectURL(url); }
}
