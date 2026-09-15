import type { SocialLinks } from "@/app/types";

const SOCIAL_KEYS = ["instagram", "facebook", "twitter", "website"] as const;

export function parseSocialLinks(value: unknown): SocialLinks {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  return Object.fromEntries(
    SOCIAL_KEYS.map((key) => [key, source[key]])
      .filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      )
      .map(([key, link]) => [key, link.trim()])
      .filter(([, link]) => link.length > 0),
  );
}

export function cleanSocialLinks(value: SocialLinks): SocialLinks {
  return parseSocialLinks(value);
}
