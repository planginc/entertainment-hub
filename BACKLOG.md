# Entertainment Hub: BACKLOG

## Current state (April 7, 2026)
Multi-user app with AI chatbot. Four users: Pam, Bruce, Karen, Lori.

- ~480 records for Pam (341 audiobooks, rest movies/series/limited)
- Bruce, Karen, Lori each seeded with Pam's 136 movies/series/limited (status: want)
- Cards show poster, TMDB score, description, genre badges
- Detail modal: poster thumbnail, trailer button, status/rating controls
- Global search, Surprise Me, Stats tab
- AI chatbot (💬 button, bottom-left): add/update/delete via natural language, persistent per user via sessionStorage
- Voice quick-add (🎤 FAB): fills input, waits for Send
- Full edit form (+ FAB): all fields editable

## Chatbot context (as of April 7)
- itemContext passes: id, title, type, status, platform, my_rating, tmdb_score, genre
- "ratings" defaults to TMDB score; "my ratings" uses my_rating
- Recommendations default to want-list only
- 27 items backfilled with TMDB data via enrich_tmdb.py (Pam/Lori/Karen)
- Not enriched: Pam's 37 audiobooks, 8 Peaky Blinders episodes (Lori/Karen), "Nowhere Man: No Safe Haven" (not on TMDB)
- Streaming platform auto-fetched from TMDB watch providers (US flatrate) on new adds
- lookup_streaming tool available for retroactive platform lookups on existing items

## Deploy notes
- Convex changes require TWO deploys:
  - `npx convex dev --once` -- pushes to dev (what the app uses: exuberant-lapwing-294)
  - `npx convex deploy --yes` -- pushes to prod (formal-wren-70)
- Netlify: `npx netlify-cli deploy --prod` from entertainment-hub/ (not wired to git)

## User URLs
- Pam: https://pams-entertainment-hub.netlify.app
- Bruce: https://pams-entertainment-hub.netlify.app?user=bruce
- Karen: https://pams-entertainment-hub.netlify.app?user=karen
- Lori: https://pams-entertainment-hub.netlify.app?user=lori

## In Progress
None.

## Backlog
None.
