const VERSION = "carnet-edumas-v10";
const SHELL = [
  "/carnet/index.html",
  "/carnet/manifest.webmanifest",
  "/assets/base.css",
  "/assets/config.js",
  "/assets/api.js",
  "/assets/qrcode.js",
  "/assets/draw.js",
  "/assets/carnet.js",
  "/assets/tpl-front.jpg",
  "/assets/tpl-back.jpg",
  "/assets/tpl-planta-front.jpg",
  "/assets/tpl-planta-back.jpg",
  "/assets/banner.jpg",
  "/assets/icon-180.png",
  "/assets/icon-192.png",
  "/assets/icon-512.png",
  "/assets/fonts/montserrat-400.woff2",
  "/assets/fonts/montserrat-600.woff2",
  "/assets/fonts/montserrat-800.woff2",
  "/assets/fonts/unbounded-400.woff2",
  "/assets/fonts/unbounded-700.woff2"
];

self.addEventListener("install", ev => {
  ev.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", ev => {
  ev.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(req, fallbackKey) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req.url, { cache: "no-cache", credentials: "same-origin" });
    if (res && res.ok) cache.put(fallbackKey, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(fallbackKey);
    if (hit) return hit;
    throw e;
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req.url, { ignoreSearch: true });
  const net = fetch(req.url, { cache: "no-cache", credentials: "same-origin" }).then(res => {
    if (res && res.ok) cache.put(req.url, res.clone());
    return res;
  }).catch(() => null);
  if (hit) return hit;
  const res = await net;
  if (res) return res;
  return new Response("", { status: 504 });
}

self.addEventListener("fetch", ev => {
  const req = ev.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/c/")) {
    if (url.pathname.endsWith("/manifest.webmanifest")) ev.respondWith(networkFirst(req, "/carnet/manifest.webmanifest"));
    else ev.respondWith(networkFirst(req, "/carnet/index.html"));
    return;
  }
  if (url.pathname.startsWith("/assets/")) {
    if (/\.(js|css)$/.test(url.pathname)) ev.respondWith(networkFirst(req, url.pathname));
    else ev.respondWith(staleWhileRevalidate(req));
  }
});
