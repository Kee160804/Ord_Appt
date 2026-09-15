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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_NAME_LENGTH = 120;
const MAX_SUBJECT_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 5_000;

interface ContactRequest {
  tenantId?: string;
  name?: string;
  email?: string;
  subject?: string;
  message?: string;

  /**
   * Honeypot field.
   * Real storefront users should never populate this.
   */
  website?: string;
}

/**
 * Return uncached responses from this public mutation endpoint.
 */
function json(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

/**
 * POST /api/public/contact
 *
 * Public storefront contact form.
 *
 * Security flow:
 *
 * 1. Validate Origin when supplied.
 * 2. Read a size-limited JSON request.
 * 3. Reject honeypot submissions.
 * 4. Validate tenant and sender email.
 * 5. Validate/bound public text fields.
 * 6. Apply distributed rate limiting.
 * 7. Submit through the authoritative Supabase RPC.
 */
export async function POST(
  request: Request,
): Promise<Response> {
  /* -----------------------------------------------------------------------
     1. SAME-ORIGIN PROTECTION
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
       2. READ BOUNDED JSON BODY
       --------------------------------------------------------------------- */

    const body =
      await readJsonBody<ContactRequest>(
        request,
        16_384,
      );

    /* ---------------------------------------------------------------------
       3. HONEYPOT / BASIC BOT PROTECTION
       --------------------------------------------------------------------- */

    if (body.website?.trim()) {
      return json(
        {
          error: "Invalid contact request.",
        },
        400,
      );
    }

    /* ---------------------------------------------------------------------
       4. NORMALIZE PUBLIC INPUT
       --------------------------------------------------------------------- */

    const tenantId =
      body.tenantId?.trim() || "";

    const name =
      body.name?.trim() || "";

    const email =
      body.email
        ?.trim()
        .toLowerCase() || "";

    const subject =
      body.subject?.trim() || "";

    const message =
      body.message?.trim() || "";

    /* ---------------------------------------------------------------------
       5. VALIDATE TENANT + EMAIL
       --------------------------------------------------------------------- */

    if (
      !isValidUuid(tenantId) ||
      !isValidEmail(email)
    ) {
      return json(
        {
          error: "Invalid contact request.",
        },
        400,
      );
    }

    /* ---------------------------------------------------------------------
       6. VALIDATE NAME
       --------------------------------------------------------------------- */

    if (
      name.length < 2 ||
      name.length > MAX_NAME_LENGTH
    ) {
      return json(
        {
          error:
            "Enter a valid name.",
        },
        400,
      );
    }

    /* ---------------------------------------------------------------------
       7. VALIDATE SUBJECT
       --------------------------------------------------------------------- */

    if (
      subject.length < 2 ||
      subject.length > MAX_SUBJECT_LENGTH
    ) {
      return json(
        {
          error:
            "Enter a valid subject.",
        },
        400,
      );
    }

    /* ---------------------------------------------------------------------
       8. VALIDATE MESSAGE

       The request itself is limited to 16 KB, but we also enforce a
       field-specific limit so unusually large metadata cannot crowd out
       the actual message.
       --------------------------------------------------------------------- */

    if (
      message.length < 2 ||
      message.length > MAX_MESSAGE_LENGTH
    ) {
      return json(
        {
          error:
            message.length > MAX_MESSAGE_LENGTH
              ? "Your message is too long."
              : "Enter a message.",
        },
        400,
      );
    }

    /* ---------------------------------------------------------------------
       9. DISTRIBUTED RATE LIMIT

       Three contact submissions per tenant/sender fingerprint every
       fifteen minutes.

       The hardened security.ts implementation uses the Supabase-backed
       distributed limiter in production.
       --------------------------------------------------------------------- */

    const rate =
      await enforcePublicRateLimit(
        request,
        "contact",
        tenantId,
        email,
        3,
        900,
      );

    if (!rate.allowed) {
      return rateLimitResponse(
        rate.retryAfter,
      );
    }

    /* ---------------------------------------------------------------------
       10. INITIALIZE TRUSTED SERVER-ONLY SUPABASE CLIENT
       --------------------------------------------------------------------- */

    let supabase;

    try {
      supabase =
        getSupabaseAdminClient();
    } catch {
      return json(
        {
          error:
            "Storefront messaging is not configured.",
        },
        503,
      );
    }

    /* ---------------------------------------------------------------------
       11. SUBMIT CONTACT MESSAGE

       The browser never writes directly to the contact-message table.

       The server-only Supabase client invokes the database RPC, which
       remains responsible for tenant/business validation and persistence.
       --------------------------------------------------------------------- */

    const { data, error } =
      await supabase.rpc(
        "submit_storefront_contact_message",
        {
          p_tenant_id:
            tenantId,

          p_sender_name:
            name,

          p_sender_email:
            email,

          p_subject:
            subject,

          p_message:
            message,
        },
      );

    /* ---------------------------------------------------------------------
       12. SAFE BUSINESS-RULE ERROR HANDLING
       --------------------------------------------------------------------- */

    if (error) {
      return json(
        {
          error: publicOperationError(
            error,
            "Unable to send your message. Please try again.",
          ),
        },
        400,
      );
    }

    /* ---------------------------------------------------------------------
       13. VERIFY RPC RESULT

       A successful request should produce a persisted message identifier.
       --------------------------------------------------------------------- */

    const messageId =
      typeof data === "string"
        ? data
        : Array.isArray(data)
          ? data[0]?.message_id ??
            data[0]?.id
          : data?.message_id ??
            data?.id;

    if (
      !messageId ||
      typeof messageId !== "string"
    ) {
      console.error(
        "[public-contact] Contact RPC returned no message identifier.",
      );

      return json(
        {
          error:
            "Your message could not be confirmed. Please try again.",
        },
        502,
      );
    }

    /* ---------------------------------------------------------------------
       14. RETURN MINIMAL PUBLIC RESPONSE
       --------------------------------------------------------------------- */

    return json({
      messageId,
    });
  } catch (error) {
    /* ---------------------------------------------------------------------
       15. REQUEST PARSING FAILURES
       --------------------------------------------------------------------- */

    if (
      error instanceof Error &&
      error.message ===
        "REQUEST_TOO_LARGE"
    ) {
      return json(
        {
          error:
            "The contact request is too large.",
        },
        413,
      );
    }

    if (
      error instanceof Error &&
      error.message === "INVALID_JSON"
    ) {
      return json(
        {
          error:
            "Invalid contact request.",
        },
        400,
      );
    }

    console.error(
      "[public-contact] Unexpected request failure.",
      error,
    );

    return json(
      {
        error:
          "Invalid contact request.",
      },
      400,
    );
  }
}
