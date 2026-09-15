import { createHash, timingSafeEqual } from "node:crypto";

import { sendTransactionalEmail } from "@/app/lib/email/resend";
import { getSupabaseAdminClient } from "@/app/lib/supabase/admin";
import { getSupabaseServerClient } from "@/app/lib/supabase/server";
import { safeServerError } from "@/app/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Invitation tokens are intentionally bounded before hashing.
 * UUID validation prevents malformed tenant/invitation identifiers from
 * reaching the database layer.
 */
function validUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

/**
 * Constant-time comparison for invitation-token hashes.
 *
 * timingSafeEqual requires equal-length buffers, so length is checked first.
 */
function safeHashEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

/**
 * Resolves the application origin used in invitation links.
 *
 * Prefer the configured production URL. If it is missing or invalid, fall
 * back to the current request origin. Only HTTP(S) origins are accepted.
 */
function getApplicationOrigin(request: Request): string {
  const fallbackOrigin = new URL(request.url).origin;
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!configured) {
    return fallbackOrigin;
  }

  try {
    const url = new URL(configured);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return fallbackOrigin;
    }

    return url.origin;
  } catch {
    return fallbackOrigin;
  }
}

/**
 * Sends a team invitation after revalidating:
 *
 * - the authenticated caller;
 * - tenant ownership;
 * - invitation status and expiry;
 * - business/subscription access;
 * - the plaintext invitation token against its stored SHA-256 hash.
 *
 * The service-role client is only used after the caller has been authorized.
 */
export async function POST(request: Request) {
  try {
    /* ----------------------------------------------------------------------
       1. Authenticate the current user
       ---------------------------------------------------------------------- */

    const supabase = await getSupabaseServerClient();

    if (!supabase) {
      return Response.json(
        {
          sent: false,
          error: "Supabase is not configured.",
        },
        { status: 503 },
      );
    }

    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      return Response.json(
        {
          sent: false,
          error: "Unauthorized.",
        },
        { status: 401 },
      );
    }

    /* ----------------------------------------------------------------------
       2. Parse and validate request input
       ---------------------------------------------------------------------- */

    let body: {
      tenantId?: string;
      invitationId?: string;
      token?: string;
    };

    try {
      body = (await request.json()) as typeof body;
    } catch {
      return Response.json(
        {
          sent: false,
          error: "Invalid request body.",
        },
        { status: 400 },
      );
    }

    const tenantId = body.tenantId?.trim() || "";
    const invitationId = body.invitationId?.trim() || "";
    const token = body.token?.trim() || "";

    if (
      !validUuid(tenantId) ||
      !validUuid(invitationId) ||
      token.length < 32 ||
      token.length > 256
    ) {
      return Response.json(
        {
          sent: false,
          error: "Invalid invitation request.",
        },
        { status: 400 },
      );
    }

    /* ----------------------------------------------------------------------
       3. Authorize the caller as this business's OWNER
       ---------------------------------------------------------------------- */

    const { data: membership, error: membershipError } = await supabase
      .from("tenant_memberships")
      .select("id, roles(name)")
      .eq("tenant_id", tenantId)
      .eq("profile_id", authData.user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (membershipError) {
      throw membershipError;
    }

    const roles = membership?.roles as unknown as
      { name?: string } | Array<{ name?: string }> | null;

    const role = Array.isArray(roles) ? roles[0]?.name : roles?.name;

    if (role?.toUpperCase() !== "OWNER") {
      return Response.json(
        {
          sent: false,
          error: "Only the business owner can send this invitation.",
        },
        { status: 403 },
      );
    }

    /* ----------------------------------------------------------------------
       4. Reload the authoritative invitation and tenant
       ---------------------------------------------------------------------- */

    const admin = getSupabaseAdminClient();

    const [
      { data: invitation, error: invitationError },
      { data: tenant, error: tenantError },
    ] = await Promise.all([
      admin
        .from("team_invitations")
        .select(
          "id, tenant_id, email, role_name, token_hash, status, expires_at, email_sent_at",
        )
        .eq("id", invitationId)
        .eq("tenant_id", tenantId)
        .maybeSingle(),

      admin
        .from("tenants")
        .select(
          "id, business_name, email, is_active, status, subscription_status, trial_ends_at",
        )
        .eq("id", tenantId)
        .maybeSingle(),
    ]);

    if (invitationError || tenantError) {
      throw invitationError || tenantError;
    }

    /* ----------------------------------------------------------------------
       5. Ensure the invitation is still usable
       ---------------------------------------------------------------------- */

    const invitationExpiresAt = invitation?.expires_at
      ? new Date(invitation.expires_at)
      : null;

    if (
      !invitation ||
      !tenant ||
      invitation.status?.toUpperCase() !== "PENDING" ||
      !invitationExpiresAt ||
      Number.isNaN(invitationExpiresAt.getTime()) ||
      invitationExpiresAt <= new Date()
    ) {
      return Response.json(
        {
          sent: false,
          error: "This invitation is no longer active.",
        },
        { status: 409 },
      );
    }

    /* ----------------------------------------------------------------------
       6. Verify that the tenant currently has team access
       ---------------------------------------------------------------------- */

    const subscriptionStatus = tenant.subscription_status?.toLowerCase() || "";

    const trialEndsAt = tenant.trial_ends_at
      ? new Date(tenant.trial_ends_at)
      : null;

    const validTrial =
      subscriptionStatus === "trial" &&
      trialEndsAt !== null &&
      !Number.isNaN(trialEndsAt.getTime()) &&
      trialEndsAt > new Date();

    const subscriptionActive = subscriptionStatus === "active" || validTrial;

    if (
      !tenant.is_active ||
      tenant.status?.toUpperCase() !== "ACTIVE" ||
      !subscriptionActive
    ) {
      return Response.json(
        {
          sent: false,
          error: "This business does not currently have active team access.",
        },
        { status: 403 },
      );
    }

    /* ----------------------------------------------------------------------
       7. Verify the supplied invitation token
       ---------------------------------------------------------------------- */

    const suppliedHash = createHash("sha256")
      .update(token, "utf8")
      .digest("hex");

    const storedHash =
      typeof invitation.token_hash === "string"
        ? invitation.token_hash.trim().toLowerCase()
        : "";

    if (!storedHash || !safeHashEqual(suppliedHash, storedHash)) {
      return Response.json(
        {
          sent: false,
          error: "Invalid invitation token.",
        },
        { status: 403 },
      );
    }

    /* ----------------------------------------------------------------------
       8. Build the invitation URL from the trusted application origin
       ---------------------------------------------------------------------- */

    const appUrl = getApplicationOrigin(request);
    const invitationUrl = new URL("/team/invite", appUrl);

    invitationUrl.searchParams.set("token", token);

    /* ----------------------------------------------------------------------
       9. Send through the centralized Resend transport
       ---------------------------------------------------------------------- */

    const result = await sendTransactionalEmail({
      eventType: "TEAM_INVITATION",
      to: invitation.email,
      recipientName: invitation.email.split("@")[0],

      payload: {
        business_name: tenant.business_name,
        inviter_name:
          authData.user.user_metadata?.full_name ||
          authData.user.email ||
          "The business owner",
        role: invitation.role_name.toLowerCase(),
        invitation_url: invitationUrl.toString(),
        app_url: appUrl,
      },

      /**
       * A stable key prevents retries of this same invitation record from
       * creating duplicate provider submissions.
       */
      idempotencyKey: `team-invitation/${invitation.id}`,

      replyTo: tenant.email,
    });

    /* ----------------------------------------------------------------------
       10. Record provider acceptance on the invitation
       ---------------------------------------------------------------------- */

    const { error: updateError } = await admin
      .from("team_invitations")
      .update({
        email_sent_at: new Date().toISOString(),
        email_provider_message_id: result.providerMessageId,
      })
      .eq("id", invitation.id)
      .eq("tenant_id", tenantId);

    /**
     * Resend may already have accepted the message at this point. If recording
     * the provider ID fails, surface the server error rather than falsely
     * reporting that the database was updated successfully. The stable Resend
     * idempotency key protects a retry from creating another provider message.
     */
    if (updateError) {
      throw updateError;
    }

    return Response.json({
      sent: true,
    });
  } catch (error) {
    const serverResponse = safeServerError(
      "team-invitation-email",
      error,
      "Unable to deliver team invitation.",
    );

    /**
     * Preserve safeServerError's response body and headers while keeping this
     * delivery endpoint's external failure status as 502.
     */
    return new Response(serverResponse.body, {
      status: 502,
      headers: serverResponse.headers,
    });
  }
}
