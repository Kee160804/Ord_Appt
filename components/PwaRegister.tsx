"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    // A development worker can outlive `next dev` and make localhost serve
    // stale production responses. Keep service workers production-only and
    // clean up any worker/cache left behind by an earlier local build. Wait
    // until the initial document has loaded so this cleanup cannot compete
    // with App Router initialization or hydration.
    if (process.env.NODE_ENV !== "production") {
      const clearDevelopmentPwaState = async () => {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations.map((registration) => registration.unregister()),
        );

        if ("caches" in window) {
          const cacheNames = await caches.keys();
          await Promise.all(
            cacheNames
              .filter((name) => name.startsWith("yuhbusiness-"))
              .map((name) => caches.delete(name)),
          );
        }
      };

      const handleDevelopmentLoad = () => {
        void clearDevelopmentPwaState().catch((error) => {
          console.warn("Unable to clear local PWA state:", error);
        });
      };

      if (document.readyState === "complete") {
        handleDevelopmentLoad();
      } else {
        window.addEventListener("load", handleDevelopmentLoad, { once: true });
      }

      return () => {
        window.removeEventListener("load", handleDevelopmentLoad);
      };
    }

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          updateViaCache: "none",
        });
        if (navigator.onLine) {
          await registration.update();
        }
      } catch (error) {
        console.warn("Service worker registration failed:", error);
      }
    };

    const handleLoad = () => void registerServiceWorker();
    const handleOnline = () => void registerServiceWorker();

    if (document.readyState === "complete") {
      handleLoad();
    } else {
      window.addEventListener("load", handleLoad, { once: true });
    }
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("load", handleLoad);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return null;
}
