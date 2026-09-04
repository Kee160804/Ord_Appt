import { getSupabaseBrowserClient } from "@/app/lib/supabase/client";
import type { PlanType } from "@/app/types";

export type BusinessTeamRole = "manager" | "staff";

export interface BusinessTeamMember {
  membershipId: string;
  profileId: string;
  name: string;
  email: string;
  role: "owner" | "admin" | BusinessTeamRole;
  isActive: boolean;
  joinedAt: string;
}

export interface BusinessTeamInvitation {
  id: string;
  email: string;
  role: BusinessTeamRole;
  status: "pending";
  expiresAt: string;
  createdAt: string;
}

export interface PendingSeatRequest {
  id: string;
  requestedPaidSeats: number;
  status: "pending";
  createdAt: string;
}

export interface BusinessTeamSummary {
  tenantId: string;
  plan: PlanType;
  includedStaff: number;
  maxStaff: number;
  paidStaffSeats: number;
  authorizedStaff: number;
  activeStaff: number;
  additionalSeatPrice: number;
  monthlySeatCharge: number;
  members: BusinessTeamMember[];
  invitations: BusinessTeamInvitation[];
  pendingSeatRequest: PendingSeatRequest | null;
}

export interface CreatedTeamInvitation {
  id: string;
  token: string;
  email: string;
  role: BusinessTeamRole;
  expiresAt: string;
  emailSent?: boolean;
}

export interface AdminSeatSummary {
  paidStaffSeats: number;
  includedStaff: number;
  maxStaff: number;
  additionalSeatPrice: number;
  activeStaff: number;
  pendingRequest: {
    id: string;
    requestedPaidSeats: number;
    createdAt: string;
  } | null;
}

function client() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

function rpcError(
  error: { code?: string; message: string } | null,
  fallback: string,
) {
  if (!error) return;
  if (error.code === "PGRST202") {
    throw new Error(
      "Team & Access is not installed yet. Apply the business team migration in Supabase.",
    );
  }
  throw new Error(error.message || fallback);
}

function normalizePlan(value: unknown): PlanType {
  const plan = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (plan === "pro") return "pro";
  if (plan === "enterprise") return "enterprise";
  // Older tenant rows may store the public label `beginner`. Internally the
  // application has always used `starter` for the Beginner plan.
  return "starter";
}

export async function getBusinessTeamSummary(tenantId: string) {
  const { data, error } = await client().rpc("get_tenant_team_summary", {
    p_tenant_id: tenantId,
  });
  rpcError(error, "Unable to load this business team.");
  if (!data || typeof data !== "object") {
    throw new Error("Supabase returned an invalid business team response.");
  }
  const summary = data as BusinessTeamSummary & { plan?: unknown };
  return {
    ...summary,
    plan: normalizePlan(summary.plan),
    members: Array.isArray(summary.members) ? summary.members : [],
    invitations: Array.isArray(summary.invitations) ? summary.invitations : [],
  } satisfies BusinessTeamSummary;
}

export async function createBusinessTeamInvitation(
  tenantId: string,
  email: string,
  role: BusinessTeamRole,
) {
  const { data, error } = await client().rpc("create_team_invitation", {
    p_tenant_id: tenantId,
    p_email: email.trim().toLowerCase(),
    p_role_name: role,
  });
  rpcError(error, "Unable to create the team invitation.");
  const invitation = data as CreatedTeamInvitation;
  try {
    const response = await fetch("/api/email/team-invitation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId,
        invitationId: invitation.id,
        token: invitation.token,
      }),
    });
    invitation.emailSent = response.ok;
  } catch {
    invitation.emailSent = false;
  }
  return invitation;
}

export async function changeBusinessTeamRole(
  tenantId: string,
  membershipId: string,
  role: BusinessTeamRole,
) {
  const { error } = await client().rpc("update_team_member_role", {
    p_tenant_id: tenantId,
    p_membership_id: membershipId,
    p_role_name: role,
  });
  rpcError(error, "Unable to update this team member.");
}

export async function removeBusinessTeamMember(
  tenantId: string,
  membershipId: string,
) {
  const { error } = await client().rpc("deactivate_team_member", {
    p_tenant_id: tenantId,
    p_membership_id: membershipId,
  });
  rpcError(error, "Unable to remove this team member.");
}

export async function revokeBusinessTeamInvitation(
  tenantId: string,
  invitationId: string,
) {
  const { error } = await client().rpc("revoke_team_invitation", {
    p_tenant_id: tenantId,
    p_invitation_id: invitationId,
  });
  rpcError(error, "Unable to revoke this invitation.");
}

export async function acceptBusinessTeamInvitation(
  token: string,
  fullName = "",
) {
  const { data, error } = await client().rpc("accept_team_invitation", {
    p_token: token,
    p_full_name: fullName.trim(),
  });
  rpcError(error, "Unable to accept this team invitation.");
  return data as string;
}

export async function requestPaidStaffSeats(
  tenantId: string,
  requestedPaidSeats: number,
) {
  const { error } = await client().rpc("request_tenant_paid_staff_seats", {
    p_tenant_id: tenantId,
    p_requested_paid_seats: requestedPaidSeats,
  });
  rpcError(error, "Unable to request additional staff seats.");
}

export async function getAdminSeatSummary(tenantId: string) {
  const { data, error } = await client().rpc("get_tenant_seat_admin_summary", {
    p_tenant_id: tenantId,
  });
  rpcError(error, "Unable to load paid staff seats.");
  return data as AdminSeatSummary;
}

export async function setAdminPaidStaffSeats(
  tenantId: string,
  paidStaffSeats: number,
  requestId?: string,
  reviewNote?: string,
) {
  const { error } = await client().rpc("set_tenant_paid_staff_seats", {
    p_tenant_id: tenantId,
    p_paid_staff_seats: paidStaffSeats,
    p_request_id: requestId ?? null,
    p_review_note: reviewNote ?? "",
  });
  rpcError(error, "Unable to update paid staff seats.");
}

export async function rejectAdminPaidStaffSeatRequest(
  tenantId: string,
  requestId: string,
  reviewNote: string,
) {
  const { error } = await client().rpc(
    "reject_tenant_paid_staff_seat_request",
    {
      p_tenant_id: tenantId,
      p_request_id: requestId,
      p_review_note: reviewNote.trim(),
    },
  );
  rpcError(error, "Unable to reject this paid-seat request.");
}
