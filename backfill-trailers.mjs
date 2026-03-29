#!/usr/bin/env node
// One-time script: fetch TMDB trailer keys for existing entertainment records
// Usage: TMDB_API_KEY=xxxx node backfill-trailers.mjs

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

async function fetchTrailer(title, mediaType, existingTmdbId) {
  const isTV = mediaType === 'series' || mediaType === 'limited_series';
  const type = isTV ? 'tv' : 'movie';

  let tmdbId = existingTmdbId;
  if (!tmdbId) {
    const res = await fetch(`https://api.themoviedb.org/3/search/${type}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&page=1`);
    if (!res.ok) return null;
    const data = await res.json();
    tmdbId = data.results?.[0]?.id;
  }

  if (!tmdbId) return null;

  const res = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}/videos?api_key=${TMDB_API_KEY}`);
  if (!res.ok) return null;
  const data = await res.json();
  const trailer = data.results?.find(v => v.site === 'YouTube' && v.type === 'Trailer');
  return trailer ? { tmdbId, trailerKey: trailer.key } : { tmdbId, trailerKey: null };
}

async function updateItem(id, updates, existingMetadata) {
  const metadata = { ...(existingMetadata || {}), ...updates };
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

  const needsTrailer = items.filter(d =>
    d.media_type !== 'audiobook' && !d.metadata?.trailerKey
  );
  console.log(`${needsTrailer.length} records need trailer lookup (${items.length - needsTrailer.length} already have one or are audiobooks)\n`);

  let success = 0, notFound = 0, errors = 0;

  for (const item of needsTrailer) {
    const result = await fetchTrailer(item.title, item.media_type, item.metadata?.tmdbId);
    if (result?.trailerKey) {
      const updates = { trailerKey: result.trailerKey };
      if (!item.metadata?.tmdbId && result.tmdbId) updates.tmdbId = result.tmdbId;
      const ok = await updateItem(item.id, updates, item.metadata);
      if (ok) {
        console.log(`✓ ${item.title}`);
        success++;
      } else {
        console.log(`✗ update failed: ${item.title}`);
        errors++;
      }
    } else {
      console.log(`- no trailer: ${item.title}`);
      notFound++;
    }
    await new Promise(r => setTimeout(r, 75));
  }

  console.log(`\nDone. ${success} trailers added, ${notFound} not found, ${errors} errors`);
}

main().catch(console.error);
