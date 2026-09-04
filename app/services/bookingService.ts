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
  paymentMethod?: "pay_later" | "mock_card";
}

export interface PublicBookingResult {
  appointmentId: string;
  paymentStatus: string;
  paymentReference?: string;
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
    paymentStatus?: string;
    paymentReference?: string | null;
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
  return {
    appointmentId: result.appointmentId,
    paymentStatus: result.paymentStatus || "UNPAID",
    paymentReference: result.paymentReference || undefined,
  };
}
