import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, KeyRound, Loader2, LogOut, Trash2, User, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/atelier";
import { deleteGeminiKey, getProfile, saveProfile } from "@/lib/profile.functions";

export const Route = createFileRoute("/profil")({
  head: () => ({
    meta: [
      { title: "Profil artysty — Atelier OS" },
      { name: "description", content: "Zarządzaj swoim awatarem, bio oraz własnym kluczem Gemini API w Atelier OS." },
      { property: "og:title", content: "Profil artysty — Atelier OS" },
      { property: "og:description", content: "Zarządzaj swoim awatarem, bio oraz własnym kluczem Gemini API w Atelier OS." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [geminiKey, setGeminiKey] = useState("");
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [keyHint, setKeyHint] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return;
      if (!data.user) { setChecking(false); return; }
      setEmail(data.user.email ?? null);
      try {
        const p = await getProfile();
        if (!active) return;
        setDisplayName(p.displayName);
        setBio(p.bio);
        setAvatarUrl(p.avatarUrl);
        setHasGeminiKey(p.hasGeminiKey);
        setKeyHint(p.keyHint);
      } catch {
        toast.error("Nie udało się wczytać profilu.");
      } finally {
        if (active) setChecking(false);
      }
    });
    return () => { active = false; };
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!hasGeminiKey && !geminiKey.trim()) {
      toast.error("Klucz Gemini API jest obowiązkowy do korzystania z Mentora.");
      return;
    }
    setSaving(true);
    try {
      const res = await saveProfile({
        data: {
          displayName,
          bio,
          avatarUrl,
          ...(geminiKey.trim() ? { geminiKey: geminiKey.trim() } : {}),
        },
      });
      setHasGeminiKey(res.hasGeminiKey);
      setKeyHint(res.keyHint);
      setGeminiKey("");
      toast.success("Profil artysty zapisany.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nie udało się zapisać profilu.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveKey() {
    if (!confirm("Usunąć zapisany klucz Gemini API? Mentor przestanie odpowiadać do czasu dodania nowego.")) return;
    setSaving(true);
    try {
      await deleteGeminiKey();
      setHasGeminiKey(false);
      setKeyHint(null);
      toast.success("Klucz Gemini API został usunięty.");
    } catch {
      toast.error("Nie udało się usunąć klucza.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  if (checking) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground"><Loader2 className="animate-spin" /></div>;
  }

  if (!email) {
    return (
      <div className="min-h-screen bg-background text-foreground paper-grain px-4 py-8">
        <div className="mx-auto max-w-md rounded-lg border border-border bg-card p-6 text-center">
          <User className="mx-auto mb-3 text-primary" size={32} />
          <h1 className="text-lg font-bold">Profil artysty wymaga logowania</h1>
          <p className="mt-2 text-xs text-muted-foreground">Zaloguj się, aby ustawić awatar, bio, własny klucz Gemini API i synchronizować postępy między urządzeniami.</p>
          <div className="mt-5 flex flex-col gap-2">
            <Button asChild><Link to="/auth">Przejdź do logowania</Link></Button>
            <Button variant="outline" asChild><Link to="/">Wróć do Atelier OS</Link></Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground paper-grain px-4 py-6 pb-16">
      <div className="mx-auto max-w-xl">
        <div className="mb-5 flex items-center justify-between gap-2">
          <Link to="/" className="inline-flex items-center gap-2 text-xs uppercase text-muted-foreground hover:text-foreground">
            <ArrowLeft size={14} /> Wróć do Atelier OS
          </Link>
          <Button variant="outline" size="sm" onClick={() => void handleSignOut()} className="gap-1.5">
            <LogOut size={14} /> Wyloguj
          </Button>
        </div>

        <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
          <section className="rounded-lg border border-border bg-card p-5">
            <p className="text-[10px] uppercase text-accent">ATELIER OS // PROFIL ARTYSTY</p>
            <h1 className="mt-1 text-xl font-bold">Twoja wizytówka</h1>
            <p className="text-xs text-muted-foreground">{email}</p>

            <div className="mt-5 flex items-center gap-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-border bg-muted flex items-center justify-center">
                {avatarUrl ? <img src={avatarUrl} alt="Awatar" className="h-full w-full object-cover" /> : <User size={28} className="text-muted-foreground" />}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5">
                  <Camera size={14} /> Zmień awatar
                </Button>
                {avatarUrl && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setAvatarUrl(null)} className="gap-1.5 text-destructive">
                    <Trash2 size={14} /> Usuń
                  </Button>
                )}
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    try { setAvatarUrl(await compressImage(f, 256)); }
                    catch (err) { toast.error(err instanceof Error ? err.message : "Nieprawidłowy obraz."); }
                  }
                  e.target.value = "";
                }} />
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="space-y-1">
                <Label htmlFor="profile-name">Nick / nazwa artysty</Label>
                <Input id="profile-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Jak mamy Cię nazywać?" maxLength={60} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="profile-bio">Bio artystyczne</Label>
                <Textarea id="profile-bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Twój styl, tablet, cele rysunkowe…" maxLength={500} />
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="inline-flex items-center gap-2 text-sm font-semibold uppercase"><KeyRound size={16} className="text-accent" /> Klucz Gemini API (wymagany)</h2>
              {hasGeminiKey ? (
                <span className="inline-flex items-center gap-1 text-xs text-chart-3"><CheckCircle2 size={14} /> Zapisany {keyHint}</span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-destructive"><AlertTriangle size={14} /> Brak klucza</span>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Mentor AI przetwarza zapytania wyłącznie na Twoim własnym kluczu z Google AI Studio. Klucz jest przechowywany bezpiecznie na serwerze i nigdy nie jest widoczny dla innych użytkowników.
            </p>
            <div className="mt-3 space-y-2">
              <Label htmlFor="gemini-key">{hasGeminiKey ? "Zmień klucz Gemini API" : "Wklej swój klucz Gemini API *"}</Label>
              <Input id="gemini-key" type="password" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} placeholder={hasGeminiKey ? "Wpisz nowy klucz, aby nadpisać…" : "AIza…"} autoComplete="off" />
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-xs text-accent underline">Wygeneruj klucz w Google AI Studio →</a>
                {hasGeminiKey && (
                  <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => void handleRemoveKey()} className="text-destructive">Usuń klucz</Button>
                )}
              </div>
            </div>
          </section>

          <Button type="submit" disabled={saving} className="w-full gap-2">
            {saving && <Loader2 size={16} className="animate-spin" />}Zapisz profil i ustawienia
          </Button>
        </form>
      </div>
    </div>
  );
}