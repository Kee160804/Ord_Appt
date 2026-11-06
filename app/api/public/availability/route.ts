import { getSupabaseAdminClient } from "@/app/lib/supabase/admin";
import {
  enforcePublicRateLimit,
  isValidUuid,
  rateLimitResponse,
} from "@/app/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tenantId = url.searchParams.get("tenantId")?.trim() ?? "";
  const serviceId = url.searchParams.get("serviceId")?.trim() ?? "";
  const providerId = url.searchParams.get("providerId")?.trim() ?? "";
  const date = url.searchParams.get("date")?.trim() ?? "";

  if (
    !isValidUuid(tenantId) ||
    !isValidUuid(serviceId) ||
    (providerId.length > 0 && !isValidUuid(providerId)) ||
    !DATE.test(date) ||
    Number.isNaN(Date.parse(`${date}T00:00:00Z`))
  ) {
    return Response.json(
      { error: "Choose a valid service and appointment date." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const rate = await enforcePublicRateLimit(
    request,
    "storefront-availability",
    tenantId,
    `${serviceId}:${providerId || "any"}`,
    60,
    300,
  );
  if (!rate.allowed) return rateLimitResponse(rate.retryAfter);

  const admin = getSupabaseAdminClient();
  const result = providerId
    ? await admin.rpc("get_public_provider_availability", {
        p_tenant_id: tenantId,
        p_service_id: serviceId,
        p_appointment_date: date,
        p_staff_id: providerId,
      })
    : await admin.rpc("get_public_appointment_availability", {
        p_tenant_id: tenantId,
        p_service_id: serviceId,
        p_appointment_date: date,
      });

  if (result.error) {
    console.error("[public-availability] Lookup failed.", {
      code: result.error.code,
    });
    return Response.json(
      { error: "Unable to load available times for this date." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const slots = ((result.data ?? []) as Array<{ appointment_time: string }>)
    .map((slot) => slot.appointment_time.slice(0, 5))
    .filter((slot) => /^([01]\d|2[0-3]):[0-5]\d$/.test(slot));

  return Response.json(
    { slots },
    {
      headers: {
        "Cache-Control": "public, max-age=30, stale-while-revalidate=30",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
