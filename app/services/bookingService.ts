import type { BusinessPaymentMethod } from "@/app/lib/business-payments";

export interface PublicBookingInput {
  tenantId: string;
  serviceId: string;
  date: string;
  time: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  notes?: string;
  providerId?: string;
  promotionCode?: string;
  paymentMethod: BusinessPaymentMethod;
  paymentOption: "deposit" | "full";
}

export interface PublicBookingResult {
  appointmentId: string;
  appointmentNumber?: string;
  paymentStatus: string;
  paymentReference?: string;
  createdAt: string;
  depositCheckout?: {
    accessToken: string;
    expiresAt: string;
    customerEmail: string;
    amount: number;
    bankAccounts: Array<{
      id: string;
      label: string;
      bankName: string;
      accountHolder: string;
      accountNumber: string;
      currency: string;
      instructions: string;
    }>;
  };
}

function errorMessage(error: unknown) {
  const fallback = "Unable to create the appointment.";
  let message = "";
  let code = "";

  if (error instanceof Error && error.message) message = error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    message = error.message;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    code = error.code;
  }

  if (code === "PGRST202" || message.includes("create_public_appointment")) {
    return "Online booking is temporarily unavailable. Please try again shortly or contact the business.";
  }

  return message || fallback;
}

export async function createPublicAppointment(
  input: PublicBookingInput,
): Promise<PublicBookingResult> {
  const response = await fetch("/api/public/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const result = (await response.json()) as {
    appointmentId?: string;
    appointmentNumber?: string;
    paymentStatus?: string;
    paymentReference?: string | null;
    createdAt?: string;
    depositCheckout?: PublicBookingResult["depositCheckout"];
    error?: string;
  };
  if (!response.ok)
    throw new Error(
      errorMessage(
        new Error(result.error || "Unable to create the appointment."),
      ),
    );
  if (!result.appointmentId)
    throw new Error("The booking was created without a confirmation ID.");
  if (input.paymentMethod === "bank_transfer" && !result.appointmentNumber)
    throw new Error(
      "The booking was created without an appointment reference.",
    );
  return {
    appointmentId: result.appointmentId,
    appointmentNumber: result.appointmentNumber,
    paymentStatus: result.paymentStatus || "UNPAID",
    paymentReference: result.paymentReference || undefined,
    createdAt: result.createdAt || new Date().toISOString(),
    depositCheckout: result.depositCheckout,
  };
}
