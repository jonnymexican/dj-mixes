# dj-mixes — the DJ archive

Your old mixes live here as **GitHub Release assets** — no payment method, no size
games, no git history bloat. A release = a "mixtape"; each audio file attached to it
is one mix. The fleet player page lists everything automatically:

**▶ Player: https://jonnymexican.github.io/test/djmixes/**

## Uploading (one-time setup, then one command)

```bash
# once per machine: borrow your existing GitHub login into secrets.token (gitignored)
node scripts/token.mjs

# put some mixes in a folder, then:
node scripts/upload.mjs attic-sessions-2026 ./sets
```

That's it. The tag becomes the player's title (dashes/underscores → spaces:
`attic-sessions-2026` → "attic sessions 2026"), every mp3/wav/flac/m4a/ogg/aiff in the
folder becomes an asset, and re-running with the same tag **adds** more files to that
release instead of duplicating.

Drop a `tracklist.txt` in the folder and it becomes the release's body — the player
page shows it as a collapsible 📋 Tracklist. Edit the file and re-run the same
command to update it.

Botched an upload? Swap a file in one step (deletes the matching asset, re-uploads
the local one):

```bash
node scripts/replace.mjs attic-sessions-2026 ./sets/side-b.mp3
```

Need a token by hand instead? Paste any repo-scoped token into `secrets.token`
(next to this README), or export `GH_TOKEN` before running the upload.

## Notes

- Assets cap at **2 GB each** — a two-hour 320 kbps MP3 is ~280 MB, so you're fine.
  Bigger files: split or re-encode first.
- Uploads don't touch git (no LFS, no history growth) — the repo itself only holds
  these scripts.
- The repo is **public** because the player reads it anonymously. Don't upload sets
  you wouldn't broadcast.
- MP3 is the safest format for browser playback; FLAC/OGG/WAV work in Chrome/Edge
  but not everywhere.
- Player page source lives in the main fleet repo (`public/djmixes/`).
