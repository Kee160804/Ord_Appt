import { getSupabaseAdminClient } from "@/app/lib/supabase/admin";
import {
  enforcePublicRateLimit,
  isValidUuid,
  publicOperationError,
  rateLimitResponse,
  readJsonBody,
  requestHasAllowedOrigin,
} from "@/app/lib/server/security";

export async function POST(request: Request) {
  if (!requestHasAllowedOrigin(request))
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const body = await readJsonBody<{
      tenantId?: string;
      code?: string;
      amount?: number;
      productIds?: string[];
      serviceId?: string;
      website?: string;
    }>(request, 8_192);
    const tenantId = body.tenantId?.trim() || "";
    const code = body.code?.trim().toUpperCase() || "";
    if (
      body.website ||
      !isValidUuid(tenantId) ||
      !/^[A-Z0-9_-]{2,32}$/.test(code)
    )
      return Response.json(
        { error: "Invalid discount code." },
        { status: 400 },
      );
    const rate = await enforcePublicRateLimit(
      request,
      "promotion",
      tenantId,
      code,
      12,
      300,
    );
    if (!rate.allowed) return rateLimitResponse(rate.retryAfter);
    let supabase;
    try {
      supabase = getSupabaseAdminClient();
    } catch {
      return Response.json(
        { error: "Discount validation is not configured." },
        { status: 503 },
      );
    }
    const { data, error } = await supabase.rpc("calculate_promotion_discount", {
      p_tenant_id: tenantId,
      p_code: code,
      p_amount: Math.max(0, Number(body.amount || 0)),
      p_product_ids: (body.productIds || []).filter(isValidUuid).slice(0, 100),
      p_service_id:
        body.serviceId && isValidUuid(body.serviceId) ? body.serviceId : null,
    });
    if (error)
      return Response.json(
        {
          error: publicOperationError(
            error,
            "That discount code is not valid.",
          ),
        },
        { status: 400 },
      );
    return Response.json(data);
  } catch {
    return Response.json(
      { error: "Invalid discount request." },
      { status: 400 },
    );
  }
}
