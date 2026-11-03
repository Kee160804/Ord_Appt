import { processEmailQueueBestEffort } from "@/app/lib/email/process-best-effort";
import {
  isValidUuid,
  requestHasAllowedOrigin,
} from "@/app/lib/server/security";
import { requireTenantRole } from "@/app/lib/server/tenant-authorization";
import { getSupabaseAdminClient } from "@/app/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = new Set([
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
  "COMPLETED",
  "NO_SHOW",
]);

export async function POST(request: Request) {
  if (!requestHasAllowedOrigin(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }

  let body: { tenantId?: string; appointmentId?: string; status?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json(
      { error: "Invalid appointment update." },
      { status: 400 },
    );
  }

  const tenantId = body.tenantId?.trim() ?? "";
  const appointmentId = body.appointmentId?.trim() ?? "";
  const status = body.status?.trim().toUpperCase() ?? "";
  if (
    !isValidUuid(tenantId) ||
    !isValidUuid(appointmentId) ||
    !ALLOWED_STATUSES.has(status)
  ) {
    return Response.json(
      { error: "Invalid appointment update." },
      { status: 400 },
    );
  }

  const authorization = await requireTenantRole(tenantId, [
    "OWNER",
    "ADMIN",
    "MANAGER",
  ]);
  if ("error" in authorization) {
    return Response.json(
      { error: authorization.error },
      { status: authorization.status },
    );
  }

  const admin = getSupabaseAdminClient();
  if (status === "CONFIRMED") {
    const appointment = await admin
      .from("appointments")
      .select("id,total,amount_paid,outstanding_balance,payment_status")
      .eq("id", appointmentId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (appointment.error) {
      console.error("[appointments] Payment check failed.", {
        code: appointment.error.code,
      });
      return Response.json(
        { error: "Unable to confirm the appointment." },
        { status: 500 },
      );
    }
    if (!appointment.data) {
      return Response.json(
        { error: "Appointment not found." },
        { status: 404 },
      );
    }
    const total = Number(appointment.data.total ?? 0);
    const amountPaid = Number(appointment.data.amount_paid ?? 0);
    const outstanding = Number(appointment.data.outstanding_balance ?? total);
    const fullyPaid =
      total <= 0 ||
      (appointment.data.payment_status?.toUpperCase() === "PAID" &&
        amountPaid >= total &&
        outstanding <= 0);
    if (!fullyPaid) {
      return Response.json(
        {
          error:
            "Confirm the customer's full payment before confirming the appointment.",
        },
        { status: 409 },
      );
    }
  }

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("appointments")
    .update({
      status,
      cancelled_at: status === "CANCELLED" ? now : null,
      completed_at: status === "COMPLETED" ? now : null,
    })
    .eq("id", appointmentId)
    .eq("tenant_id", tenantId)
    .select("id,status")
    .maybeSingle();

  if (error) {
    console.error("[appointments] Status update failed.", { code: error.code });
    return Response.json(
      { error: "Unable to update the appointment." },
      { status: 500 },
    );
  }
  if (!data) {
    return Response.json({ error: "Appointment not found." }, { status: 404 });
  }

  if (status === "CONFIRMED" || status === "CANCELLED") {
    await processEmailQueueBestEffort("appointment status update");
  }
  return Response.json({ appointment: data });
}
