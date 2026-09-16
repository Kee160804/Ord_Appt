import { getSupabaseAdminClient } from "@/app/lib/supabase/admin";

import {
  enforcePublicRateLimit,
  isValidUuid,
  publicOperationError,
  rateLimitResponse,
  readJsonBody,
  requestHasAllowedOrigin,
} from "@/app/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PRODUCT_IDS = 100;
const MAX_PROMOTION_AMOUNT = 1_000_000;

interface PromotionRequest {
  tenantId?: string;
  code?: string;

  /**
   * Client-provided subtotal used only to preview a promotion.
   *
   * This value must NEVER be trusted as the final transaction subtotal.
   * Order/appointment creation must recalculate pricing and discounts using
   * authoritative database values.
   */
  amount?: number;

  productIds?: string[];
  serviceId?: string;

  /**
   * Honeypot field.
   */
  website?: string;
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

/**
 * POST /api/public/promotions
 *
 * Validates a promotion for storefront preview purposes.
 *
 * SECURITY:
 * This endpoint does not authorize the final transaction price.
 *
 * The order/appointment creation RPC must independently validate:
 * - product/service prices
 * - promotion eligibility
 * - minimum purchase
 * - expiration
 * - usage limits
 * - tenant ownership
 * - final discount
 * - final transaction total
 */
export async function POST(request: Request): Promise<Response> {
  /* -----------------------------------------------------------------------
     1. SAME-ORIGIN CHECK
     ----------------------------------------------------------------------- */

  if (!requestHasAllowedOrigin(request)) {
    return json(
      {
        error: "Invalid request origin.",
      },
      403,
    );
  }

  try {
    /* ---------------------------------------------------------------------
       2. READ BOUNDED REQUEST
       --------------------------------------------------------------------- */

    const body = await readJsonBody<PromotionRequest>(request, 8_192);

    /* ---------------------------------------------------------------------
       3. HONEYPOT
       --------------------------------------------------------------------- */

    if (body.website?.trim()) {
      return json(
        {
          error: "Invalid discount code.",
        },
        400,
      );
    }

    /* ---------------------------------------------------------------------
       4. NORMALIZE IDENTIFIERS
       --------------------------------------------------------------------- */

    const tenantId = body.tenantId?.trim() || "";

    const code = body.code?.trim().toUpperCase() || "";

    const serviceId = body.serviceId?.trim() || null;

    /* ---------------------------------------------------------------------
       5. VALIDATE TENANT + PROMOTION CODE
       --------------------------------------------------------------------- */

    if (!isValidUuid(tenantId) || !/^[A-Z0-9_-]{2,32}$/.test(code)) {
      return json(
        {
          error: "Invalid discount code.",
        },
        400,
      );
    }

    /* ---------------------------------------------------------------------
       6. VALIDATE SERVICE ID

       Do not silently convert an invalid supplied UUID into null.
       --------------------------------------------------------------------- */

    if (serviceId && !isValidUuid(serviceId)) {
      return json(
        {
          error: "Invalid promotion request.",
        },
        400,
      );
    }

    /* ---------------------------------------------------------------------
       7. VALIDATE PRODUCT IDs

       The previous implementation filtered invalid IDs out of the array.

       Example:

       [
         "valid-product-id",
         "malformed-id"
       ]

       would silently become:

       [
         "valid-product-id"
       ]

       Instead, reject malformed input.
       --------------------------------------------------------------------- */

    const productIds = body.productIds ?? [];

    if (!Array.isArray(productIds)) {
      return json(
        {
          error: "Invalid promotion request.",
        },
        400,
      );
    }

    if (productIds.length > MAX_PRODUCT_IDS) {
      return json(
        {
          error: "Too many products were submitted.",
        },
        400,
      );
    }

    const normalizedProductIds: string[] = [];

    for (const productId of productIds) {
      if (typeof productId !== "string") {
        return json(
          {
            error: "Invalid promotion request.",
          },
          400,
        );
      }

      const normalized = productId.trim();

      if (!isValidUuid(normalized)) {
        return json(
          {
            error: "Invalid promotion request.",
          },
          400,
        );
      }

      normalizedProductIds.push(normalized);
    }

    /**
     * Duplicate IDs do not provide useful promotion context.
     */
    const uniqueProductIds = [...new Set(normalizedProductIds)];

    /* ---------------------------------------------------------------------
       8. VALIDATE CLIENT PREVIEW AMOUNT

       IMPORTANT:
       This amount is NOT authoritative.

       It is only used for the storefront promotion preview. Final pricing
       must still be recalculated during order/appointment creation.
       --------------------------------------------------------------------- */

    const amount = Number(body.amount);

    if (
      !Number.isFinite(amount) ||
      amount < 0 ||
      amount > MAX_PROMOTION_AMOUNT
    ) {
      return json(
        {
          error: "Invalid promotion amount.",
        },
        400,
      );
    }

    /* ---------------------------------------------------------------------
       9. DISTRIBUTED RATE LIMIT

       Maximum 12 promotion checks for this tenant/code/fingerprint within
       five minutes.
       --------------------------------------------------------------------- */

    const rate = await enforcePublicRateLimit(
      request,
      "promotion",
      tenantId,
      code,
      12,
      300,
    );

    if (!rate.allowed) {
      return rateLimitResponse(rate.retryAfter);
    }

    /* ---------------------------------------------------------------------
       10. INITIALIZE TRUSTED SUPABASE CLIENT
       --------------------------------------------------------------------- */

    let supabase;

    try {
      supabase = getSupabaseAdminClient();
    } catch {
      return json(
        {
          error: "Discount validation is not configured.",
        },
        503,
      );
    }

    /* ---------------------------------------------------------------------
       11. CALCULATE PROMOTION PREVIEW

       Supabase remains responsible for determining whether the promotion:
       - belongs to this tenant
       - is active
       - is within its date range
       - applies to the submitted products/service
       - meets its minimum requirements
       - has remaining usage
       --------------------------------------------------------------------- */

    const { data, error } = await supabase.rpc("calculate_promotion_discount", {
      p_tenant_id: tenantId,

      p_code: code,

      p_amount: amount,

      p_product_ids: uniqueProductIds,

      p_service_id: serviceId,
    });

    if (error) {
      return json(
        {
          error: publicOperationError(
            error,
            "That discount code is not valid.",
          ),
        },
        400,
      );
    }

    /* ---------------------------------------------------------------------
       12. RETURN PROMOTION PREVIEW

       The returned discount remains informational until the final
       transaction RPC independently validates it.
       --------------------------------------------------------------------- */

    return json(data);
  } catch (error) {
    if (error instanceof Error && error.message === "REQUEST_TOO_LARGE") {
      return json(
        {
          error: "The discount request is too large.",
        },
        413,
      );
    }

    if (error instanceof Error && error.message === "INVALID_JSON") {
      return json(
        {
          error: "Invalid discount request.",
        },
        400,
      );
    }

    console.error("[public-promotion] Unexpected request failure.", error);

    return json(
      {
        error: "Invalid discount request.",
      },
      400,
    );
  }
}
