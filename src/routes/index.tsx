import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { LayoutDashboard, MessageSquare, Images, Send, ImagePlus, Target, Flame, Check, X, Loader2, Settings as Cog, Eye, EyeOff, Download, Upload } from "lucide-react";
import { askAtelier } from "@/lib/atelier.functions";
import { SKILLS, compressImage, initialState, load, rank, save, streak, today, type State, type Msg, THEMES } from "@/lib/atelier";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Atelier OS — centrum rozwoju artystycznego" },
      { name: "description", content: "Mentor rysunku z AI: paski umiejętności, zadania dnia i oceny prac." },
      { property: "og:title", content: "Atelier OS — centrum rozwoju artystycznego" },
      { property: "og:description", content: "Mentor rysunku z AI: paski umiejętności, zadania dnia i oceny prac." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Atelier,
});

type Tab = "panel" | "mentor" | "galeria" | "ustawienia";

function Atelier() {
  const [st, setSt] = useState<State | null>(null);
  const [tab, setTab] = useState<Tab>("panel");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => setSt(load()), []);
  useEffect(() => { if (st) save(st); }, [st]);
  const theme = st?.theme;
  useEffect(() => { if (theme) document.documentElement.dataset['theme'] = theme; }, [theme]);
  if (!st) return <div className="min-h-screen bg-background" />;

  const s = streak(st.doneDays);
  const avg = Math.round(SKILLS.reduce((a, k) => a + st.skills[k.key], 0) / SKILLS.length);

  async function ask(mode: "review" | "task" | "chat", message: string, image?: string) {
    if (!st) return;
    setBusy(true); setErr(null);
    const userMsg: Msg = { role: "user", content: message || (mode === "task" ? "Daj zadanie na dziś." : "Oceń moją pracę."), image, at: Date.now() };
    setSt((p) => p && { ...p, messages: [...p.messages, userMsg] });
    try {
      const r = await askAtelier({ data: {
        mode, message: userMsg.content, ...(st.apiKey ? { apiKey: st.apiKey } : {}), ...(image ? { image } : {}), skills: st.skills, streak: s,
        recent: st.messages.slice(-8).map((m) => ({ role: m.role, content: m.content.slice(0, 1500) })),
      } });
      if ("error" in r && r.error) { setErr(r.error); return; }
      const res = r as { reply: string; skills: State["skills"] | null; task: { title: string; minutes: number; steps: string[]; focus: string } | null };
      setSt((p) => {
        if (!p) return p;
        const n: State = { ...p, messages: [...p.messages, { role: "assistant", content: res.reply, at: Date.now() }] };
        if (res.skills) { n.skills = res.skills; n.history = [...p.history.filter((h) => h.date !== today()), { date: today(), skills: res.skills }]; }
        if (res.task) n.task = { ...res.task, steps: Array.isArray(res.task.steps) ? res.task.steps : [], date: today() };
        if (mode === "review" && image) { n.gallery = [...p.gallery, { image, date: today(), note: message }]; n.doneDays = Array.from(new Set([...p.doneDays, today()])); }
        return n;
      });
    } catch (e) { setErr(e instanceof Error ? e.message : "Nie udało się połączyć z mentorem."); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-background text-foreground paper-grain pb-24">
      <header className="mx-auto max-w-2xl px-4 pt-6 pb-3">
        <h1 className="text-2xl font-extrabold tracking-tight">🎨 ATELIER OS <span className="text-primary">v1.0</span></h1>
        <p className="mt-1 text-[11px] uppercase text-muted-foreground flex flex-wrap gap-x-2 gap-y-1 items-center">
          <span>Status:</span><span className="chip text-primary">ONLINE<span className="blink">_</span></span>
          <span>Tryb:</span><span className="chip">MENTOR &amp; PROGRES</span>
          <span className="chip">{today().split("-").reverse().join(".")}</span>
        </p>
      </header>

      <main className="mx-auto max-w-2xl px-4">
        {err && <div className="mb-3 rounded border border-destructive/60 bg-destructive/10 p-3 text-sm flex justify-between gap-2"><span>{err}</span><button onClick={() => setErr(null)}><X size={16} /></button></div>}
        {tab === "panel" && <Panel st={st} setSt={setSt} avg={avg} streakN={s} busy={busy} ask={ask} goMentor={() => setTab("mentor")} />}
        {tab === "mentor" && <Mentor st={st} busy={busy} ask={ask} />}
        {tab === "galeria" && <Gallery st={st} />}
        {tab === "ustawienia" && <SettingsView st={st} setSt={setSt} />}
      </main>

      <nav className="fixed bottom-0 inset-x-0 border-t border-border bg-card/95 backdrop-blur">
        <div className="mx-auto max-w-2xl grid grid-cols-4">
          {([["panel", "Panel", LayoutDashboard], ["mentor", "Mentor", MessageSquare], ["galeria", "Galeria", Images], ["ustawienia", "Ustawienia", Cog]] as const).map(([k, l, I]) => (
            <button key={k} onClick={() => setTab(k)} className={`flex flex-col items-center gap-1 py-3 text-[11px] uppercase tracking-wider ${tab === k ? "text-accent" : "text-muted-foreground"}`}>
              <I size={20} />{l}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="mb-4 rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide">{title}</h2>{right}
      </div>
      {children}
    </section>
  );
}

function Panel({ st, setSt, avg, streakN, busy, ask, goMentor }: {
  st: State; setSt: React.Dispatch<React.SetStateAction<State | null>>; avg: number; streakN: number; busy: boolean;
  ask: (m: "review" | "task" | "chat", msg: string, img?: string) => Promise<void>; goMentor: () => void;
}) {
  const first = st.history.find((h) => SKILLS.some((k) => h.skills[k.key] > 0))?.skills;
  const rated = SKILLS.some((k) => st.skills[k.key] > 0);
  const task = st.task;
  const taskToday = task?.date === today();
  return (
    <>
      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        <Stat label="Ranga" value={rank(avg)} small />
        <Stat label="Średnia" value={`${avg}/100`} />
        <Stat label="Seria" value={<span className="inline-flex items-center gap-1"><Flame size={16} className="text-accent" />{streakN}</span>} />
      </div>

      <Section title="📊 Moduł 1: Umiejętności" right={<span className="text-[10px] text-muted-foreground">zarządza AI</span>}>
        <div className="space-y-3">
          {SKILLS.map((k) => {
            const v = st.skills[k.key]; const d = first && first[k.key] > 0 ? v - first[k.key] : 0;
            return (
              <div key={k.key}>
                <div className="flex justify-between text-xs uppercase"><span>{k.label}</span>
                  <span><b>{v}</b><span className="text-muted-foreground">/100</span>{d !== 0 && <span className={d > 0 ? "text-chart-3 ml-1" : "text-destructive ml-1"}>{d > 0 ? "+" : ""}{d}</span>}</span>
                </div>
                <div className="bar-track mt-1 h-3 overflow-hidden rounded-sm border border-border"><div className="bar-fill h-full" style={{ width: `${v}%` }} /></div>
              </div>
            );
          })}
        </div>
        {!rated && <p className="mt-3 text-xs text-muted-foreground">Paski startują od zera. Wyślij pierwszą pracę do Mentora — dostaniesz uczciwą ocenę, w której 100 to totalna perfekcja.</p>}
        {st.history.length > 1 && <p className="mt-3 text-[11px] text-muted-foreground">Zmiana od startu ({st.history[0]?.date}) · {st.history.length} pomiarów</p>}
      </Section>

      <Section title="🎯 Moduł 3: Zadanie dnia" right={taskToday && task?.done ? <span className="chip text-chart-3">ZALICZONE</span> : null}>
        {task ? (
          <div className={taskToday ? "" : "opacity-60"}>
            <p className="font-semibold text-accent">„{task.title}” <span className="text-muted-foreground font-normal">(~{task.minutes} min)</span></p>
            {task.focus && <p className="text-xs text-muted-foreground mt-1">Cel: {task.focus}</p>}
            <ol className="mt-2 list-decimal pl-5 space-y-1 text-sm">{task.steps.map((x, i) => <li key={i}>{x}</li>)}</ol>
            {!taskToday && <p className="text-xs mt-2">To zadanie z {task.date}. Weź nowe na dziś ↓</p>}
          </div>
        ) : <p className="text-sm text-muted-foreground">Brak zadania. Poproś mentora o rozgrzewkę.</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <button disabled={busy} onClick={async () => { await ask("task", "Daj zadanie na dziś."); }} className="inline-flex items-center gap-2 rounded bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Target size={16} />}Daj zadanie na dziś
          </button>
          {taskToday && !task?.done && (
            <button onClick={() => setSt((p) => p && p.task ? { ...p, task: { ...p.task, done: true }, doneDays: Array.from(new Set([...p.doneDays, today()])) } : p)} className="inline-flex items-center gap-2 rounded border border-accent px-3 py-2 text-sm text-accent">
              <Check size={16} />Zrobione
            </button>
          )}
        </div>
      </Section>

      <Section title="⚡ Szybkie akcje">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <button onClick={goMentor} className="rounded border border-border bg-muted p-3 text-left">📤 Wyślij pracę do oceny</button>
          <button disabled={busy} onClick={() => { goMentor(); void ask("chat", "Zaproponuj mi pomysł na ilustrację w moim stylu na ten tydzień."); }} className="rounded border border-border bg-muted p-3 text-left">💡 Pomysł na ilustrację</button>
          <button disabled={busy} onClick={() => { goMentor(); void ask("chat", "Nie mam dziś mocy. Daj mi zadanie 10 minut bez wymówek."); }} className="rounded border border-border bg-muted p-3 text-left">🔋 Tryb 10 minut</button>
          <button disabled={busy} onClick={() => { goMentor(); void ask("chat", "Podsumuj mój postęp i zaproponuj plan na najbliższy tydzień."); }} className="rounded border border-border bg-muted p-3 text-left">🗓️ Plan tygodnia</button>
        </div>
      </Section>
    </>
  );
}

function Stat({ label, value, small }: { label: string; value: React.ReactNode; small?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-2">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className={`font-display font-semibold ${small ? "text-xs mt-1" : "text-lg"}`}>{value}</div>
    </div>
  );
}

function Mentor({ st, busy, ask }: { st: State; busy: boolean; ask: (m: "review" | "task" | "chat", msg: string, img?: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const [img, setImg] = useState<string | undefined>();
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [st.messages.length, busy]);

  async function send() {
    if (busy || (!text.trim() && !img)) return;
    const t = text, i = img; setText(""); setImg(undefined);
    await ask(i ? "review" : "chat", t, i);
  }
  return (
    <div>
      {st.messages.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          Wyślij zdjęcie lub zrzut swojej pracy z krótkim opisem (np. „siedząca dziewczyna, niebiesko-czarne włosy, WIP na kukle”). Mentor oceni ją i zaktualizuje Twoje paski.
        </div>
      )}
      <div className="space-y-3 mb-40">
        {st.messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "ml-10 rounded-lg bg-primary p-3 text-sm text-primary-foreground" : "text-sm ai-md"}>
            {m.image && <img src={m.image} alt="Twoja praca" className="mb-2 max-h-64 rounded" />}
            {m.role === "user" ? <p className="whitespace-pre-wrap">{m.content}</p> : <ReactMarkdown>{m.content}</ReactMarkdown>}
          </div>
        ))}
        {busy && <p className="text-xs text-accent">▌ Mentor analizuje<span className="blink">...</span></p>}
        <div ref={endRef} />
      </div>
      <div className="fixed bottom-[68px] inset-x-0 px-4">
        <div className="mx-auto max-w-2xl rounded-lg border border-border bg-card p-2">
          {img && <div className="relative mb-2 inline-block"><img src={img} alt="Podgląd" className="h-20 rounded" /><button onClick={() => setImg(undefined)} className="absolute -top-2 -right-2 rounded-full bg-destructive p-0.5 text-destructive-foreground"><X size={12} /></button></div>}
          <div className="flex items-end gap-2">
            <button onClick={() => fileRef.current?.click()} className="p-2 text-muted-foreground" aria-label="Dodaj obraz"><ImagePlus size={20} /></button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setImg(await compressImage(f)); e.target.value = ""; }} />
            <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
              rows={1} placeholder={img ? "Opisz pracę…" : "Napisz do mentora…"} className="flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground" />
            <button onClick={send} disabled={busy} className="rounded bg-accent p-2 text-accent-foreground disabled:opacity-50" aria-label="Wyślij">
              {busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Gallery({ st }: { st: State }) {
  if (!st.gallery.length) return <p className="text-sm text-muted-foreground">Tu pojawią się prace wysłane do oceny — Twoja oś czasu postępów.</p>;
  return (
    <div className="grid grid-cols-2 gap-3">
      {[...st.gallery].reverse().map((g, i) => (
        <figure key={i} className="rounded-lg border border-border bg-card p-2">
          <img src={g.image} alt={g.note || "Praca"} className="aspect-square w-full rounded object-cover" />
          <figcaption className="mt-1 text-[11px] text-muted-foreground">{g.date} · {g.note || "bez opisu"}</figcaption>
        </figure>
      ))}
    </div>
  );
}

function SettingsView({ st, setSt }: { st: State; setSt: React.Dispatch<React.SetStateAction<State | null>> }) {
  const [show, setShow] = useState(false);
  const [key, setKey] = useState(st.apiKey);
  const fileRef = useRef<HTMLInputElement>(null);
  const exportData = () => {
    const blob = new Blob([JSON.stringify({ ...st, apiKey: "" })], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `atelieros-${today()}.json`; a.click();
  };
  return (
    <>
      <Section title="🎨 Motyw">
        <div className="grid grid-cols-2 gap-2">
          {THEMES.map((t) => (
            <button key={t.id} onClick={() => setSt((p) => p && { ...p, theme: t.id })}
              className={`flex items-center gap-2 rounded border p-2 text-left text-sm ${st.theme === t.id ? "border-accent" : "border-border"}`}>
              <span className="flex">{t.colors.map((c) => <span key={c} className="h-5 w-5 rounded-full border border-border -mr-1" style={{ background: c }} />)}</span>
              <span className="ml-2">{t.name}</span>
            </button>
          ))}
        </div>
      </Section>
      <Section title="🔑 Klucz Gemini (opcjonalny)">
        <p className="mb-2 text-xs text-muted-foreground">Bez klucza mentor działa na wbudowanym AI. Z kluczem z Google AI Studio zapytania idą na Twoje konto Gemini. Klucz zostaje tylko w tej przeglądarce.</p>
        <div className="flex gap-2">
          <input type={show ? "text" : "password"} value={key} onChange={(e) => setKey(e.target.value)} placeholder="AIza…"
            className="flex-1 rounded border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring" />
          <button onClick={() => setShow(!show)} className="rounded border border-border px-2" aria-label="Pokaż klucz">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
        </div>
        <div className="mt-2 flex gap-2 text-sm">
          <button onClick={() => setSt((p) => p && { ...p, apiKey: key.trim() })} className="rounded bg-primary px-3 py-2 font-semibold text-primary-foreground">Zapisz</button>
          {st.apiKey && <button onClick={() => { setKey(""); setSt((p) => p && { ...p, apiKey: "" }); }} className="rounded border border-border px-3 py-2">Usuń klucz</button>}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Aktywne: {st.apiKey ? "Twój klucz Gemini" : "wbudowane AI"}</p>
      </Section>
      <Section title="💾 Dane">
        <div className="flex flex-wrap gap-2 text-sm">
          <button onClick={exportData} className="inline-flex items-center gap-2 rounded border border-border px-3 py-2"><Download size={16} />Eksportuj kopię</button>
          <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded border border-border px-3 py-2"><Upload size={16} />Wczytaj kopię</button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return;
            try { const d = JSON.parse(await f.text()); setSt((p) => p && { ...initialState(), ...d, apiKey: p.apiKey }); } catch { alert("Niepoprawny plik."); }
            e.target.value = "";
          }} />
          <button onClick={() => { if (confirm("Wyczyścić wszystkie postępy?")) setSt((p) => p && { ...initialState(), theme: p.theme, apiKey: p.apiKey }); }} className="rounded border border-destructive px-3 py-2 text-destructive">Reset postępów</button>
        </div>
      </Section>
    </>
  );
}
