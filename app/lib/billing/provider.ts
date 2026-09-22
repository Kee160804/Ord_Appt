import "server-only";

import type { PlanType } from "@/app/types";

export class PaymentConfigurationError extends Error {}

export interface SubscriptionCheckoutRequest {
  tenantId: string;
  ownerId: string;
  ownerEmail: string;
  businessName: string;
  currentPlan?: PlanType;
  currentPaidStaffSeats: number;
  currentPeriodEnd?: string;
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  plan: PlanType;
  paidStaffSeats: number;
  baseAmount: number;
  seatAmount: number;
  recurringTotal: number;
  currency: "BZD";
  idempotencyKey: string;
}

export interface SubscriptionCheckoutResult {
  provider: string;
  providerReference: string;
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  status: "completed" | "pending";
  redirectUrl?: string;
  isMock: boolean;
}

export interface PaymentProvider {
  readonly id: string;
  readonly isMock: boolean;
  readonly supportsProration: boolean;
  createOrUpdateSubscription(
    request: SubscriptionCheckoutRequest,
  ): Promise<SubscriptionCheckoutResult>;
  scheduleCancellation(input: {
    tenantId: string;
    providerCustomerId?: string;
    providerSubscriptionId?: string;
    currentPeriodEnd: string;
  }): Promise<void>;
}

const mockProvider: PaymentProvider = {
  id: "MOCK",
  isMock: true,
  supportsProration: false,
  async createOrUpdateSubscription(request) {
    if (process.env.NODE_ENV === "production") {
      throw new PaymentConfigurationError(
        "Mock subscription payments are disabled in production.",
      );
    }
    const reference = `MOCK-${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
    return {
      provider: "MOCK",
      providerReference: reference,
      providerCustomerId: `mock-customer-${request.ownerId}`,
      providerSubscriptionId: `mock-subscription-${request.tenantId}`,
      status: "completed",
      isMock: true,
    };
  },
  async scheduleCancellation() {
    if (process.env.NODE_ENV === "production") {
      throw new PaymentConfigurationError(
        "Mock subscription payments are disabled in production.",
      );
    }
  },
};

export function getPaymentProvider(): PaymentProvider {
  const configured = process.env.BILLING_PROVIDER?.trim().toLowerCase();
  if (
    process.env.NODE_ENV !== "production" &&
    (!configured || configured === "mock")
  ) {
    return mockProvider;
  }
  if (!configured) {
    throw new PaymentConfigurationError(
      "Subscription payments are not configured for this deployment.",
    );
  }
  if (configured === "mock") {
    throw new PaymentConfigurationError(
      "BILLING_PROVIDER=mock is not allowed in production.",
    );
  }
  throw new PaymentConfigurationError(
    `The ${configured} subscription payment adapter is not installed.`,
  );
}
