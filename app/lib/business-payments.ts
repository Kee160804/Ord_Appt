export type BusinessModule = "appointment" | "ordering" | "retail";

export type BusinessPaymentMethod =
  | "bank_transfer"
  | "cash_on_delivery"
  | "payment_on_pickup"
  | "payment_at_appointment"
  | "external_link";

export type CustomerPaymentStatus =
  | "unpaid"
  | "awaiting_payment"
  | "awaiting_verification"
  | "partially_paid"
  | "paid"
  | "rejected"
  | "refunded"
  | "canceled";

export interface PaymentMethodConfiguration {
  id?: string;
  method: BusinessPaymentMethod;
  enabled: boolean;
  modules: BusinessModule[];
  instructions: string;
  externalUrl?: string;
}

export interface BankAccountConfiguration {
  id?: string;
  label: string;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  accountType: string;
  currency: string;
  instructions: string;
  isActive: boolean;
  sortOrder: number;
}

export interface FulfillmentConfiguration {
  pickupEnabled: boolean;
  localDeliveryEnabled: boolean;
  nationwideDeliveryEnabled: boolean;
  manualDeliveryQuote: boolean;
  pickupLocation: string;
  pickupInstructions: string;
  deliveryNotes: string;
  preparationMinutes: number;
  whatsappNumber: string;
  retailReservationsEnabled: boolean;
  emailVerificationMinutes: number;
  paymentWindowMinutes: number;
}

export interface PublicBusinessPaymentConfiguration {
  methods: PaymentMethodConfiguration[];
  bankAccounts: BankAccountConfiguration[];
  bankTransferAvailable?: boolean;
  fulfillment: FulfillmentConfiguration;
  notice: string;
}

export const PAYMENT_METHOD_LABELS: Record<BusinessPaymentMethod, string> = {
  bank_transfer: "Bank transfer",
  cash_on_delivery: "Cash on delivery",
  payment_on_pickup: "Payment on pickup",
  payment_at_appointment: "Payment at appointment",
  external_link: "External payment link",
};

export const DEFAULT_FULFILLMENT_CONFIGURATION: FulfillmentConfiguration = {
  pickupEnabled: true,
  localDeliveryEnabled: false,
  nationwideDeliveryEnabled: false,
  manualDeliveryQuote: false,
  pickupLocation: "",
  pickupInstructions: "",
  deliveryNotes: "",
  preparationMinutes: 30,
  whatsappNumber: "",
  retailReservationsEnabled: true,
  emailVerificationMinutes: 30,
  paymentWindowMinutes: 30,
};

export const DIRECT_PAYMENT_NOTICE =
  "You are paying this business directly. YuhBusiness does not receive, hold, verify, or settle these funds.";

export function isBusinessPaymentMethod(
  value: unknown,
): value is BusinessPaymentMethod {
  return (
    value === "bank_transfer" ||
    value === "cash_on_delivery" ||
    value === "payment_on_pickup" ||
    value === "payment_at_appointment" ||
    value === "external_link"
  );
}
