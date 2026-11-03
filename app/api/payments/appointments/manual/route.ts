import { getSupabaseAdminClient } from "@/app/lib/supabase/admin";
import {
  requestHasAllowedOrigin,
  isValidUuid,
} from "@/app/lib/server/security";
import { requireTenantRole } from "@/app/lib/server/tenant-authorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!requestHasAllowedOrigin(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }
  let body: { tenantId?: string; appointmentId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json(
      { error: "Invalid payment request." },
      { status: 400 },
    );
  }
  const tenantId = body.tenantId?.trim() ?? "";
  const appointmentId = body.appointmentId?.trim() ?? "";
  if (!isValidUuid(tenantId) || !isValidUuid(appointmentId)) {
    return Response.json(
      { error: "Invalid appointment payment request." },
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
  const result = await getSupabaseAdminClient().rpc(
    "record_appointment_in_person_payment",
    {
      p_tenant_id: tenantId,
      p_appointment_id: appointmentId,
      p_actor_id: authorization.userId,
    },
  );
  if (result.error) {
    const message = result.error.message || "Unable to confirm the payment.";
    return Response.json(
      {
        error: /not found|does not accept|no payment is due/i.test(message)
          ? message
          : "Unable to confirm the payment.",
      },
      { status: /not found/i.test(message) ? 404 : 409 },
    );
  }
  return Response.json({
    payment: Array.isArray(result.data) ? result.data[0] : result.data,
  });
}
