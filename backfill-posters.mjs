#!/usr/bin/env node
// One-time script: fetch TMDB poster URLs for existing entertainment records
// Usage: TMDB_API_KEY=xxxx node backfill-posters.mjs

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const CONVEX_SITE = 'https://exuberant-lapwing-294.convex.site';
const USER_TELEGRAM_ID = '6285585111';

if (!TMDB_API_KEY) {
  console.error('TMDB_API_KEY env var required');
  process.exit(1);
}

async function fetchAllItems() {
  const res = await fetch(`${CONVEX_SITE}/api/entertainment?userTelegramId=${USER_TELEGRAM_ID}&limit=1000`);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return res.json();
}

async function fetchPoster(title, mediaType) {
  if (mediaType === 'audiobook') return null;
  const isTV = mediaType === 'series' || mediaType === 'limited_series';
  const type = isTV ? 'tv' : 'movie';
  const url = `https://api.themoviedb.org/3/search/${type}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&page=1`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const posterPath = data.results?.[0]?.poster_path;
  return posterPath ? `https://image.tmdb.org/t/p/w300${posterPath}` : null;
}

async function updateItem(id, posterUrl, existingMetadata) {
  const metadata = { ...(existingMetadata || {}), posterUrl };
  const res = await fetch(`${CONVEX_SITE}/api/entertainment/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, metadata }),
  });
  return res.ok;
}

async function main() {
  console.log('Fetching all entertainment records...');
  const items = await fetchAllItems();
  console.log(`Found ${items.length} records`);

  const missing = items.filter(d => !d.metadata?.posterUrl && d.media_type !== 'audiobook');
  console.log(`${missing.length} need posters (${items.length - missing.length} already have one or are audiobooks)\n`);

  let success = 0, notFound = 0, errors = 0;

  for (const item of missing) {
    const posterUrl = await fetchPoster(item.title, item.media_type);
    if (posterUrl) {
      const ok = await updateItem(item.id, posterUrl, item.metadata);
      if (ok) {
        console.log(`✓ ${item.title}`);
        success++;
      } else {
        console.log(`✗ update failed: ${item.title}`);
        errors++;
      }
    } else {
      console.log(`- no poster: ${item.title}`);
      notFound++;
    }
    // Rate limit: TMDB allows 50 req/s, stay safe
    await new Promise(r => setTimeout(r, 50));
  }

  console.log(`\nDone. ${success} updated, ${notFound} not found on TMDB, ${errors} errors`);
}

main().catch(console.error);
