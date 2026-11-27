import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nowe hasło — Atelier OS" },
      { name: "description", content: "Ustaw nowe hasło do swojego konta Atelier OS." },
      { property: "og:title", content: "Nowe hasło — Atelier OS" },
      { property: "og:description", content: "Ustaw nowe hasło do swojego konta Atelier OS." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (window.location.hash.includes("type=recovery")) setReady(true);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => { subscription.unsubscribe(); };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) { toast.error("Hasło musi mieć co najmniej 6 znaków."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) { toast.error(error.message); return; }
      toast.success("Hasło zostało zmienione.");
      void navigate({ to: "/", replace: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground paper-grain px-4 py-8">
      <div className="mx-auto max-w-md rounded-lg border border-border bg-card p-6">
        <h1 className="text-xl font-bold">Ustaw nowe hasło</h1>
        {!ready ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Otwórz tę stronę bezpośrednio z linku wysłanego na Twój adres e-mail. <Link to="/auth" className="underline text-accent">Wróć do logowania</Link>.
          </p>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-3">
            <div className="space-y-1">
              <Label htmlFor="new-password">Nowe hasło</Label>
              <Input id="new-password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 6 znaków" />
            </div>
            <Button type="submit" disabled={busy} className="w-full gap-2">
              {busy && <Loader2 size={16} className="animate-spin" />}Zapisz nowe hasło
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}