export const PLATFORM = {
  name: "YuhBusiness",
  currency: "BZD",
  locale: "en-BZ",
  timezone: "America/Belize",
  country: "Belize",
} as const;

export function publicAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") || "";
}

export function storefrontPath(slug: string) {
  return `/store-front/${encodeURIComponent(slug)}`;
}
