import type { PlanType, Tenant } from "@/app/types";

export type PlanFeature =
  | "detailed_analytics"
  | "advanced_catalog"
  | "booking_deposits"
  | "storefront_branding"
  | "storefront_contact_form";

export interface PlanDefinition {
  id: PlanType;
  publicId: "beginner" | "pro" | "enterprise";
  name: "Beginner" | "Pro" | "Enterprise";
  price: number;
  monthlyActivityLimit: number | null;
  includedStaffSeats: number;
  maxStaffSeats: number;
  additionalStaffSeatPrice: number;
  description: string;
  shortFeatures: readonly string[];
}

export const PLAN_DEFINITIONS: Record<PlanType, PlanDefinition> = {
  starter: {
    id: "starter",
    publicId: "beginner",
    name: "Beginner",
    price: 9,
    monthlyActivityLimit: 50,
    includedStaffSeats: 0,
    maxStaffSeats: 0,
    additionalStaffSeatPrice: 2,
    description: "The essentials for getting your business online.",
    shortFeatures: [
      "Branded storefront",
      "Up to 50 monthly orders or bookings",
      "1 account total: owner only",
    ],
  },
  pro: {
    id: "pro",
    publicId: "pro",
    name: "Pro",
    price: 12,
    monthlyActivityLimit: 150,
    includedStaffSeats: 1,
    maxStaffSeats: 4,
    additionalStaffSeatPrice: 2,
    description: "Growth tools, analytics, inventory, and booking controls.",
    shortFeatures: [
      "Up to 150 monthly activities",
      "Analytics and advanced controls",
      "Owner + 1 staff included; add up to 3 at $2 BZD each",
      "Maximum 5 accounts total, including owner",
    ],
  },
  enterprise: {
    id: "enterprise",
    publicId: "enterprise",
    name: "Enterprise",
    price: 15,
    monthlyActivityLimit: null,
    includedStaffSeats: 2,
    maxStaffSeats: 9,
    additionalStaffSeatPrice: 2,
    description: "Unlimited activity and priority platform support.",
    shortFeatures: [
      "Unlimited orders or appointments",
      "Priority onboarding and support",
      "Owner + 2 staff included; add up to 7 at $2 BZD each",
      "Maximum 10 accounts total, including owner",
    ],
  },
};

export const PLAN_ORDER: readonly PlanType[] = ["starter", "pro", "enterprise"];

const MINIMUM_PLAN_BY_FEATURE: Record<PlanFeature, PlanType> = {
  detailed_analytics: "pro",
  advanced_catalog: "pro",
  booking_deposits: "pro",
  storefront_branding: "pro",
  storefront_contact_form: "pro",
};

export function planHasFeature(plan: PlanType, feature: PlanFeature) {
  return (
    PLAN_ORDER.indexOf(plan) >=
    PLAN_ORDER.indexOf(MINIMUM_PLAN_BY_FEATURE[feature])
  );
}

export function tenantHasFeature(
  tenant: Pick<Tenant, "plan" | "subscriptionStatus">,
  feature: PlanFeature,
) {
  // The trial is intentionally a full product evaluation. The dashboard layout
  // separately blocks expired trials before any gated component is rendered.
  return (
    tenant.subscriptionStatus === "trial" ||
    planHasFeature(tenant.plan, feature)
  );
}

export function requiredPlanForFeature(feature: PlanFeature) {
  return PLAN_DEFINITIONS[MINIMUM_PLAN_BY_FEATURE[feature]];
}
