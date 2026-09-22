import type { PlanType, Tenant } from "@/app/types";
import {
  PLAN_CATALOG,
  PLAN_ORDER as CATALOG_PLAN_ORDER,
  PREMIUM_FEATURES,
  TRIAL_ENTITLEMENTS,
  approximateDailyPrice,
  calculateSubscriptionAmounts,
  validateSubscriptionSeatSelection,
} from "@/app/lib/plan-catalog.mjs";

export type PlanFeature =
  | "detailed_analytics"
  | "advanced_catalog"
  | "product_variants"
  | "booking_deposits"
  | "storefront_branding"
  | "storefront_contact_form"
  | "team_management";

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

export const PLAN_DEFINITIONS: Readonly<Record<PlanType, PlanDefinition>> =
  PLAN_CATALOG;

export const PLAN_ORDER: readonly PlanType[] =
  CATALOG_PLAN_ORDER as readonly PlanType[];
export {
  TRIAL_ENTITLEMENTS,
  approximateDailyPrice,
  calculateSubscriptionAmounts,
  validateSubscriptionSeatSelection,
};

const MINIMUM_PLAN_BY_FEATURE: Record<PlanFeature, PlanType> = {
  detailed_analytics: "pro",
  advanced_catalog: "pro",
  product_variants: "pro",
  booking_deposits: "pro",
  storefront_branding: "pro",
  storefront_contact_form: "pro",
  team_management: "pro",
};

export function planHasFeature(plan: PlanType, feature: PlanFeature) {
  return (
    PLAN_ORDER.indexOf(plan) >=
    PLAN_ORDER.indexOf(MINIMUM_PLAN_BY_FEATURE[feature])
  );
}

export function tenantHasFeature(
  tenant: Pick<
    Tenant,
    | "plan"
    | "subscriptionStatus"
    | "trialEndsAt"
    | "createdAt"
    | "currentPeriodEnd"
  >,
  feature: PlanFeature,
  now: Date = new Date(),
) {
  const explicitEnd = tenant.trialEndsAt ? new Date(tenant.trialEndsAt) : null;
  const createdAt = new Date(tenant.createdAt);
  const trialEnd =
    explicitEnd && !Number.isNaN(explicitEnd.getTime())
      ? explicitEnd
      : !Number.isNaN(createdAt.getTime())
        ? new Date(
            createdAt.getTime() + TRIAL_ENTITLEMENTS.lengthDays * 86_400_000,
          )
        : null;
  const isLiveTrial =
    (tenant.subscriptionStatus === "trial" ||
      tenant.subscriptionStatus === "trialing") &&
    trialEnd !== null &&
    trialEnd > now;
  const currentPeriodEnd = tenant.currentPeriodEnd
    ? new Date(tenant.currentPeriodEnd)
    : null;
  const hasPaidAccess =
    (tenant.subscriptionStatus === "active" ||
      tenant.subscriptionStatus === "cancelled" ||
      tenant.subscriptionStatus === "canceled") &&
    currentPeriodEnd !== null &&
    !Number.isNaN(currentPeriodEnd.getTime()) &&
    currentPeriodEnd > now;
  return isLiveTrial || (hasPaidAccess && planHasFeature(tenant.plan, feature));
}

export function requiredPlanForFeature(feature: PlanFeature) {
  return PLAN_DEFINITIONS[MINIMUM_PLAN_BY_FEATURE[feature]];
}

export function isPremiumFeature(value: string): value is PlanFeature {
  return PREMIUM_FEATURES.includes(value);
}
