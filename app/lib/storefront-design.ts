import type {
  BusinessType,
  SocialPlatform,
  StorefrontDesign,
} from "@/app/types";

export const STOREFRONT_SOCIAL_PLATFORMS: SocialPlatform[] = [
  "instagram",
  "facebook",
  "tiktok",
  "whatsapp",
  "youtube",
  "twitter",
];

export const DEFAULT_STOREFRONT_SECTIONS: StorefrontDesign["sections"] = {
  hero: true,
  search: true,
  categories: true,
  promotions: true,
  featured: true,
  reviews: true,
  about: true,
  contact: true,
};

export function defaultStorefrontDesign(
  businessType: BusinessType,
): StorefrontDesign {
  const appointment = businessType === "appointment";
  const retail = businessType === "retail";
  return {
    heroHeading: appointment
      ? "Look Good"
      : retail
        ? "Fresh Styles"
        : "Good Food",
    heroAccent: appointment
      ? "Feel Amazing"
      : retail
        ? "For Every You"
        : "Together",
    heroSubheading: "",
    heroCtaLabel: appointment ? "Book Now" : "Shop Now",
    contactEyebrow: "Get in touch",
    contactHeading: "We'd love to",
    contactAccent: "Hear from you",
    contactDescription:
      "Have a question, feedback, or need support? Our team is here to help. Reach out anytime and we'll get back to you as soon as possible.",
    contactResponseText: "We reply within 24 hours",
    contactSupportText: "",
    contactTrustText: "Local support from a team that cares",
    contactMapUrl: "",
    visibleSocials: [...STOREFRONT_SOCIAL_PLATFORMS],
    heroAlignment: "left",
    heroStyle: "balanced",
    backgroundStyle: "dark",
    sections: { ...DEFAULT_STOREFRONT_SECTIONS },
  };
}

export function parseStorefrontDesign(
  value: unknown,
  businessType: BusinessType,
): StorefrontDesign {
  const fallback = defaultStorefrontDesign(businessType);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }
  const record = value as Record<string, unknown>;
  const sections =
    record.sections &&
    typeof record.sections === "object" &&
    !Array.isArray(record.sections)
      ? (record.sections as Record<string, unknown>)
      : {};
  const text = (key: string, defaultValue: string, max: number) =>
    typeof record[key] === "string"
      ? String(record[key]).slice(0, max)
      : defaultValue;
  return {
    heroHeading: text("heroHeading", fallback.heroHeading, 80),
    heroAccent: text("heroAccent", fallback.heroAccent, 80),
    heroSubheading: text("heroSubheading", fallback.heroSubheading, 180),
    heroCtaLabel: text("heroCtaLabel", fallback.heroCtaLabel, 30),
    contactEyebrow: text("contactEyebrow", fallback.contactEyebrow, 50),
    contactHeading: text("contactHeading", fallback.contactHeading, 80),
    contactAccent: text("contactAccent", fallback.contactAccent, 80),
    contactDescription: text(
      "contactDescription",
      fallback.contactDescription,
      240,
    ),
    contactResponseText: text(
      "contactResponseText",
      fallback.contactResponseText,
      80,
    ),
    contactSupportText: text(
      "contactSupportText",
      fallback.contactSupportText,
      80,
    ),
    contactTrustText: text("contactTrustText", fallback.contactTrustText, 80),
    contactMapUrl: text("contactMapUrl", fallback.contactMapUrl, 500),
    visibleSocials: Array.isArray(record.visibleSocials)
      ? record.visibleSocials.filter(
          (value): value is SocialPlatform =>
            typeof value === "string" &&
            STOREFRONT_SOCIAL_PLATFORMS.includes(value as SocialPlatform),
        )
      : fallback.visibleSocials,
    heroAlignment:
      record.heroAlignment === "center" || record.heroAlignment === "right"
        ? record.heroAlignment
        : "left",
    heroStyle:
      record.heroStyle === "full" || record.heroStyle === "close-up"
        ? record.heroStyle
        : "balanced",
    backgroundStyle:
      record.backgroundStyle === "light" ||
      record.backgroundStyle === "gradient"
        ? record.backgroundStyle
        : "dark",
    sections: Object.fromEntries(
      Object.entries(fallback.sections).map(([key, enabled]) => [
        key,
        typeof sections[key] === "boolean" ? sections[key] : enabled,
      ]),
    ) as StorefrontDesign["sections"],
  };
}
