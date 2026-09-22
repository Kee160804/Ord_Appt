export const PLAN_CATALOG = Object.freeze({
  starter: Object.freeze({
    id: "starter",
    publicId: "beginner",
    name: "Beginner",
    price: 9,
    monthlyActivityLimit: 50,
    includedStaffSeats: 0,
    maxStaffSeats: 0,
    additionalStaffSeatPrice: 2,
    description: "The essentials for getting your business online.",
    shortFeatures: Object.freeze([
      "Branded storefront",
      "Up to 50 monthly orders or bookings",
      "1 account total: owner only",
    ]),
  }),
  pro: Object.freeze({
    id: "pro",
    publicId: "pro",
    name: "Pro",
    price: 12,
    monthlyActivityLimit: 150,
    includedStaffSeats: 1,
    maxStaffSeats: 4,
    additionalStaffSeatPrice: 2,
    description: "Growth tools, analytics, inventory, and booking controls.",
    shortFeatures: Object.freeze([
      "Up to 150 monthly activities",
      "Analytics and advanced controls",
      "Owner + 1 staff included; add up to 3 at $2 BZD each",
      "Maximum 5 accounts total, including owner",
    ]),
  }),
  enterprise: Object.freeze({
    id: "enterprise",
    publicId: "enterprise",
    name: "Enterprise",
    price: 15,
    monthlyActivityLimit: null,
    includedStaffSeats: 2,
    maxStaffSeats: 9,
    additionalStaffSeatPrice: 2,
    description: "Unlimited activity and the platform's highest team capacity.",
    shortFeatures: Object.freeze([
      "Unlimited orders or appointments",
      "Up to 10 accounts total, including owner",
      "Owner + 2 staff included; add up to 7 at $2 BZD each",
      "All advanced controls included",
    ]),
  }),
});

export const PLAN_ORDER = Object.freeze(["starter", "pro", "enterprise"]);

// A trial is a real product evaluation, not a disguised Beginner plan. It has
// enough activity and one staff seat to exercise every workflow without
// silently promising Enterprise-scale usage for free.
export const TRIAL_ENTITLEMENTS = Object.freeze({
  lengthDays: 14,
  monthlyActivityLimit: 150,
  includedStaffSeats: 1,
  maxStaffSeats: 1,
});

export const PREMIUM_FEATURES = Object.freeze([
  "detailed_analytics",
  "advanced_catalog",
  "product_variants",
  "booking_deposits",
  "storefront_branding",
  "storefront_contact_form",
  "team_management",
]);

export function calculateSubscriptionAmounts(planId, paidStaffSeats = 0) {
  const plan = PLAN_CATALOG[planId];
  if (!plan) throw new Error("Choose a valid plan.");
  if (!Number.isInteger(paidStaffSeats) || paidStaffSeats < 0) {
    throw new Error("Paid staff seats must be a non-negative whole number.");
  }
  const maximumPaidSeats = plan.maxStaffSeats - plan.includedStaffSeats;
  if (paidStaffSeats > maximumPaidSeats) {
    throw new Error(
      `The ${plan.name} plan allows at most ${maximumPaidSeats} paid staff seats.`,
    );
  }
  const seatAmount = paidStaffSeats * plan.additionalStaffSeatPrice;
  return Object.freeze({
    planId,
    baseAmount: plan.price,
    paidStaffSeats,
    seatAmount,
    recurringTotal: plan.price + seatAmount,
    maximumPaidSeats,
    currency: "BZD",
    billingPeriod: "month",
  });
}

export function approximateDailyPrice(monthlyPrice) {
  return Math.round((monthlyPrice / 30) * 100) / 100;
}

const DAY_IN_MS = 86_400_000;

function validDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function evaluateSubscriptionAccess(
  subscription,
  nowValue = new Date(),
) {
  const now = validDate(nowValue) ?? new Date();
  const status = String(
    subscription.subscriptionStatus ?? "trial",
  ).toLowerCase();
  const explicitTrialEnd = validDate(subscription.trialEndsAt);
  const createdAt = validDate(subscription.createdAt);
  const trialEndsAt =
    explicitTrialEnd ??
    (createdAt
      ? new Date(
          createdAt.getTime() + TRIAL_ENTITLEMENTS.lengthDays * DAY_IN_MS,
        )
      : null);
  const currentPeriodEnd = validDate(subscription.currentPeriodEnd);
  const isLiveTrial =
    (status === "trial" || status === "trialing") &&
    trialEndsAt !== null &&
    trialEndsAt > now;
  const hasCurrentPaidPeriod =
    (status === "active" || status === "cancelled" || status === "canceled") &&
    currentPeriodEnd !== null &&
    currentPeriodEnd > now;

  if (isLiveTrial) {
    return Object.freeze({
      state: "trial",
      hasAccess: true,
      trialEndsAt,
      daysRemaining: Math.max(
        1,
        Math.ceil((trialEndsAt.getTime() - now.getTime()) / DAY_IN_MS),
      ),
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });
  }
  if (hasCurrentPaidPeriod) {
    return Object.freeze({
      state: "active",
      hasAccess: true,
      trialEndsAt,
      daysRemaining: 0,
      currentPeriodEnd,
      cancelAtPeriodEnd:
        status === "cancelled" ||
        status === "canceled" ||
        Boolean(subscription.cancelAtPeriodEnd),
    });
  }
  return Object.freeze({
    state: status === "past_due" ? "past_due" : "expired",
    hasAccess: false,
    trialEndsAt,
    daysRemaining: 0,
    currentPeriodEnd,
    cancelAtPeriodEnd: Boolean(subscription.cancelAtPeriodEnd),
  });
}

export function validateSubscriptionSeatSelection(
  planId,
  paidStaffSeats,
  activeStaff,
) {
  const amounts = calculateSubscriptionAmounts(planId, paidStaffSeats);
  if (!Number.isInteger(activeStaff) || activeStaff < 0) {
    throw new Error("Active staff must be a non-negative whole number.");
  }
  const plan = PLAN_CATALOG[planId];
  const authorizedStaff = plan.includedStaffSeats + paidStaffSeats;
  if (activeStaff > authorizedStaff) {
    throw new Error(
      "Remove active staff or purchase enough seats before changing this subscription.",
    );
  }
  return Object.freeze({ ...amounts, activeStaff, authorizedStaff });
}
