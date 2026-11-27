import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const saveProfileSchema = z.object({
  displayName: z.string().trim().max(60),
  bio: z.string().trim().max(500),
  avatarUrl: z
    .string()
    .max(300_000)
    .refine(
      (v) => v === "" || v.startsWith("data:image/jpeg;base64,") || v.startsWith("data:image/png;base64,") || v.startsWith("data:image/webp;base64,") || /^https?:\/\//.test(v),
      "Nieprawidłowy format awatara.",
    )
    .nullable(),
  geminiKey: z.string().trim().max(256).optional(),
});

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, bio, avatar_url")
      .eq("id", userId)
      .maybeSingle();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: keyRow } = await supabaseAdmin
      .from("user_ai_keys")
      .select("gemini_key")
      .eq("user_id", userId)
      .maybeSingle();

    const rawKey = keyRow?.gemini_key?.trim() ?? "";
    return {
      displayName: profile?.display_name ?? "",
      bio: profile?.bio ?? "",
      avatarUrl: profile?.avatar_url ?? null,
      hasGeminiKey: rawKey.length > 0,
      keyHint: rawKey.length >= 4 ? `••••${rawKey.slice(-4)}` : rawKey.length > 0 ? "••••" : null,
    };
  });

export const saveProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => saveProfileSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: userId,
      display_name: data.displayName,
      bio: data.bio,
      avatar_url: data.avatarUrl || null,
      updated_at: new Date().toISOString(),
    });
    if (profileError) throw new Error("Nie udało się zapisać profilu.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.geminiKey && data.geminiKey.length > 0) {
      const { error: keyError } = await supabaseAdmin.from("user_ai_keys").upsert({
        user_id: userId,
        gemini_key: data.geminiKey,
        updated_at: new Date().toISOString(),
      });
      if (keyError) throw new Error("Nie udało się zapisać klucza Gemini API.");
    }

    const { data: keyRow } = await supabaseAdmin
      .from("user_ai_keys")
      .select("gemini_key")
      .eq("user_id", userId)
      .maybeSingle();
    const rawKey = keyRow?.gemini_key?.trim() ?? "";
    return {
      ok: true,
      hasGeminiKey: rawKey.length > 0,
      keyHint: rawKey.length >= 4 ? `••••${rawKey.slice(-4)}` : rawKey.length > 0 ? "••••" : null,
    };
  });

export const deleteGeminiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("user_ai_keys").delete().eq("user_id", context.userId);
    if (error) throw new Error("Nie udało się usunąć klucza Gemini API.");
    return { ok: true };
  });