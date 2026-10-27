import {
  PAYMENT_METHOD_LABELS,
  type BusinessPaymentMethod,
  type PublicBusinessPaymentConfiguration,
} from "./business-payments";

export type CustomerCheckoutMethod = BusinessPaymentMethod | "pay_later";
export type CheckoutOrderType = "dine_in" | "pickup" | "delivery";
export interface CheckoutPaymentOption {
  method: CustomerCheckoutMethod;
  label: string;
  instructions: string;
}

export function checkoutPaymentOptions(
  configuration: PublicBusinessPaymentConfiguration,
  orderType: string,
): CheckoutPaymentOption[] {
  const available = configuration.methods.filter(
    (item) =>
      item.enabled &&
      item.method !== "payment_at_appointment" &&
      (item.method !== "cash_on_delivery" || orderType === "delivery") &&
      (item.method !== "payment_on_pickup" || orderType === "pickup"),
  );
  return available.length
    ? available.map((item) => ({
        method: item.method,
        label: PAYMENT_METHOD_LABELS[item.method],
        instructions: item.instructions,
      }))
    : [
        {
          method: "pay_later",
          label: "Pay the business directly",
          instructions:
            "Arrange payment directly with the business when your order is confirmed.",
        },
      ];
}

export function checkoutOrderTypes(
  types: CheckoutOrderType[],
  configuration: PublicBusinessPaymentConfiguration | null,
  retail: boolean,
) {
  return types.filter(
    (type) =>
      (!retail || type !== "dine_in") &&
      (!configuration ||
        type === "dine_in" ||
        (type === "pickup"
          ? configuration.fulfillment.pickupEnabled
          : configuration.fulfillment.localDeliveryEnabled ||
            configuration.fulfillment.nationwideDeliveryEnabled)),
  );
}

export function moneyRound(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}
