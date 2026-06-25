#!/usr/bin/env node
const fs = require('fs').promises;
const path = require('path');

const OUT_DIR = path.resolve(__dirname, '..', 'out');
const BASE = process.env.BASE_URL || 'http://localhost:3000';

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

function urlToFile(urlPath) {
  // If path has an extension (e.g., /robots.txt), keep filename
  const clean = urlPath.replace(/^\//, '');
  if (clean === '' || urlPath === '/' || urlPath.endsWith('/')) {
    return path.join(OUT_DIR, clean, 'index.html');
  }
  if (path.extname(clean)) {
    return path.join(OUT_DIR, clean);
  }
  // No extension: treat as directory and save index.html
  return path.join(OUT_DIR, clean, 'index.html');
}

async function save(urlPath, body) {
  const file = urlToFile(urlPath);
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, body, 'utf8');
  console.log('Saved', file);
}

async function fetchAndSave(route) {
  const url = BASE + route;
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) {
      console.error(`Failed ${url}: ${res.status}`);
      return;
    }
    const text = await res.text();
    await save(route.endsWith('/') ? route : (route.startsWith('/') ? '/' + route : '/' + route), text);
  } catch (err) {
    console.error('Error fetching', url, err.message);
  }
}

async function main() {
  const universePath = path.resolve(__dirname, '..', 'src', 'lib', 'stock', 'universe-data.json');
  const raw = await fs.readFile(universePath, 'utf8');
  const data = JSON.parse(raw);
  const codes = (data.stocks || []).slice(0, 30).map((s) => s.code.toLowerCase());

  const routes = ['/', '/learn', '/stock', '/robots.txt'];
  for (const r of routes) await fetchAndSave(r);

  for (const code of codes) {
    const route = `/stock/${code}`;
    await fetchAndSave(route);
  }

  console.log('Snapshot complete. Output directory:', OUT_DIR);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
