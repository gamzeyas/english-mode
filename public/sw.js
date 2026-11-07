// English Mode service worker (PRD §16 Milestone 5).
//
// Caching strategy, privacy first:
// - Never cache pages or API responses: they contain the learner's data.
// - Cache-first for immutable build assets (/_next/static) and app icons.
// - When a page navigation fails because the network is down, show the
//   static offline page instead of the browser error.
//
// Push (Milestone 8b): shows the reminder the server sent and opens the app
// on tap. Payloads are JSON {title, body, url} with a same-origin path.
const VERSION = "v1";
const STATIC_CACHE = `english-mode-static-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [
  OFFLINE_URL,
  "/manifest-assets/icon.svg",
  "/manifest-assets/icon-192.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith("english-mode-") && key !== STATIC_CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(STATIC_CACHE);
        return (await cache.match(OFFLINE_URL)) ?? Response.error();
      }),
    );
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/manifest-assets/")
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
  }
});

self.addEventListener("push", (event) => {
  let message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch {
    message = { body: event.data ? event.data.text() : "" };
  }
  const url =
    typeof message.url === "string" && message.url.startsWith("/")
      ? message.url
      : "/dashboard";
  event.waitUntil(
    self.registration.showNotification(message.title || "English Mode", {
      body: message.body || "",
      icon: "/manifest-assets/icon-192.png",
      badge: "/manifest-assets/icon-192.png",
      tag: "english-mode-reminder",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(
    event.notification.data?.url || "/dashboard",
    self.location.origin,
  ).href;
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => {
        const open = windows.find((w) =>
          w.url.startsWith(self.location.origin),
        );
        if (open) return open.navigate(url).then((w) => (w ?? open).focus());
        return self.clients.openWindow(url);
      }),
  );
});
