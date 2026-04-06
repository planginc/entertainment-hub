# Entertainment Hub: CLAUDE.md

## What this project is
A personal entertainment tracker for Pam. Tracks movies, TV series, limited series, and audiobooks. Pam uses JJ (Telegram) to add items and this app to browse/manage them.

## Tech stack
- Vanilla HTML/CSS/JS (no build tools, no framework)
- Hosted on Netlify: https://pams-entertainment-hub.netlify.app
- Database: Convex (migrated from Supabase on March 27, 2026)
- Convex HTTP API: https://exuberant-lapwing-294.convex.site/api/entertainment

## Rules specific to this project
- No build step. Edit HTML/CSS/JS directly.
- **Deploy = `npx netlify-cli deploy --prod`** from this folder. git push alone does NOT trigger Netlify. Manual CLI deploy required every session.
- All reads/writes go through the Convex HTTP API, not Supabase.
- Convex IDs are strings. Never parseInt() them. All onclick handlers must quote IDs: `onclick="fn('${d.id}')"`.
- The `/api/entertainment` GET endpoint accepts `?userTelegramId=6285585111`.
- Status values: `want`, `in_progress`, `completed` (NOT `want_to_watch`).

## Things to avoid
- Do NOT add Supabase client back. Migration is complete.
- Do NOT use parseInt() on item IDs. This was a recurring bug during migration.
- No `entertainment_history` table exists in Convex. Do not reference it.

## Multi-user architecture
URL param `?user=name` routes to each person's data. Mapping lives in `app.js` USER_MAP:
- `pam` → `6285585111` (default, no param needed)
- `bruce` → `bruce-entertainment`
- `karen` → `karen-entertainment`
- `lori` → `lori-entertainment`

To add a new user: add to USER_MAP + USER_NAMES in app.js, add label in gobot/convex/http.ts chat handler, run copy script if seeding from Pam's list.

## AI chatbot
Convex HTTP action at `/api/entertainment/chat` (POST). Uses claude-haiku-4-5-20251001 with tool_use (add_item, update_item, delete_item). Chat history persists in localStorage keyed by user ID. Defined in gobot/convex/http.ts.

## TMDB integration
- `addWithTmdb` Convex action fetches: posterUrl, tmdbId, trailerKey, overview, vote_average
- Notes field format: `Scores: TMDB: X.X\n\n[overview]` -- matches JJ's format
- TMDB_API_KEY set as Convex env var (also in gobot/.env)
- JJ also auto-fetches on every new add via gobot/src/lib/memory.ts
- Some items have no trailerKey -- expected, ~15% not in TMDB video DB

## Convex project ID
`kd7eqg7xj0qd8zkqp523eqnjr183f6zc`
