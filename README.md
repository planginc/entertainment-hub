# Entertainment Hub

Pam's personal entertainment tracker. Tracks movies, TV series, limited series, and audiobooks across all platforms.

Live: https://pams-entertainment-hub.netlify.app

## Setup

No build step. Static HTML/CSS/JS.

```bash
# Open locally
open index.html

# Deploy to production (git push does NOT auto-deploy -- manual CLI required)
npx netlify-cli deploy --prod
```

## Stack

- Vanilla JS, no framework, no build tools
- Convex database: `https://exuberant-lapwing-294.convex.site/api/entertainment`
- Netlify hosting (manual deploy via CLI)

## Adding items

Use JJ (Telegram) -- say "add X to my watch list" and JJ routes it to the entertainment table,
auto-fetches poster, trailer key, and TMDB metadata on insert.

## Key files

| File | Purpose |
|------|---------|
| `index.html` | Shell, tab structure |
| `app.js` | All app logic -- data fetch, rendering, search, modals |
| `style.css` | All styling |
| `backfill-posters.mjs` | One-off script: backfill posterUrl for items missing it |
| `backfill-trailers.mjs` | One-off script: backfill trailerKey for items missing it |

## Convex project ID

`kd7eqg7xj0qd8zkqp523eqnjr183f6zc`
