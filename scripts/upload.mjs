#!/usr/bin/env node
/**
 * Upload a folder of mixes as a GitHub Release.
 *
 *   node scripts/token.mjs          # once per machine — borrows your git login
 *   node scripts/upload.mjs <tag> [folder]
 *   node scripts/upload.mjs attic-sessions-oct-2026 ./sets
 *
 * - Every audio file in the folder (mp3/wav/flac/m4a/ogg/aiff) becomes one
 *   release asset. Tag = release id; a second run with the same tag ADDS
 *   files to that release.
 * - The tag becomes the player's title: dashes/underscores become spaces.
 *   "attic-sessions-oct-2026" → "attic sessions oct 2026". Pick readable tags.
 * - GitHub caps assets at 2 GB each; this script refuses bigger ones.
 * - The player page (jonnymexican.github.io/test/djmixes/) lists every
 *   release automatically — nothing else to update.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = 'jonnymexican/dj-mixes';
const API = `https://api.github.com/repos/${REPO}`;
const UPLOADS = `https://uploads.github.com/repos/${REPO}/releases`;
const AUDIO_EXT = /\.(mp3|wav|flac|m4a|ogg|aiff|aif)$/i;
const TWO_GB = 2 * 1024 ** 3;

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

function readToken() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN.trim();
  const p = join(root, 'secrets.token');
  if (existsSync(p)) return readFileSync(p, 'utf8').trim();
  console.error('No token found. Run:  node scripts/token.mjs   (or set GH_TOKEN)');
  process.exit(1);
}

const TOKEN = readToken();
const auth = {
  authorization: `token ${TOKEN}`,
  accept: 'application/vnd.github+json',
  'user-agent': 'dj-mixes-upload',
};

const [tag, folderArg] = process.argv.slice(2);
if (!tag || !/^[A-Za-z0-9._-]+$/.test(tag)) {
  console.error('Usage: node scripts/upload.mjs <tag> [folder]  — tag: letters, digits, dot, dash, underscore');
  process.exit(1);
}
const folder = resolve(folderArg || './sets');
if (!existsSync(folder)) {
  console.error(`Folder not found: ${folder}`);
  process.exit(1);
}

const files = readdirSync(folder)
  .filter((f) => AUDIO_EXT.test(f))
  .sort();
if (files.length === 0) {
  console.error(`No audio files (mp3/wav/flac/m4a/ogg/aiff) in ${folder}`);
  process.exit(1);
}

const title = tag.replace(/[-_]+/g, ' ');
console.log(`${files.length} file(s) → release "${title}" (${tag})`);

// Find or create the release for this tag.
let release;
const findRes = await fetch(`${API}/releases/tags/${encodeURIComponent(tag)}`, { headers: auth });
if (findRes.status === 200) {
  release = await findRes.json();
  console.log('Release exists — adding to it.');
} else if (findRes.status === 404) {
  const createRes = await fetch(`${API}/releases`, {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({ tag_name: tag, name: title, body: `DJ mixes — ${title}` }),
  });
  if (!createRes.ok) {
    console.error(`Could not create release: ${createRes.status} ${await createRes.text()}`);
    process.exit(1);
  }
  release = await createRes.json();
  console.log('Release created.');
} else {
  console.error(`Release lookup failed: ${findRes.status} ${await findRes.text()}`);
  process.exit(1);
}

const existing = new Set();
const listRes = await fetch(`${API}/releases/${release.id}/assets?per_page=100`, { headers: auth });
if (listRes.ok) {
  for (const a of await listRes.json()) existing.add(a.name);
}

let uploaded = 0;
for (const file of files) {
  const path = join(folder, file);
  const size = statSync(path).size;
  if (size > TWO_GB) {
    console.log(`SKIP ${file} — over GitHub's 2 GB asset limit (split it first)`);
    continue;
  }
  if (existing.has(file)) {
    console.log(`SKIP ${file} — already attached (delete it on github.com first to replace)`);
    continue;
  }
  process.stdout.write(`↑ ${file} (${(size / 1e6).toFixed(1)} MB)… `);
  const res = await fetch(
    `${UPLOADS}/${release.id}/assets?name=${encodeURIComponent(file)}`,
    {
      method: 'POST',
      headers: {
        authorization: `token ${TOKEN}`,
        'content-type': 'application/octet-stream',
        'content-length': String(size),
        'user-agent': 'dj-mixes-upload',
      },
      body: readFileSync(path),
    }
  );
  if (res.status === 201) {
    uploaded += 1;
    console.log('done');
  } else {
    console.log(`FAILED (${res.status}) ${await res.text()}`);
  }
}

console.log(
  `\n${uploaded}/${files.length} uploaded. ` +
    'They appear at https://jonnymexican.github.io/test/djmixes/ on the next page load.'
);
