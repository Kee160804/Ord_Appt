import "server-only";

import type { PlanType } from "@/app/types";
import { PLAN_DEFINITIONS } from "@/app/lib/plans";
import { registerBelizeBankSubscription } from "@/app/lib/billing/belize-bank";

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
  requestId: string;
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

const belizeBankProvider: PaymentProvider = {
  id: "BELIZE_BANK",
  isMock: false,
  supportsProration: false,
  async createOrUpdateSubscription(request) {
    const registration = await registerBelizeBankSubscription({
      tenantId: request.tenantId,
      requestId: request.requestId,
      ownerEmail: request.ownerEmail,
      businessName: request.businessName,
      planName: PLAN_DEFINITIONS[request.plan].name,
      amount: request.recurringTotal,
    });
    return {
      provider: "BELIZE_BANK",
      providerReference: registration.orderId,
      status: "pending",
      redirectUrl: registration.formUrl,
      isMock: false,
    };
  },
  async scheduleCancellation() {
    // Belize Bank checkout is currently a one-time hosted monthly payment.
    // No recurring instruction exists at the gateway to cancel.
  },
};

export function getPaymentProvider(): PaymentProvider {
  const configured = process.env.BILLING_PROVIDER?.trim().toLowerCase();
  if (
    process.env.NODE_ENV !== "production" &&
    configured === "mock" &&
    process.env.ENABLE_MOCK_BILLING === "true"
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
      process.env.NODE_ENV === "production"
        ? "BILLING_PROVIDER=mock is not allowed in production."
        : "Mock subscription activation is disabled. Set ENABLE_MOCK_BILLING=true only for isolated billing tests.",
    );
  }
  if (configured === "belize_bank" || configured === "belize-bank") {
    return belizeBankProvider;
  }
  throw new PaymentConfigurationError(
    `The ${configured} subscription payment adapter is not installed.`,
  );
}
