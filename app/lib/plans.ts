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
    description: "The essentials for getting your business online.",
    shortFeatures: ["Branded storefront", "Up to 50 monthly orders or bookings"],
  },
  pro: {
    id: "pro",
    publicId: "pro",
    name: "Pro",
    price: 12,
    monthlyActivityLimit: 150,
    description: "Growth tools, analytics, inventory, and booking controls.",
    shortFeatures: ["Up to 150 monthly activities", "Analytics and advanced controls"],
  },
  enterprise: {
    id: "enterprise",
    publicId: "enterprise",
    name: "Enterprise",
    price: 16,
    monthlyActivityLimit: null,
    description: "Unlimited activity and priority platform support.",
    shortFeatures: ["Unlimited orders or appointments", "Priority onboarding and support"],
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
  return PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(MINIMUM_PLAN_BY_FEATURE[feature]);
}

export function tenantHasFeature(
  tenant: Pick<Tenant, "plan" | "subscriptionStatus">,
  feature: PlanFeature,
) {
  // The trial is intentionally a full product evaluation. The dashboard layout
  // separately blocks expired trials before any gated component is rendered.
  return tenant.subscriptionStatus === "trial" || planHasFeature(tenant.plan, feature);
}

export function requiredPlanForFeature(feature: PlanFeature) {
  return PLAN_DEFINITIONS[MINIMUM_PLAN_BY_FEATURE[feature]];
}
