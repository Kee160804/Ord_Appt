import { getSupabaseBrowserClient } from "@/app/lib/supabase/client";

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

export async function createPublicAppointment(input: PublicBookingInput): Promise<string> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Online booking is not configured.");

  const useGrowthBooking = Boolean(input.providerId || input.promotionCode?.trim());
  const { data, error } = await supabase.rpc(useGrowthBooking ? "create_public_appointment_with_provider" : "create_public_appointment", {
    p_tenant_id: input.tenantId,
    p_service_id: input.serviceId,
    p_appointment_date: input.date,
    p_appointment_time: input.time,
    p_customer_name: input.customerName.trim(),
    p_customer_email: input.customerEmail.trim().toLowerCase(),
    p_customer_phone: input.customerPhone.trim(),
    p_notes: input.notes?.trim() || null,
    ...(useGrowthBooking ? { p_staff_id: input.providerId || null, p_promotion_code: input.promotionCode?.trim() || null } : {}),
  });

  if (error) throw new Error(errorMessage(error));
  if (typeof data !== "string") throw new Error("The booking was created without a confirmation ID.");
  return data;
}
