"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CheckCircle2,
  Clock3,
  Copy,
  CreditCard,
  Loader2,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { Card, CardBody, CardHeader } from "@/app/components/Card";
import { PLAN_DEFINITIONS } from "@/app/lib/plans";
import {
  changeBusinessTeamRole,
  createBusinessTeamInvitation,
  getBusinessTeamSummary,
  removeBusinessTeamMember,
  requestPaidStaffSeats,
  revokeBusinessTeamInvitation,
  type BusinessTeamRole,
  type BusinessTeamSummary,
} from "@/app/services/teamService";
import type { Tenant } from "@/app/types";

const inputClass = "h-11 w-full rounded-xl border border-slate-600 bg-slate-900/70 px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 light:border-slate-300 light:bg-white light:text-slate-900";

export function TeamAccessView({ tenant }: { tenant: Tenant }) {
  const [summary, setSummary] = useState<BusinessTeamSummary | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<BusinessTeamRole>("staff");
  const [invitationLink, setInvitationLink] = useState("");
  const [requestedPaidSeats, setRequestedPaidSeats] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const result = await getBusinessTeamSummary(tenant.id);
      setSummary(result);
      setRequestedPaidSeats(Math.min(
        Math.max(result.paidStaffSeats + 1, 1),
        Math.max(result.maxStaff - result.includedStaff, 1),
      ));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load Team & Access.");
    } finally {
      setIsLoading(false);
    }
  }, [tenant.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const availableSeats = summary
    ? Math.max(0, summary.authorizedStaff - summary.activeStaff - summary.invitations.length)
    : 0;
  const maxPaidSeats = summary ? summary.maxStaff - summary.includedStaff : 0;
  const planName = (
    summary ? PLAN_DEFINITIONS[summary.plan] : PLAN_DEFINITIONS[tenant.plan]
  )?.name ?? PLAN_DEFINITIONS.starter.name;

  const activeMembers = useMemo(
    () => summary?.members.filter((member) => member.isActive) ?? [],
    [summary],
  );
  const formerMembers = useMemo(
    () => summary?.members.filter((member) => !member.isActive && member.role !== "owner") ?? [],
    [summary],
  );

  const invite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusyId("invite");
    setError("");
    setSuccess("");
    setInvitationLink("");
    try {
      const invitation = await createBusinessTeamInvitation(tenant.id, email, role);
      const link = new URL("/team/invite", window.location.origin);
      link.searchParams.set("token", invitation.token);
      setInvitationLink(link.toString());
      setEmail("");
      setSuccess(invitation.emailSent
        ? `Invitation emailed to ${invitation.email}. It expires in 72 hours.`
        : `Invitation created for ${invitation.email}, but email delivery was unavailable. Copy the secure link below.`);
      await load();
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : "Unable to invite this team member.");
    } finally {
      setBusyId("");
    }
  };

  const copyInvitation = async () => {
    try {
      await navigator.clipboard.writeText(invitationLink);
      setSuccess("Secure invitation link copied.");
    } catch {
      setError("Copy was blocked. Select and copy the invitation link manually.");
    }
  };

  const changeRole = async (membershipId: string, nextRole: BusinessTeamRole) => {
    setBusyId(membershipId);
    setError("");
    setSuccess("");
    try {
      await changeBusinessTeamRole(tenant.id, membershipId, nextRole);
      setSuccess("Team role updated.");
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update this role.");
    } finally {
      setBusyId("");
    }
  };

  const removeMember = async (membershipId: string, name: string) => {
    if (!window.confirm(`Remove ${name}'s access to ${tenant.name}? Their historical activity will remain stored.`)) return;
    setBusyId(membershipId);
    setError("");
    setSuccess("");
    try {
      await removeBusinessTeamMember(tenant.id, membershipId);
      setSuccess(`${name}'s access was removed.`);
      await load();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Unable to remove this team member.");
    } finally {
      setBusyId("");
    }
  };

  const revokeInvitation = async (invitationId: string) => {
    setBusyId(invitationId);
    setError("");
    setSuccess("");
    try {
      await revokeBusinessTeamInvitation(tenant.id, invitationId);
      setSuccess("Pending invitation revoked.");
      await load();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "Unable to revoke this invitation.");
    } finally {
      setBusyId("");
    }
  };

  const requestSeats = async () => {
    setBusyId("seats");
    setError("");
    setSuccess("");
    try {
      await requestPaidStaffSeats(tenant.id, requestedPaidSeats);
      setSuccess(`Request submitted for ${requestedPaidSeats} paid staff seat${requestedPaidSeats === 1 ? "" : "s"}. Access is added only after payment is confirmed.`);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to request paid seats.");
    } finally {
      setBusyId("");
    }
  };

  if (isLoading && !summary) {
    return <Card><CardBody className="flex min-h-48 items-center justify-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading Team & Access...</CardBody></Card>;
  }

  if (!summary) {
    return <Card><CardBody><p role="alert" className="rounded-xl bg-rose-500/10 p-4 text-sm text-rose-300 light:text-rose-700">{error || "Unable to load Team & Access."}</p></CardBody></Card>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-white light:text-slate-900"><Users className="h-4 w-4 text-violet-400" /> Team & Access</h3>
              <p className="mt-1 text-[11px] text-slate-400 light:text-slate-600">You control who can access this business. YuhBusiness controls subscription and seat authorization.</p>
            </div>
            <span className="rounded-full bg-violet-500/15 px-3 py-1 text-[10px] font-bold text-violet-300 light:text-violet-700">{planName} plan</span>
          </div>
        </CardHeader>
        <CardBody className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <SeatStat label="Active staff" value={`${summary.activeStaff} / ${summary.authorizedStaff}`} />
            <SeatStat label="Included staff" value={String(summary.includedStaff)} />
            <SeatStat label="Paid seat charge" value={`$${summary.monthlySeatCharge} BZD/mo`} />
          </div>

          {summary.maxStaff === 0 ? (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100 light:text-amber-800">
              Beginner is owner-only. Upgrade this business to Pro for one included staff member or Enterprise for two.
            </div>
          ) : (
            <form onSubmit={invite} className="rounded-2xl border border-slate-700 bg-slate-900/35 p-4 light:border-slate-200 light:bg-slate-50">
              <div className="flex items-center gap-2"><UserPlus className="h-4 w-4 text-violet-400" /><h4 className="text-xs font-bold">Invite a team member</h4></div>
              <p className="mt-1 text-[11px] leading-5 text-slate-400 light:text-slate-600">Invitations are locked to the entered email, expire after 72 hours, and can only be used once.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto]">
                <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="staff@business.com" aria-label="Staff email" className={inputClass} />
                <select value={role} onChange={(event) => setRole(event.target.value as BusinessTeamRole)} aria-label="Business role" className={inputClass}>
                  <option value="staff">Staff</option>
                  <option value="manager">Manager</option>
                </select>
                <button disabled={busyId === "invite" || availableSeats === 0} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 text-xs font-bold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50">
                  {busyId === "invite" ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Invite
                </button>
              </div>
              <p className="mt-2 text-[10px] text-slate-500">{availableSeats} invitation seat{availableSeats === 1 ? "" : "s"} currently available. Pending invitations reserve a seat but are not billed.</p>
            </form>
          )}

          {invitationLink && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="flex items-center gap-2 text-xs font-bold text-emerald-300 light:text-emerald-800"><CheckCircle2 className="h-4 w-4" /> Secure invitation ready</p>
              <p className="mt-1 text-[11px] text-emerald-100/80 light:text-emerald-800">The invitation is emailed when delivery is configured. You can also send this secure link directly to the invited email address.</p>
              <div className="mt-3 flex gap-2">
                <input readOnly value={invitationLink} aria-label="Invitation link" className={`${inputClass} min-w-0 flex-1`} />
                <button type="button" onClick={() => void copyInvitation()} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-500"><Copy className="h-4 w-4" /> Copy</button>
              </div>
            </div>
          )}

          {error && <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-300 light:text-rose-700">{error}</p>}
          {success && <p role="status" className="rounded-xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300 light:text-emerald-700">{success}</p>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><h3 className="flex items-center gap-2 text-xs font-bold"><ShieldCheck className="h-4 w-4 text-violet-400" /> Business members</h3></CardHeader>
        <CardBody className="space-y-3">
          {activeMembers.map((member) => {
            const isOwner = member.role === "owner";
            const busy = busyId === member.membershipId;
            return (
              <div key={member.membershipId} className="flex flex-col gap-3 rounded-2xl border border-slate-700 p-4 light:border-slate-200 sm:flex-row sm:items-center">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-xs font-black text-violet-300 light:text-violet-700">{member.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{member.name}</p><p className="truncate text-[11px] text-slate-400 light:text-slate-600">{member.email}</p></div>
                {isOwner ? (
                  <span className="rounded-full bg-violet-500/15 px-3 py-1 text-[10px] font-bold uppercase text-violet-300 light:text-violet-700">Owner</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <select disabled={busy} value={member.role === "manager" || member.role === "admin" ? "manager" : "staff"} onChange={(event) => void changeRole(member.membershipId, event.target.value as BusinessTeamRole)} aria-label={`Role for ${member.name}`} className="h-9 rounded-lg border border-slate-600 bg-slate-900 px-2 text-xs text-white light:border-slate-300 light:bg-white light:text-slate-900">
                      <option value="staff">Staff</option><option value="manager">Manager</option>
                    </select>
                    <button type="button" disabled={busy} onClick={() => void removeMember(member.membershipId, member.name)} aria-label={`Remove ${member.name}`} title={`Remove ${member.name}`} className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-500/30 text-rose-300 hover:bg-rose-500/10 disabled:opacity-50 light:text-rose-700">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</button>
                  </div>
                )}
              </div>
            );
          })}
          {formerMembers.length > 0 && <p className="pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Former members retained for history: {formerMembers.length}</p>}
        </CardBody>
      </Card>

      {summary.invitations.length > 0 && (
        <Card>
          <CardHeader><h3 className="flex items-center gap-2 text-xs font-bold"><Clock3 className="h-4 w-4 text-amber-400" /> Pending invitations</h3></CardHeader>
          <CardBody className="space-y-2">
            {summary.invitations.map((invitation) => (
              <div key={invitation.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-700 p-3 light:border-slate-200">
                <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{invitation.email}</p><p className="mt-0.5 text-[10px] capitalize text-slate-500">{invitation.role} · expires {new Date(invitation.expiresAt).toLocaleString()}</p></div>
                <button type="button" disabled={busyId === invitation.id} onClick={() => void revokeInvitation(invitation.id)} className="rounded-lg border border-slate-600 px-3 py-2 text-[10px] font-bold text-slate-300 hover:border-rose-500/40 hover:text-rose-300 disabled:opacity-50 light:border-slate-300 light:text-slate-700">Revoke</button>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {maxPaidSeats > 0 && (
        <Card>
          <CardHeader><h3 className="flex items-center gap-2 text-xs font-bold"><CreditCard className="h-4 w-4 text-emerald-400" /> Additional staff seats</h3></CardHeader>
          <CardBody>
            <p className="text-xs leading-5 text-slate-400 light:text-slate-600">Each paid staff seat is $2 BZD per month for this business. A request does not grant access until the platform administrator confirms payment.</p>
            {summary.pendingSeatRequest ? (
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-100 light:text-amber-800">Payment confirmation pending for {summary.pendingSeatRequest.requestedPaidSeats} paid seat{summary.pendingSeatRequest.requestedPaidSeats === 1 ? "" : "s"} (${summary.pendingSeatRequest.requestedPaidSeats * summary.additionalSeatPrice} BZD/month).</div>
            ) : summary.paidStaffSeats < maxPaidSeats ? (
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="block sm:w-56"><span className="mb-1.5 block text-[11px] font-semibold">Total paid seats requested</span><select value={requestedPaidSeats} onChange={(event) => setRequestedPaidSeats(Number(event.target.value))} className={inputClass}>{Array.from({ length: maxPaidSeats - summary.paidStaffSeats }, (_, index) => summary.paidStaffSeats + index + 1).map((count) => <option key={count} value={count}>{count} seat{count === 1 ? "" : "s"} · ${count * 2} BZD/month</option>)}</select></label>
                <button type="button" disabled={busyId === "seats"} onClick={() => void requestSeats()} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50">{busyId === "seats" && <Loader2 className="h-4 w-4 animate-spin" />} Request paid seats</button>
              </div>
            ) : (
              <p className="mt-4 rounded-xl bg-slate-800/60 p-3 text-xs text-slate-300 light:bg-slate-100 light:text-slate-700">This business has the maximum paid seats allowed on {planName}.</p>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function SeatStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-700 bg-slate-900/35 p-4 light:border-slate-200 light:bg-slate-50"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 text-lg font-black">{value}</p></div>;
}
