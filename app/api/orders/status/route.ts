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
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
]);

export async function POST(request: Request) {
  if (!requestHasAllowedOrigin(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }

  let body: { tenantId?: string; orderId?: string; status?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid order update." }, { status: 400 });
  }

  const tenantId = body.tenantId?.trim() ?? "";
  const orderId = body.orderId?.trim() ?? "";
  const status = body.status?.trim().toUpperCase() ?? "";
  if (
    !isValidUuid(tenantId) ||
    !isValidUuid(orderId) ||
    !ALLOWED_STATUSES.has(status)
  ) {
    return Response.json({ error: "Invalid order update." }, { status: 400 });
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
  const [orderResult, tenantResult] = await Promise.all([
    admin
      .from("orders")
      .update({
        status,
        cancelled_at: status === "CANCELLED" ? new Date().toISOString() : null,
      })
      .eq("id", orderId)
      .eq("tenant_id", tenantId)
      .select("id,status")
      .maybeSingle(),
    admin
      .from("tenants")
      .select("business_type")
      .eq("id", tenantId)
      .maybeSingle(),
  ]);

  if (orderResult.error) {
    console.error("[orders] Status update failed.", {
      code: orderResult.error.code,
    });
    return Response.json(
      { error: "Unable to update the order." },
      { status: 500 },
    );
  }
  if (!orderResult.data) {
    return Response.json({ error: "Order not found." }, { status: 404 });
  }

  if (tenantResult.error) {
    console.error("[orders] Customer email policy lookup failed.", {
      code: tenantResult.error.code,
    });
  } else if (
    tenantResult.data?.business_type?.toLowerCase() === "ordering" &&
    (status === "READY" || status === "CANCELLED")
  ) {
    await processEmailQueueBestEffort("ordering status update");
  }

  return Response.json({ order: orderResult.data });
}
