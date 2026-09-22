import {
  PLAN_DEFINITIONS,
  TRIAL_ENTITLEMENTS,
  planHasFeature,
} from "@/app/lib/plans";
import { evaluateSubscriptionAccess } from "@/app/lib/plan-catalog.mjs";
import type { PlanFeature } from "@/app/lib/plans";
import type { Tenant } from "@/app/types";

const DAY_IN_MS = 86_400_000;

type TenantAccessState = "active" | "trial" | "past_due" | "expired";

export interface TenantEntitlement {
  state: TenantAccessState;
  hasAccess: boolean;
  trialEndsAt: Date | null;
  daysRemaining: number;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

export function getTrialEndDate(tenant: Tenant): Date | null {
  const explicitEnd = tenant.trialEndsAt ? new Date(tenant.trialEndsAt) : null;
  if (explicitEnd && !Number.isNaN(explicitEnd.getTime())) return explicitEnd;

  const createdAt = new Date(tenant.createdAt);
  if (Number.isNaN(createdAt.getTime())) return null;
  return new Date(
    createdAt.getTime() + TRIAL_ENTITLEMENTS.lengthDays * DAY_IN_MS,
  );
}

export function getTenantEntitlement(
  tenant: Tenant,
  now: Date = new Date(),
): TenantEntitlement {
  return evaluateSubscriptionAccess(tenant, now);
}

export function getEffectiveTenantLimits(
  tenant: Tenant,
  now: Date = new Date(),
) {
  const entitlement = getTenantEntitlement(tenant, now);
  const plan = PLAN_DEFINITIONS[tenant.plan];
  if (entitlement.state === "trial") {
    return {
      ...entitlement,
      activityLimit: TRIAL_ENTITLEMENTS.monthlyActivityLimit,
      includedStaffSeats: TRIAL_ENTITLEMENTS.includedStaffSeats,
      maxStaffSeats: TRIAL_ENTITLEMENTS.maxStaffSeats,
    };
  }
  return {
    ...entitlement,
    activityLimit: plan.monthlyActivityLimit,
    includedStaffSeats: plan.includedStaffSeats,
    maxStaffSeats: plan.maxStaffSeats,
  };
}

export function tenantEntitledToFeature(
  tenant: Tenant,
  feature: PlanFeature,
  now: Date = new Date(),
) {
  const entitlement = getTenantEntitlement(tenant, now);
  if (!entitlement.hasAccess) return false;
  if (entitlement.state === "trial") return true;
  return planHasFeature(tenant.plan, feature);
}
