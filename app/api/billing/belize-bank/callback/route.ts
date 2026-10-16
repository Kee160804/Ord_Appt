import {
  findBelizeBankCheckoutForCallback,
  reconcileBelizeBankSubscriptionCheckout,
} from "@/app/lib/billing/belize-bank-checkout";
import {
  enforcePublicRateLimit,
  rateLimitResponse,
  safeServerError,
} from "@/app/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function text(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > 8_192) {
      return text("Invalid callback.", 413);
    }
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 8_192) {
      return text("Invalid callback.", 413);
    }
    const values = new URLSearchParams(raw);
    const gatewayOrderId = values.get("mdOrder")?.trim() ?? "";
    const merchantOrderNumber = values.get("orderNumber")?.trim() ?? "";
    const operation = values.get("operation")?.trim().toLowerCase() ?? "";
    const callbackStatus = values.get("status")?.trim() ?? "";
    if (
      (!gatewayOrderId && !merchantOrderNumber) ||
      gatewayOrderId.length > 200 ||
      merchantOrderNumber.length > 200 ||
      operation.length > 64 ||
      callbackStatus.length > 16
    ) {
      return text("Invalid callback.", 400);
    }

    const session = await findBelizeBankCheckoutForCallback(
      gatewayOrderId,
      merchantOrderNumber,
    );
    if (!session) return text("Unknown payment.", 404);

    const rate = await enforcePublicRateLimit(
      request,
      "belize-bank-subscription-callback",
      session.tenant_id,
      gatewayOrderId || merchantOrderNumber,
      30,
      300,
    );
    if (!rate.allowed) return rateLimitResponse(rate.retryAfter);

    // The callback itself is not treated as proof of payment because the Bank
    // guide does not document a callback signature. Always re-query the
    // authenticated status endpoint before changing subscription access.
    await reconcileBelizeBankSubscriptionCheckout(session, operation);
    return text("OK");
  } catch (error) {
    return safeServerError(
      "belize-bank-subscription-callback",
      error,
      "Unable to verify the Belize Bank callback.",
    );
  }
}
