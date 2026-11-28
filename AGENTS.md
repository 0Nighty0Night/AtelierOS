<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->
# AGENTS
- Atelier OS state syncs to Lovable Cloud (`public.user_state`) per signed-in user with localStorage cache (`src/lib/atelier.ts`), and artist profiles live in `public.profiles` (`/profil`).
- AI mentor calls go through `createServerFn` (`requireSupabaseAuth`) in `src/lib/atelier.functions.ts` returning validated JSON `{reply, skills, task}`; every user must supply their own Gemini API key stored server-side in `public.user_ai_keys` (no `LOVABLE_API_KEY` or shared `GOOGLE_API_KEY` fallback).
- Keep image-review score normalization in src/lib/atelier-scoring.ts and validate imported state before saving, so chat/tasks and malformed backups cannot change assessment scores.
- Keep session controls and boot UI inside Mentor; use endDayState for shutdown so only conversation data is cleared and all other tabs remain accessible.
- Store validated custom colors with prototype state and apply them through root semantic CSS tokens, deriving surface and foreground colors to keep light and dark palettes readable.
