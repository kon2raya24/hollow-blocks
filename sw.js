// Offline play: the game's own files (three.js and the sounds included) are cached on install and
// served cache-first; the webfont, the scanned site (assets/env) and the foreman (assets/people, on the
// Vercel deploy) are cached the first time they load. Bump VERSION whenever a file changes.
const VERSION = 'hollowblocks-v22';
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'src/audio.mjs', 'src/blocks.mjs', 'src/bot.mjs', 'src/contracts.mjs', 'src/icons.mjs', 'src/progress.mjs', 'src/toolfx.mjs', 'src/versus.mjs', 'src/replay.mjs', 'src/training.mjs', 'src/rival3d.mjs', 'src/controls.mjs', 'src/inspector3d.mjs', 'src/shop.mjs', 'src/haptics.mjs', 'src/voice.mjs', 'src/themes.mjs', 'src/online.mjs', 'src/pow.mjs', 'src/ads.mjs', 'src/googleads.mjs', 'src/crowd.mjs', 'src/envpack.mjs', 'src/folk.mjs', 'src/foreman.mjs', 'src/fx.mjs', 'src/game.mjs', 'src/main.mjs', 'src/pieces.mjs', 'src/post.mjs', 'src/render.mjs', 'src/rng.mjs', 'src/site.mjs', 'src/tex.mjs', 'src/view3d.mjs',
  'src/vendor/three.module.min.js', 'src/vendor/three-fx.min.js', 'src/vendor/three-mocap.min.js', 'src/vendor/three-extra.min.js',
  'assets/sfx/bell0.mp3', 'assets/sfx/bell1.mp3', 'assets/sfx/bell2.mp3', 'assets/sfx/glass0.mp3', 'assets/sfx/glass1.mp3', 'assets/sfx/glass2.mp3', 'assets/sfx/heavy0.mp3', 'assets/sfx/heavy1.mp3', 'assets/sfx/heavy2.mp3', 'assets/sfx/metal0.mp3',
  'assets/sfx/metal1.mp3', 'assets/sfx/metal2.mp3', 'assets/sfx/mining0.mp3', 'assets/sfx/mining1.mp3', 'assets/sfx/mining2.mp3', 'assets/sfx/plank0.mp3', 'assets/sfx/plank1.mp3', 'assets/sfx/plank2.mp3', 'assets/sfx/plate0.mp3', 'assets/sfx/plate1.mp3',
  'assets/sfx/plate2.mp3', 'assets/sfx/soft0.mp3', 'assets/sfx/soft1.mp3', 'assets/sfx/soft2.mp3', 'assets/sfx/tin0.mp3', 'assets/sfx/tin1.mp3', 'assets/sfx/tin2.mp3', 'assets/sfx/wood0.mp3', 'assets/sfx/wood1.mp3', 'assets/sfx/wood2.mp3',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.includes('/api/')) return; // accounts and boards are always live
  const font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !font) return;
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    const hit = await cache.match(e.request, { ignoreSearch: url.origin === location.origin });
    if (hit) return hit;
    try {
      const res = await fetch(e.request);
      if (res.ok || res.type === 'opaque') cache.put(e.request, res.clone());
      return res;
    } catch {
      return (await cache.match('index.html')) || Response.error();
    }
  }));
});
