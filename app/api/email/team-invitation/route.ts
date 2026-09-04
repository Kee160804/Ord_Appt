import { createHash, timingSafeEqual } from "node:crypto";
import { getSupabaseServerClient } from "@/app/lib/supabase/server";
import { getSupabaseAdminClient } from "@/app/lib/supabase/admin";
import { sendTransactionalEmail } from "@/app/lib/email/resend";
import { safeServerError } from "@/app/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    if (!supabase)
      return Response.json(
        { sent: false, error: "Supabase is not configured." },
        { status: 503 },
      );
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user)
      return Response.json(
        { sent: false, error: "Unauthorized." },
        { status: 401 },
      );

    const body = (await request.json()) as {
      tenantId?: string;
      invitationId?: string;
      token?: string;
    };
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
        { sent: false, error: "Invalid invitation request." },
        { status: 400 },
      );
    }

    const { data: membership } = await supabase
      .from("tenant_memberships")
      .select("id, roles(name)")
      .eq("tenant_id", tenantId)
      .eq("profile_id", authData.user.id)
      .eq("is_active", true)
      .maybeSingle();
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
    if (invitationError || tenantError) throw invitationError || tenantError;
    if (
      !invitation ||
      !tenant ||
      invitation.status !== "PENDING" ||
      new Date(invitation.expires_at) <= new Date()
    ) {
      return Response.json(
        { sent: false, error: "This invitation is no longer active." },
        { status: 409 },
      );
    }
    const subscriptionActive =
      tenant.subscription_status?.toLowerCase() === "active" ||
      (tenant.subscription_status?.toLowerCase() === "trial" &&
        tenant.trial_ends_at &&
        new Date(tenant.trial_ends_at) > new Date());
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

    const suppliedHash = Buffer.from(
      createHash("sha256").update(token, "utf8").digest("hex"),
    );
    const storedHash = Buffer.from(invitation.token_hash);
    if (
      suppliedHash.length !== storedHash.length ||
      !timingSafeEqual(suppliedHash, storedHash)
    ) {
      return Response.json(
        { sent: false, error: "Invalid invitation token." },
        { status: 403 },
      );
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      new URL(request.url).origin;
    const invitationUrl = new URL("/team/invite", appUrl);
    invitationUrl.searchParams.set("token", token);
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
      idempotencyKey: `team-invitation/${invitation.id}`,
      replyTo: tenant.email,
    });
    await admin
      .from("team_invitations")
      .update({
        email_sent_at: new Date().toISOString(),
        email_provider_message_id: result.providerMessageId,
      })
      .eq("id", invitation.id)
      .eq("tenant_id", tenantId);
    return Response.json({ sent: true });
  } catch (error) {
    const response = safeServerError(
      "team-invitation-email",
      error,
      "Unable to deliver team invitation.",
    );
    return new Response(response.body, {
      status: 502,
      headers: response.headers,
    });
  }
}
