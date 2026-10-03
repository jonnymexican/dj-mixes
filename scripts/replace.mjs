#!/usr/bin/env node
/**
 * Replace an asset on an existing release — delete + re-upload in one step.
 *
 *   node scripts/replace.mjs <tag> <file>
 *   node scripts/replace.mjs basement-mix-02 ./sets/basement-mix-02.mp3
 *
 * The remote asset is matched by the local file's name. Title, body, and
 * every other asset on the release are left alone.
 */
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';

const REPO = 'jonnymexican/dj-mixes';
const API = `https://api.github.com/repos/${REPO}`;
const UPLOADS = `https://uploads.github.com/repos/${REPO}/releases`;
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

const [tag, fileArg] = process.argv.slice(2);
if (!tag || !fileArg || !/^[A-Za-z0-9._-]+$/.test(tag)) {
  console.error('Usage: node scripts/replace.mjs <tag> <file>  — swaps the asset named after <file>');
  process.exit(1);
}
const file = resolve(fileArg);
const name = basename(file);
if (!existsSync(file)) {
  console.error(`File not found: ${file}`);
  process.exit(1);
}
const size = statSync(file).size;
if (size > TWO_GB) {
  console.error(`${name} is over GitHub's 2 GB asset limit — split or re-encode first.`);
  process.exit(1);
}

// The release this asset lives on.
const findRes = await fetch(`${API}/releases/tags/${encodeURIComponent(tag)}`, { headers: auth });
if (findRes.status === 404) {
  console.error(`No release for tag "${tag}" — nothing to replace.`);
  process.exit(1);
}
if (!findRes.ok) {
  console.error(`Release lookup failed: ${findRes.status} ${await findRes.text()}`);
  process.exit(1);
}
const release = await findRes.json();

const listRes = await fetch(`${API}/releases/${release.id}/assets?per_page=100`, { headers: auth });
const assets = listRes.ok ? await listRes.json() : [];
const old = assets.find((a) => a.name === name);
if (!old) {
  console.error(`No asset named "${name}" on "${tag}" — use upload.mjs to add it as a new file.`);
  process.exit(1);
}

process.stdout.write(`↓ deleting old "${name}" (${(old.size / 1e6).toFixed(1)} MB)… `);
const delRes = await fetch(`${API}/releases/assets/${old.id}`, { method: 'DELETE', headers: auth });
if (delRes.status !== 204) {
  console.error(`\nCould not delete the old asset (${delRes.status}) — nothing changed.`);
  process.exit(1);
}
console.log('gone');

process.stdout.write(`↑ uploading "${name}" (${(size / 1e6).toFixed(1)} MB)… `);
const res = await fetch(
  `${UPLOADS}/${release.id}/assets?name=${encodeURIComponent(name)}`,
  {
    method: 'POST',
    headers: {
      authorization: `token ${TOKEN}`,
      'content-type': 'application/octet-stream',
      'content-length': String(size),
      'user-agent': 'dj-mixes-upload',
    },
    // Stream straight from disk, same as upload.mjs (ENOBUFS safety).
    body: Readable.toWeb(createReadStream(file)),
    duplex: 'half',
  }
);
if (res.status === 201) console.log('done — swapped.');
else console.log(`FAILED (${res.status}) ${await res.text()}`);
