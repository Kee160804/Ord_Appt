import { getSupabaseAdminClient } from "@/app/lib/supabase/admin";
import { hashGuestAccessToken } from "@/app/lib/server/guest-access";
import { getVerifiedTrackingSession } from "@/app/lib/server/order-tracking";
import {
  enforcePublicRateLimit,
  isValidUuid,
  rateLimitResponse,
  requestHasAllowedOrigin,
} from "@/app/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tenantId = url.searchParams.get("tenantId")?.trim() ?? "";
  const appointmentId = url.searchParams.get("appointmentId")?.trim() ?? "";
  const accessToken = url.searchParams.get("accessToken")?.trim() ?? "";
  const appointmentDate = url.searchParams.get("date")?.trim() ?? "";
  if (
    !isValidUuid(tenantId) ||
    !isValidUuid(appointmentId) ||
    accessToken.length < 32 ||
    !DATE.test(appointmentDate)
  ) {
    return Response.json(
      { error: "Choose a valid appointment date." },
      { status: 400 },
    );
  }

  const rate = await enforcePublicRateLimit(
    request,
    "appointment-availability",
    tenantId,
    appointmentId,
    30,
    300,
  );
  if (!rate.allowed) return rateLimitResponse(rate.retryAfter);

  const session = await getVerifiedTrackingSession(tenantId, accessToken);
  if (!session || session.appointment_id !== appointmentId) {
    return Response.json(
      { error: "Verify your booking again to view available times." },
      { status: 403 },
    );
  }

  const admin = getSupabaseAdminClient();
  const { data: appointment, error: appointmentError } = await admin
    .from("appointments")
    .select("service_id,staff_id,status")
    .eq("tenant_id", tenantId)
    .eq("id", appointmentId)
    .maybeSingle();
  if (appointmentError || !appointment) {
    return Response.json(
      { error: "Unable to load appointment availability." },
      { status: 404 },
    );
  }
  if (
    ["CANCELLED", "CANCELED", "COMPLETED", "NO_SHOW"].includes(
      String(appointment.status).toUpperCase(),
    )
  ) {
    return Response.json(
      { error: "This booking can no longer be rescheduled." },
      { status: 409 },
    );
  }

  const availability = appointment.staff_id
    ? await admin.rpc("get_public_provider_availability", {
        p_tenant_id: tenantId,
        p_service_id: appointment.service_id,
        p_appointment_date: appointmentDate,
        p_staff_id: appointment.staff_id,
      })
    : await admin.rpc("get_public_appointment_availability", {
        p_tenant_id: tenantId,
        p_service_id: appointment.service_id,
        p_appointment_date: appointmentDate,
      });
  if (availability.error) {
    console.error("[appointment-booking] Availability lookup failed.", {
      code: availability.error.code,
    });
    return Response.json(
      { error: "Unable to load available times for this date." },
      { status: 503 },
    );
  }

  const slots = (
    (availability.data ?? []) as Array<{
      appointment_time: string;
    }>
  ).map((slot) => slot.appointment_time.slice(0, 5));
  return Response.json({ slots }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!requestHasAllowedOrigin(request))
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  let body: {
    tenantId?: string;
    appointmentId?: string;
    accessToken?: string;
    action?: string;
    date?: string;
    time?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json(
      { error: "Invalid booking request." },
      { status: 400 },
    );
  }
  const tenantId = body.tenantId?.trim() ?? "";
  const appointmentId = body.appointmentId?.trim() ?? "";
  const accessToken = body.accessToken?.trim() ?? "";
  const action = body.action?.trim().toLowerCase() ?? "";
  if (
    !isValidUuid(tenantId) ||
    !isValidUuid(appointmentId) ||
    accessToken.length < 32 ||
    !["cancel", "reschedule"].includes(action)
  ) {
    return Response.json(
      { error: "Invalid booking request." },
      { status: 400 },
    );
  }
  if (
    action === "reschedule" &&
    (!DATE.test(body.date ?? "") || !TIME.test(body.time ?? ""))
  ) {
    return Response.json(
      { error: "Choose a valid date and time." },
      { status: 400 },
    );
  }
  const rate = await enforcePublicRateLimit(
    request,
    "appointment-change",
    tenantId,
    appointmentId,
    8,
    900,
  );
  if (!rate.allowed) return rateLimitResponse(rate.retryAfter);
  const result = await getSupabaseAdminClient().rpc(
    "update_tracked_appointment",
    {
      p_tenant_id: tenantId,
      p_appointment_id: appointmentId,
      p_token_hash: hashGuestAccessToken(accessToken),
      p_action: action,
      p_appointment_date: action === "reschedule" ? body.date : null,
      p_appointment_time: action === "reschedule" ? body.time : null,
    },
  );
  if (result.error) {
    const message = result.error.message || "Unable to update the booking.";
    return Response.json(
      {
        error: /verify|no longer|not available|valid/i.test(message)
          ? message
          : "Unable to update the booking.",
      },
      { status: /verify/i.test(message) ? 403 : 409 },
    );
  }
  return Response.json({ status: result.data });
}
