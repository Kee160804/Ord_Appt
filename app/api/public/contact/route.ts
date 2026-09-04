import { getSupabaseAdminClient } from "@/app/lib/supabase/admin";
import {
  enforcePublicRateLimit,
  isValidEmail,
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
      name?: string;
      email?: string;
      subject?: string;
      message?: string;
      website?: string;
    }>(request, 16_384);
    const tenantId = body.tenantId?.trim() || "";
    const email = body.email?.trim().toLowerCase() || "";
    if (body.website || !isValidUuid(tenantId) || !isValidEmail(email))
      return Response.json(
        { error: "Invalid contact request." },
        { status: 400 },
      );
    const rate = await enforcePublicRateLimit(
      request,
      "contact",
      tenantId,
      email,
      3,
      900,
    );
    if (!rate.allowed) return rateLimitResponse(rate.retryAfter);
    let supabase;
    try {
      supabase = getSupabaseAdminClient();
    } catch {
      return Response.json(
        { error: "Storefront messaging is not configured." },
        { status: 503 },
      );
    }
    const { data, error } = await supabase.rpc(
      "submit_storefront_contact_message",
      {
        p_tenant_id: tenantId,
        p_sender_name: body.name?.trim() || "",
        p_sender_email: email,
        p_subject: body.subject?.trim() || "",
        p_message: body.message?.trim() || "",
      },
    );
    if (error)
      return Response.json(
        {
          error: publicOperationError(
            error,
            "Unable to send your message. Please try again.",
          ),
        },
        { status: 400 },
      );
    return Response.json({ messageId: data });
  } catch {
    return Response.json(
      { error: "Invalid contact request." },
      { status: 400 },
    );
  }
}
