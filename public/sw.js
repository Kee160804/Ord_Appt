const CACHE_NAME = "yuhbusiness-offline-v3";
const OFFLINE_PAGE = "/home";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.add(OFFLINE_PAGE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(async () => {
        await self.clients.claim();

        // Refresh pages still controlled by the old cache-first worker so
        // returning mobile browsers receive the current Vercel deployment.
        const windowClients = await self.clients.matchAll({ type: "window" });
        await Promise.all(
          windowClients.map((client) =>
            client.navigate(client.url).catch(() => undefined),
          ),
        );
      }),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin || request.mode !== "navigate") return;

  event.respondWith(
    fetch(request).catch(async () => {
      const offlineResponse = await caches.match(OFFLINE_PAGE);
      return offlineResponse ?? Response.error();
    }),
  );
});
