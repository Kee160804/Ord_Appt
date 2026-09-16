export const PLATFORM = {
  name: "YuhBusiness",
  currency: "BZD",
  locale: "en-BZ",
  timezone: "America/Belize",
  country: "Belize",
} as const;

const PRODUCTION_APP_ORIGIN = "https://yuhbusiness.com";

function validHttpOrigin(value: string | undefined) {
  if (!value?.trim()) return "";

  try {
    const url = new URL(value.trim());

    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    if (url.username || url.password) return "";

    return url.origin;
  } catch {
    return "";
  }
}

function isLoopbackOrigin(origin: string) {
  if (!origin) return false;

  const hostname = new URL(origin).hostname.toLowerCase();

  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
  );
}

export function publicAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") || "";
}

/**
 * Resolves the canonical origin used in authentication emails. Production
 * never emits localhost links, even if a local value was copied to hosting.
 */
export function publicAppOrigin(fallbackOrigin?: string) {
  const candidates = [
    validHttpOrigin(process.env.NEXT_PUBLIC_APP_URL),
    validHttpOrigin(fallbackOrigin),
  ];

  for (const origin of candidates) {
    if (!origin) continue;
    if (process.env.NODE_ENV === "production" && isLoopbackOrigin(origin)) {
      continue;
    }
    return origin;
  }

  return process.env.NODE_ENV === "production" ? PRODUCTION_APP_ORIGIN : "";
}

/** Builds the allow-listable callback used by signup and recovery emails. */
export function authCallbackUrl(nextPath: string, fallbackOrigin?: string) {
  if (
    !nextPath.startsWith("/") ||
    nextPath.startsWith("//") ||
    nextPath.includes("\\")
  ) {
    throw new Error("Authentication callback requires an internal path.");
  }

  const origin = publicAppOrigin(fallbackOrigin);

  if (!origin) return undefined;

  const callback = new URL("/auth/confirm", origin);
  callback.searchParams.set("next", nextPath);
  return callback.toString();
}

export function storefrontPath(slug: string) {
  return `/store-front/${encodeURIComponent(slug)}`;
}
