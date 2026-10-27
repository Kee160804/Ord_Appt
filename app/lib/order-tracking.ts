export interface TrackedOrder {
  id: string;
  orderNumber: string;
  customerEmail: string;
  createdAt: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  orderType: string;
  subtotal: number;
  tax: number;
  deliveryFee: number;
  discount: number;
  total: number;
  amountPaid: number;
  deliveryAddress: string;
  instructions: string;
  requestedTime: string | null;
  reservationExpiresAt: string | null;
  canUploadReceipt: boolean;
  items: Array<{
    id: string;
    name: string;
    image: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    sku: string;
    addons: Array<{ name: string; price: number }>;
  }>;
  history: Array<{ status: string; createdAt: string }>;
  receipt: null | {
    id: string;
    status: string;
    amount: number;
    createdAt: string;
    verifiedAt: string | null;
    reference: string;
    reason: string;
    url: string | null;
    mimeType: string;
  };
  business: {
    name: string;
    phone: string;
    pickupLocation: string;
    pickupInstructions: string;
    deliveryNotes: string;
  };
  payment: {
    instructions: string;
    externalUrl: string | null;
    bankAccounts: Array<{
      id: string;
      bankName: string;
      accountHolder: string;
      accountNumber: string;
      currency: string;
      instructions: string;
    }>;
  };
}

export function trackingStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: "Awaiting confirmation",
    CONFIRMED: "Confirmed by business",
    PREPARING: "Preparing your order",
    READY: "Ready for pickup / dispatch",
    OUT_FOR_DELIVERY: "Out for delivery",
    DELIVERED: "Completed",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    CANCELED: "Cancelled",
    UNPAID: "Awaiting payment",
    AWAITING_PAYMENT: "Awaiting payment",
    AWAITING_VERIFICATION: "Awaiting verification",
    VERIFIED: "Payment verified",
    PAID: "Paid",
    PARTIALLY_PAID: "Partially paid",
    PARTIAL: "Partially paid",
    REJECTED: "Payment rejected",
    REFUNDED: "Refunded",
    RESUBMISSION_REQUESTED: "New receipt requested",
  };
  return (
    labels[status.toUpperCase()] ?? status.replaceAll("_", " ").toLowerCase()
  );
}
