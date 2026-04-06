#!/usr/bin/env python3
"""
Enrich entertainment items missing TMDB data.
Fetches: posterUrl, tmdbId, trailerKey, overview, vote_average, genres
Updates via /api/entertainment/update

Usage: python3 enrich_tmdb.py
"""

import json, time, re, urllib.request, urllib.parse

TMDB_KEY = "0136b6f5cc0b98bd271be57ee99b3888"
BASE_URL = "https://exuberant-lapwing-294.convex.site/api/entertainment"
USERS = [
    ("Pam",   "6285585111"),
    ("Lori",  "lori-entertainment"),
    ("Karen", "karen-entertainment"),
]

# Episode pattern -- skip "S1E1 - Title" style items
EPISODE_RE = re.compile(r'^S\d+E\d+', re.IGNORECASE)


def tmdb_get(path):
    sep = "&" if "?" in path else "?"
    url = f"https://api.themoviedb.org/3{path}{sep}api_key={TMDB_KEY}"
    try:
        with urllib.request.urlopen(url, timeout=10) as r:
            return json.loads(r.read())
    except Exception as e:
        print(f"    TMDB error {path}: {e}")
        return None


def fetch_genre_map():
    """Returns {id: name} for both movie and TV genres."""
    genres = {}
    for kind in ("movie", "tv"):
        data = tmdb_get(f"/genre/{kind}/list")
        if data:
            for g in data.get("genre_list", data.get("genres", [])):
                genres[g["id"]] = g["name"]
    return genres


def get_items(user_id):
    url = f"{BASE_URL}?userTelegramId={urllib.parse.quote(user_id)}&limit=500"
    with urllib.request.urlopen(url, timeout=15) as r:
        data = json.loads(r.read())
    return data.get("items", data) if isinstance(data, dict) else data


def update_item(item_id, payload):
    body = json.dumps({"id": item_id, **payload}).encode()
    req = urllib.request.Request(
        f"{BASE_URL}/update",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())


def enrich_item(item, genre_map):
    title = item["title"]
    media_type = item.get("media_type", "movie")
    item_id = item["id"]

    # Skip audiobooks -- not on TMDB
    if media_type == "audiobook":
        return None

    # Skip individual episode entries
    if EPISODE_RE.match(title):
        print(f"    skipping episode: {title}")
        return None

    tmdb_type = "tv" if media_type in ("series", "limited_series") else "movie"

    # Search TMDB
    search = tmdb_get(f"/search/{tmdb_type}?query={urllib.parse.quote(title)}&page=1")
    if not search or not search.get("results"):
        print(f"    not found on TMDB: {title}")
        return None

    first = search["results"][0]
    tmdb_id = first.get("id")
    poster_path = first.get("poster_path")
    overview = first.get("overview") or ""
    vote_avg = first.get("vote_average")
    genre_ids = first.get("genre_ids", [])

    if not tmdb_id:
        print(f"    no TMDB id for: {title}")
        return None

    # Poster URL
    poster_url = f"https://image.tmdb.org/t/p/w300{poster_path}" if poster_path else None

    # Trailer
    trailer_key = None
    videos = tmdb_get(f"/{tmdb_type}/{tmdb_id}/videos")
    if videos:
        trailer = next(
            (v for v in videos.get("results", [])
             if v.get("site") == "YouTube" and v.get("type") == "Trailer"),
            None
        )
        if trailer:
            trailer_key = trailer["key"]

    # Genres
    genre_names = [genre_map[gid] for gid in genre_ids if gid in genre_map]
    genre_str = ", ".join(genre_names) if genre_names else None

    # Notes: "Scores: TMDB: X.X\n\n{overview}"
    notes = None
    if vote_avg or overview:
        score_part = f"Scores: TMDB: {vote_avg:.1f}" if vote_avg else None
        notes = "\n\n".join(filter(None, [score_part, overview])) or None

    # Build metadata
    metadata = {}
    if poster_url:
        metadata["posterUrl"] = poster_url
    if tmdb_id:
        metadata["tmdbId"] = tmdb_id
    if trailer_key:
        metadata["trailerKey"] = trailer_key

    payload = {}
    if metadata:
        payload["metadata"] = metadata
    if notes:
        payload["notes"] = notes
    if genre_str:
        payload["genre"] = genre_str

    return payload


def main():
    print("Fetching TMDB genre map...")
    genre_map = fetch_genre_map()
    print(f"  Loaded {len(genre_map)} genres\n")

    total_updated = 0
    total_skipped = 0
    total_not_found = 0

    for label, user_id in USERS:
        print(f"=== {label} ({user_id}) ===")
        items = get_items(user_id)
        want = [i for i in items if i.get("status") == "want"]
        missing = [i for i in want if not (i.get("metadata") or {}).get("tmdbId")]
        non_audio = [i for i in missing if i.get("media_type") != "audiobook"]
        print(f"  want: {len(want)}, missing TMDB: {len(missing)}, non-audiobook: {len(non_audio)}\n")

        for item in non_audio:
            title = item["title"]
            print(f"  [{item.get('media_type')}] {title}")
            try:
                payload = enrich_item(item, genre_map)
                if payload is None:
                    total_skipped += 1
                    continue
                update_item(item["id"], payload)
                parts = []
                if "metadata" in payload:
                    m = payload["metadata"]
                    parts.append(f"poster={'yes' if m.get('posterUrl') else 'no'}")
                    parts.append(f"trailer={'yes' if m.get('trailerKey') else 'no'}")
                    parts.append(f"tmdbId={m.get('tmdbId')}")
                if "genre" in payload:
                    parts.append(f"genre={payload['genre']}")
                print(f"    -> updated: {', '.join(parts)}")
                total_updated += 1
                time.sleep(0.25)  # be polite to TMDB
            except Exception as e:
                print(f"    ERROR: {e}")
                total_skipped += 1

        print()

    print(f"Done. Updated: {total_updated}, Skipped/not found: {total_skipped}")


if __name__ == "__main__":
    main()
