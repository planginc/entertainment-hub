# Entertainment Hub: CLAUDE.md

## What this project is
A personal entertainment tracker for Pam. Tracks movies, TV series, limited series, and audiobooks. Pam uses JJ (Telegram) to add items and this app to browse/manage them.

## Tech stack
- Vanilla HTML/CSS/JS (no build tools, no framework)
- Hosted on Netlify: https://pams-entertainment-hub.netlify.app
- Database: Convex (migrated from Supabase on March 27, 2026)
- Convex HTTP API: https://exuberant-lapwing-294.convex.site/api/entertainment

## Rules specific to this project
- No build step. Edit HTML/CSS/JS directly. Deploy = push to GitHub (Netlify auto-deploys).
- All reads/writes go through the Convex HTTP API, not Supabase.
- Convex IDs are strings. Never parseInt() them. All onclick handlers must quote IDs: `onclick="fn('${d.id}')"`.
- The `/api/entertainment` GET endpoint accepts `?userTelegramId=6285585111`.
- Status values: `want`, `in_progress`, `completed` (NOT `want_to_watch`).

## Things to avoid
- Do NOT add Supabase client back. Migration is complete.
- Do NOT use parseInt() on item IDs. This was a recurring bug during migration.
- No `entertainment_history` table exists in Convex. Do not reference it.

## Current state (March 27, 2026)
- Fully migrated to Convex. 439 records migrated from Supabase + new ones from JJ.
- app.js uses apiGet()/apiPost() wrappers to call Convex HTTP API.
- JJ now routes watch-list additions via [ENTERTAINMENT:] intent directly to Convex.
- index.html has no Supabase script tag.

## Next session: backlog

### 1. Auto-enrich on add (JJ side, in memory.ts [ENTERTAINMENT:] handler)
When JJ adds an item, it should auto-search for details before inserting:
- Genre
- Description/overview (1-3 sentences)
- Release year
- Creator/director
- Number of seasons/episodes (for series)
- Runtime (for movies)

Implementation: in memory.ts, after parsing the [ENTERTAINMENT:] tag and before calling the Convex insert endpoint, use the Brave/web search tool or a TMDB/OMDB API call to fetch metadata. Store in the existing fields (genre, notes/overview, creator, seasons) plus metadata{} for anything extra.

TMDB API is free and has comprehensive movie/TV data. Consider adding TMDB_API_KEY to .env.

### 2. Display genre + overview in the app
The app currently shows title, platform, status, rating. Add:
- Genre badge on each card
- "About" section in the detail modal (overview text)
- These fields already exist in the Convex schema, just not displayed yet.
