import {
  findBelizeBankCheckoutByRequest,
  reconcileBelizeBankSubscriptionCheckout,
} from "@/app/lib/billing/belize-bank-checkout";
import { authorizeBillingOwner } from "@/app/lib/server/billing-authorization";
import { isValidUuid, safeServerError } from "@/app/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const tenantId = url.searchParams.get("tenantId")?.trim() ?? "";
    const requestId = url.searchParams.get("requestId")?.trim() ?? "";
    if (!isValidUuid(tenantId) || !isValidUuid(requestId)) {
      return Response.json(
        { error: "Invalid checkout status request." },
        { status: 400 },
      );
    }
    const authorization = await authorizeBillingOwner(tenantId);
    if (!authorization.authorized) return authorization.response;
    const session = await findBelizeBankCheckoutByRequest(tenantId, requestId);
    if (!session) {
      return Response.json(
        { error: "Payment attempt not found." },
        { status: 404 },
      );
    }
    const result = await reconcileBelizeBankSubscriptionCheckout(session);
    return Response.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return safeServerError(
      "belize-bank-subscription-status",
      error,
      "Unable to verify the Belize Bank payment.",
    );
  }
}
