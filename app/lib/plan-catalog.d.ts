import type { PlanType } from "@/app/types";

export interface CatalogPlanDefinition {
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

export const PLAN_CATALOG: Readonly<Record<PlanType, CatalogPlanDefinition>>;
export const PLAN_ORDER: readonly PlanType[];
export const TRIAL_ENTITLEMENTS: Readonly<{
  lengthDays: number;
  monthlyActivityLimit: number;
  includedStaffSeats: number;
  maxStaffSeats: number;
}>;
export const PREMIUM_FEATURES: readonly string[];

export interface SubscriptionAmounts {
  planId: PlanType;
  baseAmount: number;
  paidStaffSeats: number;
  seatAmount: number;
  recurringTotal: number;
  maximumPaidSeats: number;
  currency: "BZD";
  billingPeriod: "month";
}

export function calculateSubscriptionAmounts(
  planId: PlanType,
  paidStaffSeats?: number,
): Readonly<SubscriptionAmounts>;
export function approximateDailyPrice(monthlyPrice: number): number;
export function evaluateSubscriptionAccess(
  subscription: {
    subscriptionStatus?: string;
    trialEndsAt?: string | Date;
    createdAt?: string | Date;
    currentPeriodEnd?: string | Date;
    cancelAtPeriodEnd?: boolean;
  },
  nowValue?: string | Date,
): Readonly<{
  state: "trial" | "active" | "past_due" | "expired";
  hasAccess: boolean;
  trialEndsAt: Date | null;
  daysRemaining: number;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}>;
export function validateSubscriptionSeatSelection(
  planId: PlanType,
  paidStaffSeats: number,
  activeStaff: number,
): Readonly<
  SubscriptionAmounts & { activeStaff: number; authorizedStaff: number }
>;
