const CACHE_PREFIX = "yuhbusiness-";
const CACHE_NAME = `${CACHE_PREFIX}offline-v6`;
const OFFLINE_PAGE = "/offline.html";

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
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      );

      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }

      // Take control without forcibly navigating open pages. Reloading every
      // client during deployment can turn a brief network handoff into the
      // offline fallback even when the device itself is online.
      await self.clients.claim();
    })(),
  );
});

async function fetchNavigation(event) {
  try {
    const preloadedResponse = await event.preloadResponse;
    if (preloadedResponse) return preloadedResponse;
    return await fetch(event.request);
  } catch {
    // Online transitions and deployment handoffs can fail one navigation
    // request without the device actually being offline. Retry once while the
    // browser still reports a connection before showing the fallback page.
    if (self.navigator.onLine !== false) {
      try {
        return await fetch(event.request, { cache: "reload" });
      } catch {
        // The recovery page below will continue checking connectivity.
      }
    }

    const offlineResponse = await caches.match(OFFLINE_PAGE);
    return offlineResponse ?? Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin || request.mode !== "navigate")
    return;

  event.respondWith(fetchNavigation(event));
});
