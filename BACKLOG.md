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

1. **Add a portfolio demo to the Entertainment Hub.** Pam wants the Entertainment Hub to have the same public-demo system she built for the Recipe App on 2026-04-24: an ephemeral per-visitor `?demo` URL that seeds a sandboxed copy of her real library, a guided 90-second Shepherd.js tour with green-check bullets and progress dots, a Claude Haiku feedback channel that pings Pam's Telegram on every demo chat, and a daily 3am cron that wipes all `demo-*` records so the demo is always fresh. Done looks like: a recruiter clicks "Try the demo" from Pam's portfolio, lands on `https://pams-entertainment-hub.netlify.app/?demo`, gets their own seeded copy of ~50-100 movies/audiobooks/series, walks an auto-starting tour that highlights the chatbot, voice quick-add, surprise-me, and TMDB enrichment, and can talk to JJ (or whichever persona) in chat, and any feedback they type goes straight to Pam's phone. **The full step-by-step playbook is at `/Users/pam/.claude/knowledge-base/portfolio-demo-pattern.md`** -- it covers all 4 phases (seeder, tour, feedback channel, daily wipe), the Card format recipe (title -> blurb -> green-check bullets -> tail), the welcome modal template with Pam's voice, all 14 copy anti-patterns, all 15 pitfalls with measured fixes (the 4-second waitForElement timeout, the stacked-tooltips-on-replay bug, the Shepherd unkillable-300ms-focus floor), the full reference tour copy with rationale for every structural choice, and the AppleScript + cache-bust commands for verification. There is also a `/portfolio-demo` Claude Code skill that reads the playbook and dispatches the build for you when you invoke it. Budget reality: 3-4 focused sessions, not one. Pre-flight before writing code: identify the wow feature (probably the chatbot or surprise-me), draft all stop copy in plain text and get Pam's approval BEFORE touching code, plan to iterate copy 5-10 times per stop after the first ship. Added 2026-04-24 from recipe-app session.
