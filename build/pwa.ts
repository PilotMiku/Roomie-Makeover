import { PROJECT_NAME } from '../src/data/constants.ts';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';

export function pwaPlugin(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'roomie-offline',
    enforce: 'post',
    apply: 'build',
    configResolved(value) {
      config = value;
    },
    transformIndexHtml() {
      return [
        {
          tag: 'link',
          attrs: {
            rel: 'manifest',
            href: `${config.base}manifest.webmanifest`,
          },
          injectTo: 'head',
        },
      ];
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.webmanifest',
        source: JSON.stringify({
          id: config.base,
          name: `${PROJECT_NAME} · 室友大改造`,
          short_name: '室友大改造',
          lang: 'zh-CN',
          description: '收藏大学寝室里的可爱日常。',
          start_url: `${config.base}#/home`,
          scope: config.base,
          display: 'standalone',
          background_color: '#fff5fa',
          theme_color: '#b83e70',
          icons: [192, 512].map((size) => ({
            src: `${config.base}icons/heart-${size}.png`,
            sizes: `${size}x${size}`,
            type: 'image/png',
            purpose: 'any maskable',
          })),
        }),
      });
    },
    async closeBundle() {
      const directory = resolve(config.root, config.build.outDir);
      const files: string[] = [];
      async function scan(path: string) {
        for (const entry of await readdir(path, { withFileTypes: true })) {
          const target = resolve(path, entry.name);
          if (entry.isDirectory()) await scan(target);
          else if (entry.name !== 'sw.js' && !entry.name.endsWith('.map'))
            files.push(relative(directory, target).replaceAll('\\', '/'));
        }
      }
      await scan(directory);
      files.sort();
      const hash = createHash('sha256');
      for (const file of files) {
        hash.update(file);
        hash.update(await readFile(resolve(directory, file)));
      }
      const urls = files.map((file) => `${config.base}${file}`);
      const source = `/* Generated from this build's local assets. */
const CACHE_PREFIX = ${JSON.stringify(`roomie-offline:${config.base}:`)};
const CACHE_NAME = CACHE_PREFIX + "__ROOMIE_CACHE_REVISION__";
const BASE = ${JSON.stringify(config.base)};
const ASSETS = ${JSON.stringify(urls)};
const ASSET_PATHS = new Set(ASSETS);
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    try { const cache = await caches.open(CACHE_NAME); await cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' }))); }
    catch (error) { await caches.delete(CACHE_NAME); throw error; }
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const pages = (await self.clients.matchAll({ type: 'window', includeUncontrolled: true })).filter(client => {
      const path = new URL(client.url).pathname; return path === BASE || path === BASE + 'index.html';
    });
    // Other open tabs may still need lazy chunks from an older build.
    if (pages.length <= 1) for (const name of await caches.keys()) if (name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME) await caches.delete(name);
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'ACTIVATE_UPDATE') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  if (event.request.mode === 'navigate' && (url.pathname === BASE || url.pathname === BASE + 'index.html')) {
    event.respondWith((async () => (await (await caches.open(CACHE_NAME)).match(BASE + 'index.html')) || fetch(event.request))());
  } else if (ASSET_PATHS.has(url.pathname)) {
    event.respondWith((async () => (await (await caches.open(CACHE_NAME)).match(url.pathname)) || fetch(event.request))());
  } else if (url.pathname.startsWith(BASE + 'assets/')) {
    event.respondWith((async () => {
      for (const name of await caches.keys()) if (name.startsWith(CACHE_PREFIX)) {
        const cached = await (await caches.open(name)).match(url.pathname); if (cached) return cached;
      }
      return fetch(event.request);
    })());
  }
});
`;
      // Worker-only upgrades also need a distinct cache, so a failed install cannot delete the active cache.
      const revision = hash.update(source).digest('hex').slice(0, 16);
      await writeFile(
        resolve(directory, 'sw.js'),
        source.replace('__ROOMIE_CACHE_REVISION__', revision),
      );
    },
  };
}
