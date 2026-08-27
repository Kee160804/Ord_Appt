import type { Tenant } from "@/app/types";

export const TRIAL_LENGTH_DAYS = 14;
const DAY_IN_MS = 86_400_000;

export type TenantAccessState = "active" | "trial" | "expired";

export interface TenantEntitlement {
  state: TenantAccessState;
  hasAccess: boolean;
  trialEndsAt: Date | null;
  daysRemaining: number;
}

export function getTrialEndDate(tenant: Tenant): Date | null {
  const explicitEnd = tenant.trialEndsAt ? new Date(tenant.trialEndsAt) : null;
  if (explicitEnd && !Number.isNaN(explicitEnd.getTime())) return explicitEnd;

  const createdAt = new Date(tenant.createdAt);
  if (Number.isNaN(createdAt.getTime())) return null;
  return new Date(createdAt.getTime() + TRIAL_LENGTH_DAYS * DAY_IN_MS);
}

export function getTenantEntitlement(
  tenant: Tenant,
  now: Date = new Date(),
): TenantEntitlement {
  if (tenant.subscriptionStatus === "active") {
    return {
      state: "active",
      hasAccess: true,
      trialEndsAt: getTrialEndDate(tenant),
      daysRemaining: 0,
    };
  }

  const trialEndsAt = getTrialEndDate(tenant);
  const remainingMs = trialEndsAt ? trialEndsAt.getTime() - now.getTime() : 0;
  const isLiveTrial = tenant.subscriptionStatus === "trial" && remainingMs > 0;

  if (isLiveTrial) {
    return {
      state: "trial",
      hasAccess: true,
      trialEndsAt,
      daysRemaining: Math.max(1, Math.ceil(remainingMs / DAY_IN_MS)),
    };
  }

  return {
    state: "expired",
    hasAccess: false,
    trialEndsAt,
    daysRemaining: 0,
  };
}

