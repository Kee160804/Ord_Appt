import { randomBytes } from "node:crypto";

import { sendTransactionalEmail } from "@/app/lib/email/resend";
import { publicAppOrigin } from "@/app/lib/platform";
import {
  enforcePlatformRateLimit,
  isValidEmail,
  rateLimitResponse,
  readJsonBody,
  requestHasAllowedOrigin,
} from "@/app/lib/server/security";
import { getSupabaseAdminClient } from "@/app/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUEST_TYPES = new Set([
  "ACCESS",
  "CORRECTION",
  "DELETION",
  "EXPORT",
  "OBJECTION",
  "RESTRICTION",
  "CONSENT_WITHDRAWAL",
  "OTHER",
]);
const RELATIONSHIPS = new Set([
  "ACCOUNT_HOLDER",
  "BUSINESS_OWNER",
  "STOREFRONT_CUSTOMER",
  "OTHER",
]);

interface PrivacyRequestBody {
  name?: string;
  email?: string;
  requestType?: string;
  relationship?: string;
  businessReference?: string;
  details?: string;
  website?: string;
}

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function referenceCode() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `PRIV-${date}-${randomBytes(5).toString("hex").toUpperCase()}`;
}

export async function POST(request: Request) {
  if (!requestHasAllowedOrigin(request)) {
    return json({ error: "Invalid request origin." }, 403);
  }

  try {
    const body = await readJsonBody<PrivacyRequestBody>(request, 16_384);
    if (body.website?.trim()) {
      return json({ error: "Unable to submit this request." }, 400);
    }

    const name = body.name?.trim() ?? "";
    const email = body.email?.trim().toLowerCase() ?? "";
    const requestType = body.requestType?.trim().toUpperCase() ?? "";
    const relationship = body.relationship?.trim().toUpperCase() ?? "";
    const businessReference = body.businessReference?.trim() || null;
    const details = body.details?.trim() ?? "";

    if (name.length < 2 || name.length > 120) {
      return json({ error: "Enter your full name." }, 400);
    }
    if (!isValidEmail(email)) {
      return json({ error: "Enter a valid email address." }, 400);
    }
    if (!REQUEST_TYPES.has(requestType)) {
      return json({ error: "Choose a valid request type." }, 400);
    }
    if (!RELATIONSHIPS.has(relationship)) {
      return json({ error: "Choose your relationship to YuhBusiness." }, 400);
    }
    if (businessReference && businessReference.length > 200) {
      return json({ error: "The business reference is too long." }, 400);
    }
    if (details.length < 20 || details.length > 5_000) {
      return json(
        { error: "Describe your request using 20 to 5,000 characters." },
        400,
      );
    }

    const rate = await enforcePlatformRateLimit(
      request,
      "privacy_request",
      email,
      3,
      86_400,
    );
    if (!rate.allowed) return rateLimitResponse(rate.retryAfter);

    const admin = getSupabaseAdminClient();
    const reference = referenceCode();
    const submittedAt = new Date().toISOString();
    const { data: created, error: insertError } = await admin
      .from("privacy_requests")
      .insert({
        reference_code: reference,
        request_type: requestType,
        relationship,
        requester_name: name,
        requester_email: email,
        business_reference: businessReference,
        details,
      })
      .select("id, reference_code")
      .single();

    if (insertError || !created)
      throw insertError ?? new Error("No request returned.");

    let acknowledgementSent = false;
    try {
      const delivery = await sendTransactionalEmail({
        eventType: "PRIVACY_REQUEST_RECEIVED",
        to: email,
        recipientName: name,
        idempotencyKey: `privacy-request/${created.id}`,
        payload: {
          reference_code: reference,
          request_type: requestType,
          submitted_at: submittedAt,
          app_url: publicAppOrigin(new URL(request.url).origin),
        },
      });
      acknowledgementSent = true;
      await admin
        .from("privacy_requests")
        .update({ acknowledgement_message_id: delivery.providerMessageId })
        .eq("id", created.id);
    } catch (emailError) {
      console.error("[privacy-request] Acknowledgement email was not sent.", {
        requestId: created.id,
        message:
          emailError instanceof Error ? emailError.message : "Unknown error",
      });
    }

    return json(
      {
        ok: true,
        referenceCode: reference,
        acknowledgementSent,
      },
      201,
    );
  } catch (error) {
    if (error instanceof Error && error.message === "REQUEST_TOO_LARGE") {
      return json({ error: "The request is too large." }, 413);
    }
    if (error instanceof Error && error.message === "INVALID_JSON") {
      return json({ error: "Invalid request." }, 400);
    }
    console.error("[privacy-request] Unable to record request.", error);
    return json(
      { error: "Unable to submit your request. Please try again." },
      500,
    );
  }
}
