import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ArrowLeft, MailCheck } from "lucide-react";
import { LovableMark } from "@lovable.dev/cloud-auth-js/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Logowanie — Atelier OS" },
      { name: "description", content: "Zaloguj się lub załóż konto w Atelier OS, aby synchronizować postępy i profil artysty." },
      { property: "og:title", content: "Logowanie — Atelier OS" },
      { property: "og:description", content: "Zaloguj się lub załóż konto w Atelier OS, aby synchronizować postępy i profil artysty." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) void navigate({ to: "/profil", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) { toast.error("Podaj adres e-mail."); return; }
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) { toast.error(error.message); return; }
        toast.success("Wysłaliśmy link do zresetowania hasła.");
        setMode("signin");
        return;
      }
      if (password.length < 6) { toast.error("Hasło musi mieć co najmniej 6 znaków."); return; }
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: displayName.trim() ? { full_name: displayName.trim() } : {},
          },
        });
        if (error) { toast.error(error.message); return; }
        if (data.session) {
          toast.success("Konto utworzone.");
          void navigate({ to: "/profil", replace: true });
        } else {
          setConfirmSent(true);
        }
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
      if (error) { toast.error(error.message); return; }
      toast.success("Zalogowano.");
      void navigate({ to: "/", replace: true });
    } finally {
      setBusy(false);
    }
  }

  async function handleOAuth(provider: "google" | "lovable") {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
      if (result.error) { toast.error(result.error.message || "Nie udało się zalogować."); return; }
      if (result.redirected) return;
      void navigate({ to: "/", replace: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground paper-grain px-4 py-8">
      <div className="mx-auto max-w-md">
        <Link to="/" className="mb-6 inline-flex items-center gap-2 text-xs uppercase text-muted-foreground hover:text-foreground">
          <ArrowLeft size={14} /> Wróć do Atelier OS
        </Link>

        <section className="rounded-lg border border-border bg-card p-6">
          <p className="text-[10px] uppercase text-accent">ATELIER OS // KONTO ARTYSTY</p>
          <h1 className="mt-1 text-xl font-bold">
            {mode === "signin" ? "Zaloguj się" : mode === "signup" ? "Załóż konto" : "Reset hasła"}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Synchronizuj paski umiejętności, galerię, motywy i własny klucz Gemini między urządzeniami.
          </p>

          {confirmSent ? (
            <div className="mt-6 rounded-lg border border-border bg-muted/40 p-4 text-center">
              <MailCheck className="mx-auto mb-2 text-primary" size={28} />
              <p className="text-sm font-semibold">Sprawdź swoją skrzynkę e-mail</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Wysłaliśmy link potwierdzający na adres <b>{email}</b>. Po kliknięciu wrócisz do Atelier OS.
              </p>
              <Button variant="outline" className="mt-4 w-full" onClick={() => { setConfirmSent(false); setMode("signin"); }}>
                Przejdź do logowania
              </Button>
            </div>
          ) : (
            <>
              {mode !== "forgot" && (
                <div className="mt-5 grid gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void handleOAuth("google")}
                    className="w-full justify-center gap-2.5 border-[#8E918F] bg-[#131314] text-[#E3E3E3] hover:bg-[#1e1f20] hover:text-[#E3E3E3]"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" aria-hidden="true">
                      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
                      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
                      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
                      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
                    </svg>
                    Kontynuuj z Google
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void handleOAuth("lovable")}
                    className="w-full justify-center gap-2.5"
                  >
                    <LovableMark className="h-[18px] w-[18px]" />
                    Kontynuuj z Lovable
                  </Button>
                  <div className="my-2 flex items-center gap-2 text-[10px] uppercase text-muted-foreground">
                    <span className="h-px flex-1 bg-border" />lub e-mail<span className="h-px flex-1 bg-border" />
                  </div>
                </div>
              )}

              <form onSubmit={(e) => void handleSubmit(e)} className="mt-3 space-y-3">
                {mode === "signup" && (
                  <div className="space-y-1">
                    <Label htmlFor="displayName">Nick / nazwa artysty</Label>
                    <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="np. KuroiSketch" maxLength={60} />
                  </div>
                )}
                <div className="space-y-1">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="twoj@email.pl" />
                </div>
                {mode !== "forgot" && (
                  <div className="space-y-1">
                    <Label htmlFor="password">Hasło</Label>
                    <Input id="password" type="password" required minLength={6} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 6 znaków" />
                  </div>
                )}
                <Button type="submit" disabled={busy} className="w-full gap-2">
                  {busy && <Loader2 size={16} className="animate-spin" />}
                  {mode === "signin" ? "Zaloguj się" : mode === "signup" ? "Utwórz konto" : "Wyślij link resetujący"}
                </Button>
              </form>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                {mode === "signin" ? (
                  <>
                    <button type="button" onClick={() => setMode("signup")} className="underline hover:text-foreground">Nie masz konta? Zarejestruj się</button>
                    <button type="button" onClick={() => setMode("forgot")} className="underline hover:text-foreground">Nie pamiętam hasła</button>
                  </>
                ) : (
                  <button type="button" onClick={() => setMode("signin")} className="underline hover:text-foreground">Masz już konto? Zaloguj się</button>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}