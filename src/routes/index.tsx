import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { LayoutDashboard, MessageSquare, Images, Send, ImagePlus, Target, Flame, Check, X, Loader2, Settings as Cog, Download, Upload, Power, Pause, Play, Moon, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { askAtelier, getAiSettings } from "@/lib/atelier.functions";
import { SKILLS, compressImage, initialState, load, rank, save, streak, today, type State, type Msg, THEMES, parseBackup, startSession, finishBoot, pauseSession, endDayState, type SessionStatus } from "@/lib/atelier";

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

const SESSION_LABELS: Record<SessionStatus, string> = {
  offline: "OFFLINE",
  booting: "BOOTING",
  online: "ONLINE",
  standby: "STANDBY",
};

const BOOT_LINES = [
  "ATELIER BIOS v1.0 // INICJALIZACJA",
  "CPU: KREATYWNOŚĆ ................. OK",
  "PAMIĘĆ LOKALNA .................... OK",
  "MODUŁ: ANATOMIA ................... OK",
  "MODUŁ: LINIA I KOLOR .............. OK",
  "MODUŁ: ŚWIATŁOCIEŃ ................ OK",
  "MONTOWANIE GALERII PRAC ........... OK",
  "PRZYWRACANIE HISTORII POSTĘPÓW .... OK",
  "ŁĄCZENIE Z MENTOREM AI ............ OK",
  "KALIBRACJA ZADANIA DNIA ........... OK",
  "PROTOKÓŁ: MENTOR & PROGRES ........ AKTYWNY",
  "SYSTEM GOTOWY. DOBREGO RYSOWANIA_",
];

function Atelier() {
  const [st, setSt] = useState<State | null>(null);
  const [tab, setTab] = useState<Tab>("panel");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => setSt(load()), []);
  useEffect(() => { if (st) { try { save(st); } catch { setErr("Brak miejsca na zapis. Wyeksportuj kopię danych w Ustawieniach; ostatnie zmiany są teraz tylko w pamięci."); } } }, [st]);
  const theme = st?.theme;
  useEffect(() => { if (theme) document.documentElement.dataset['theme'] = theme; }, [theme]);
  const finishBootSequence = useCallback(() => {
    setSt((p) => p ? { ...p, session: finishBoot(p.session) } : p);
  }, []);
  const sessionStatus = st?.session.status;
  useEffect(() => {
    if (sessionStatus !== "booting") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(finishBootSequence, reduced ? 250 : BOOT_LINES.length * 145 + 500);
    return () => window.clearTimeout(timer);
  }, [sessionStatus, finishBootSequence]);
  if (!st) return <div className="min-h-screen bg-background" />;

  const s = streak(st.doneDays);
  const avg = Math.round(SKILLS.reduce((a, k) => a + st.skills[k.key], 0) / SKILLS.length);
  const status = st.session.status;

  function startDay() {
    if (!busy) setSt((p) => p ? { ...p, session: startSession(p.session) } : p);
  }
  function pauseDay() {
    if (!busy) setSt((p) => p ? { ...p, session: pauseSession(p.session) } : p);
  }
  function endDay() {
    if (busy) return;
    setErr(null);
    setSt((p) => p ? endDayState(p) : p);
  }

  async function ask(mode: "review" | "task" | "chat", message: string, image?: string) {
    if (!st || busy || st.session.status !== "online") return;
    setBusy(true); setErr(null);
    const userMsg: Msg = { role: "user", content: message || (mode === "task" ? "Daj zadanie na dziś." : "Oceń moją pracę."), ...(image ? { image } : {}), at: Date.now() };
    setSt((p) => p && { ...p, messages: [...p.messages, userMsg] });
    try {
      const r = await askAtelier({ data: {
        mode, message: userMsg.content, aiProvider: st.aiProvider, ...(image ? { image } : {}), skills: st.skills, streak: s,
        recent: st.messages.slice(-8).map((m) => ({ role: m.role, content: m.content.slice(0, 1500) })),
      } });
      if ("error" in r && r.error) { setErr(r.error); return; }
      const res = r as { reply: string; skills: State["skills"] | null; task: { title: string; minutes: number; steps: string[]; focus: string } | null };
      setSt((p) => {
        if (!p) return p;
        const n: State = { ...p, messages: [...p.messages, { role: "assistant", content: res.reply, at: Date.now() }] };
        if (res.skills) { n.skills = res.skills; n.history = [...p.history, { date: today(), skills: res.skills }]; }
        if (res.task) n.task = { ...res.task, steps: Array.isArray(res.task.steps) ? res.task.steps : [], date: today() };
        if (mode === "review" && image) { n.gallery = [...p.gallery, { image, date: today(), note: message }]; n.doneDays = Array.from(new Set([...p.doneDays, today()])); }
        return n;
      });
    } catch (e) { setErr(e instanceof Error ? e.message : "Nie udało się połączyć z mentorem."); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-background text-foreground paper-grain">
      <div className="pb-24">
        <header className="mx-auto max-w-2xl px-4 pt-6 pb-3">
          <h1 className="text-2xl font-extrabold tracking-normal">🎨 ATELIER OS <span className="text-primary">v1.0</span></h1>
          <p className="mt-1 text-[11px] uppercase text-muted-foreground flex flex-wrap gap-x-2 gap-y-1 items-center">
            <span>Status:</span>
            <span className={`chip inline-flex items-center ${status === "online" ? "text-chart-3" : status === "standby" ? "text-accent" : "text-muted-foreground"}`}>
              {status === "online" && <span className="status-dot" />}{SESSION_LABELS[status]}{status === "booting" && <span className="blink">_</span>}
            </span>
            <span>Tryb:</span><span className="chip">{status === "standby" ? "SESJA WSTRZYMANA" : "MENTOR & PROGRES"}</span>
            <span className="chip">{today().split("-").reverse().join(".")}</span>
          </p>

        </header>

        <main className="mx-auto max-w-2xl px-4">
          {err && <div className="mb-3 rounded border border-destructive/60 bg-destructive/10 p-3 text-sm flex justify-between gap-2"><span>{err}</span><Button variant="unstyled" onClick={() => setErr(null)}><X size={16} /></Button></div>}
          {tab === "panel" && <Panel st={st} setSt={setSt} avg={avg} streakN={s} busy={busy} ask={ask} goMentor={() => setTab("mentor")} />}
          {tab === "mentor" && <Mentor st={st} busy={busy} ask={ask} onStart={startDay} onPause={pauseDay} onEnd={endDay} />}
          {tab === "galeria" && <Gallery st={st} />}
          {tab === "ustawienia" && <SettingsView st={st} setSt={setSt} />}
        </main>

        <nav className="fixed bottom-0 inset-x-0 border-t border-border bg-card/95 backdrop-blur">
          <div className="mx-auto max-w-2xl grid grid-cols-4">
            {([["panel", "Panel", LayoutDashboard], ["mentor", "Mentor", MessageSquare], ["galeria", "Galeria", Images], ["ustawienia", "Ustawienia", Cog]] as const).map(([k, l, I]) => (
              <Button variant="unstyled" key={k} onClick={() => setTab(k)} className={`flex flex-col items-center gap-1 py-3 text-[10px] uppercase tracking-normalr ${tab === k ? "text-accent" : "text-muted-foreground"}`}>
                <I size={20} />{l}
              </Button>
            ))}
          </div>
        </nav>
      </div>
      <div className={`session-shade session-shade-${status}`} aria-hidden="true" />
    </div>
  );
}

function BootScreen() {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers = BOOT_LINES.map((line, index) => window.setTimeout(() => {
      setLines((current) => [...current, line]);
    }, reduced ? 0 : index * 145));
    return () => { timers.forEach(window.clearTimeout); };
  }, []);

  const progress = Math.max(4, Math.round((lines.length / BOOT_LINES.length) * 100));
  return (
    <div className="flex flex-1 flex-col justify-center p-4 sm:p-6" role="status" aria-label="Uruchamianie Atelier OS">
      <div className="w-full">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-border pb-3 text-[10px] uppercase text-muted-foreground">
          <span className="inline-flex items-center gap-2"><Terminal size={15} className="text-primary" />Atelier BIOS</span>
          <span>BOOT SEQUENCE // {String(progress).padStart(3, "0")}%</span>
        </div>
        <div className="boot-log flex flex-col justify-end overflow-hidden font-mono text-[10px] leading-6 text-primary sm:text-xs" aria-live="polite">
          {lines.map((line, index) => <div key={line} className="boot-line"><span className="mr-2 text-muted-foreground">{String(index).padStart(2, "0")}</span>{line}</div>)}
          {lines.length < BOOT_LINES.length && <span className="blink text-accent">▌</span>}
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-sm border border-border bg-muted">
          <div className="boot-progress h-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-3 text-center text-[10px] uppercase text-muted-foreground">Nie wyłączaj stacji · trwa synchronizacja modułów</p>
      </div>
    </div>
  );
}

function SessionScreen({ status, onStart, onEnd }: {
  status: SessionStatus;
  onStart: () => void;
  onEnd: () => void;
}) {
  if (status === "booting") return <BootScreen />;
  const standby = status === "standby";
  return (
    <div className="flex flex-1 items-center justify-center p-4" aria-labelledby="session-title">
      <div className="w-full p-2 text-center sm:p-6">
        <div className="mb-5 flex items-center justify-between border-b border-border pb-3 text-[10px] uppercase text-muted-foreground">
          <span>ATELIER OS // SESSION</span><span>{SESSION_LABELS[status]}</span>
        </div>
        <div className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-primary text-primary ${standby ? "standby-icon" : ""}`}>
          {standby ? <Moon size={28} /> : <Power size={28} />}
        </div>
        <p className="text-[10px] uppercase text-accent">{standby ? "Pamięć sesji aktywna" : "System gotowy do inicjalizacji"}</p>
        <h2 id="session-title" className="mt-2 text-xl font-semibold">{standby ? "Stacja wstrzymana" : "Mentor wyłączony"}</h2>
        <p className="mx-auto mt-3 max-w-sm text-xs leading-6 text-muted-foreground">
          {standby
            ? "Rozmowa jest zachowana. Wznów sesję, gdy wrócisz do rysowania."
            : "Nowy dzień, nowa rozmowa. Twoje prace, zadania i postępy pozostają zapisane."}
        </p>
        <div className="mt-6 grid gap-2">
          <Button onClick={onStart} className="gap-2">
            {standby ? <Play size={17} /> : <Power size={17} />}{standby ? "Wznów sesję" : "Rozpocznij dzień"}
          </Button>
          {standby && <Button variant="outline" onClick={onEnd} className="gap-2"><Power size={16} />Zakończ dzień · OFFLINE</Button>}
        </div>
        <p className="mt-5 text-[10px] uppercase text-muted-foreground">{standby ? "STANDBY // niski pobór mocy" : "INICJALIZUJ SYSTEM // pamięć lokalna gotowa"}</p>
      </div>
    </div>
  );
}

function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="mb-4 rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-normal">{title}</h2>{right}
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
          <Button variant="unstyled" disabled={busy} onClick={async () => { if (st.session.status !== "online") { goMentor(); return; } await ask("task", "Daj zadanie na dziś."); }} className="inline-flex items-center gap-2 rounded bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Target size={16} />}Daj zadanie na dziś
          </Button>
          {taskToday && !task?.done && (
            <Button variant="unstyled" onClick={() => setSt((p) => p && p.task ? { ...p, task: { ...p.task, done: true }, doneDays: Array.from(new Set([...p.doneDays, today()])) } : p)} className="inline-flex items-center gap-2 rounded border border-accent px-3 py-2 text-sm text-accent">
              <Check size={16} />Zrobione
            </Button>
          )}
        </div>
      </Section>

      <Section title="⚡ Szybkie akcje">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Button variant="unstyled" onClick={goMentor} className="rounded border border-border bg-muted p-3 text-left">📤 Wyślij pracę do oceny</Button>
          <Button variant="unstyled" disabled={busy} onClick={() => { goMentor(); void ask("chat", "Zaproponuj mi pomysł na ilustrację w moim stylu na ten tydzień."); }} className="rounded border border-border bg-muted p-3 text-left">💡 Pomysł na ilustrację</Button>
          <Button variant="unstyled" disabled={busy} onClick={() => { goMentor(); void ask("chat", "Nie mam dziś mocy. Daj mi zadanie 10 minut bez wymówek."); }} className="rounded border border-border bg-muted p-3 text-left">🔋 Tryb 10 minut</Button>
          <Button variant="unstyled" disabled={busy} onClick={() => { goMentor(); void ask("chat", "Podsumuj mój postęp i zaproponuj plan na najbliższy tydzień."); }} className="rounded border border-border bg-muted p-3 text-left">🗓️ Plan tygodnia</Button>
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

function Mentor({ st, busy, ask, onStart, onPause, onEnd }: {
  st: State; busy: boolean;
  ask: (m: "review" | "task" | "chat", msg: string, img?: string) => Promise<void>;
  onStart: () => void; onPause: () => void; onEnd: () => void;
}) {
  const [text, setText] = useState("");
  const [img, setImg] = useState<string | undefined>();
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [st.messages.length, busy]);
  useEffect(() => { if (st.session.status === "offline") { setText(""); setImg(undefined); } }, [st.session.status]);

  async function send() {
    if (busy || st.session.status !== "online" || (!text.trim() && !img)) return;
    const t = text, i = img; setText(""); setImg(undefined);
    await ask(i ? "review" : "chat", t, i);
  }
  return (
    <section className="mentor-station session-window flex flex-col rounded-lg" aria-label="Czat Mentora">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-3">
        <span className="inline-flex items-center gap-2 text-xs text-primary"><Terminal size={16} />MENTOR // {SESSION_LABELS[st.session.status]}</span>
        {st.session.status === "online" && <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={busy} onClick={onPause} className="gap-2"><Pause size={14} />STANDBY</Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={onEnd} className="gap-2" title="Zakończ dzień i usuń rozmowę"><Power size={14} />OFFLINE</Button>
        </div>}
      </div>
      {st.session.status !== "online" ? <SessionScreen status={st.session.status} onStart={onStart} onEnd={onEnd} /> : <>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
      {st.messages.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          Wyślij zdjęcie lub zrzut swojej pracy z krótkim opisem (np. „siedząca dziewczyna, niebiesko-czarne włosy, WIP na kukle”). Mentor oceni ją i zaktualizuje Twoje paski.
        </div>
      )}
      <div className="space-y-3 mt-3">
        {st.messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "ml-10 rounded-lg bg-primary p-3 text-sm text-primary-foreground" : "text-sm ai-md"}>
            {m.image && <img src={m.image} alt="Twoja praca" className="mb-2 max-h-64 rounded" />}
            {m.role === "user" ? <p className="whitespace-pre-wrap">{m.content}</p> : <ReactMarkdown>{m.content}</ReactMarkdown>}
          </div>
        ))}
        {busy && <p className="text-xs text-accent">▌ Mentor analizuje<span className="blink">...</span></p>}
        <div ref={endRef} />
      </div>
      </div>
      <div className="shrink-0 border-t border-border p-2">
        <div className="bg-card">
          {img && <div className="relative mb-2 inline-block"><img src={img} alt="Podgląd" className="h-20 rounded" /><Button variant="unstyled" onClick={() => setImg(undefined)} className="absolute -top-2 -right-2 rounded-full bg-destructive p-0.5 text-destructive-foreground"><X size={12} /></Button></div>}
          <div className="flex items-end gap-2">
            <Button variant="unstyled" onClick={() => fileRef.current?.click()} className="p-2 text-muted-foreground" aria-label="Dodaj obraz"><ImagePlus size={20} /></Button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) { try { setImg(await compressImage(f)); } catch (error) { alert(error instanceof Error ? error.message : "Nieprawidłowy obraz."); } } e.target.value = ""; }} />
            <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
              rows={1} placeholder={img ? "Opisz pracę…" : "Napisz do mentora…"} className="min-w-0 flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground" />
            <Button variant="unstyled" onClick={send} disabled={busy || (!text.trim() && !img)} className="rounded bg-accent p-2 text-accent-foreground disabled:opacity-50" aria-label="Wyślij">
              {busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </Button>
          </div>
        </div>
      </div>
      </>}
    </section>
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
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [notice, setNotice] = useState("");
  const refresh = () => getAiSettings().then((r) => setConfigured(r.ownKeyConfigured)).catch(() => setNotice("Nie udało się sprawdzić połączenia."));
  useEffect(() => { void refresh(); }, []);
  const fileRef = useRef<HTMLInputElement>(null);
  const exportData = () => {
    const blob = new Blob([JSON.stringify(st)], { type: "application/json" });
    const a = document.createElement("a"); const url = URL.createObjectURL(blob); a.href = url; a.download = `atelieros-${today()}.json`; a.click(); URL.revokeObjectURL(url);
  };
  return (
    <>
      {notice && <p role="status" className="mb-3 text-sm text-accent">{notice}</p>}
      <Section title="🎨 Motyw">
        <div className="grid grid-cols-2 gap-2">
          {THEMES.map((t) => (
            <Button variant="unstyled" key={t.id} onClick={() => setSt((p) => p && { ...p, theme: t.id })}
              className={`flex items-center gap-2 rounded border p-2 text-left text-sm ${st.theme === t.id ? "border-accent" : "border-border"}`}>
              <span className="flex">{["background", "primary", "accent"].map((role) => <span key={role} data-theme={t.id} className={`theme-swatch swatch-${role}`} />)}</span>
              <span className="ml-2">{t.name}</span>
            </Button>
          ))}
        </div>
      </Section>
      <Section title="🔑 Połączenie z Gemini">
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Dostawca AI">
          <Button variant={st.aiProvider === "built-in" ? "default" : "outline"} onClick={() => setSt((p) => p && { ...p, aiProvider: "built-in" })}>Wbudowane AI</Button>
          <Button variant={st.aiProvider === "own" ? "default" : "outline"} disabled={!configured} onClick={() => setSt((p) => p && { ...p, aiProvider: "own" })}>Własny Gemini</Button>
        </div>
        <p className="text-xs text-muted-foreground">{configured === null ? "Sprawdzanie klucza…" : configured ? "Klucz Gemini zapisany bezpiecznie. Nie jest udostępniany przeglądarce ani eksportowany." : "Brak własnego klucza. Dodaj GOOGLE_API_KEY w ustawieniach sekretów projektu Lovable."}</p>
        <Button variant="outline" className="mt-3" onClick={() => void refresh()}>Odśwież połączenie</Button>
      </Section>
      <Section title="💾 Dane">
        <div className="flex flex-wrap gap-2 text-sm">
          <Button variant="unstyled" onClick={exportData} className="inline-flex items-center gap-2 rounded border border-border px-3 py-2"><Download size={16} />Eksportuj kopię</Button>
          <Button variant="unstyled" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded border border-border px-3 py-2"><Upload size={16} />Wczytaj kopię</Button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return;
            try { const d = parseBackup(JSON.parse(await f.text())); if (confirm("Zastąpić aktualne dane danymi z kopii?")) { setSt(d); setNotice("Kopia została wczytana."); } } catch { alert("Niepoprawny plik."); }
            e.target.value = "";
          }} />
          <Button variant="unstyled" onClick={() => { if (confirm("Wyczyścić wszystkie postępy?")) setSt((p) => p && { ...initialState(), theme: p.theme, aiProvider: p.aiProvider }); }} className="rounded border border-destructive px-3 py-2 text-destructive">Reset postępów</Button>
        </div>
      </Section>
    </>
  );
}
