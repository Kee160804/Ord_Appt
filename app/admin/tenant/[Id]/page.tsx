"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, CreditCard, Eye, RefreshCw, Save, Users } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/app/components/Card";
import { formatCurrency } from "@/app/lib/utils";
import {
  loadAdminTenantData,
  updateAdminTenantSubscription,
  type AdminTenantData,
} from "@/app/services/adminService";
import {
  getAdminSeatSummary,
  rejectAdminPaidStaffSeatRequest,
  setAdminPaidStaffSeats,
  type AdminSeatSummary,
} from "@/app/services/teamService";
import type { Tenant } from "@/app/types";

export default function TenantDetailPage() {
  const params = useParams<{ Id: string }>();
  const rawId = Array.isArray(params?.Id) ? params.Id[0] : params?.Id;
  const tenantId = rawId ? decodeURIComponent(String(rawId)).trim() : "";
  const [data, setData] = useState<AdminTenantData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<Tenant["plan"]>("starter");
  const [isUpdatingSubscription, setIsUpdatingSubscription] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState("");
  const [subscriptionMessage, setSubscriptionMessage] = useState("");
  const [seatSummary, setSeatSummary] = useState<AdminSeatSummary | null>(null);
  const [paidStaffSeats, setPaidStaffSeats] = useState(0);
  const [seatReviewNote, setSeatReviewNote] = useState("");
  const [isUpdatingSeats, setIsUpdatingSeats] = useState(false);
  const [seatError, setSeatError] = useState("");
  const [seatMessage, setSeatMessage] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const result = await loadAdminTenantData(tenantId);
        if (!active) return;
        setData(result);
        if (result) setSelectedPlan(result.tenant.plan);
        setError(result ? "" : "This tenant was not found or is not accessible.");
        if (result) {
          try {
            const summary = await getAdminSeatSummary(tenantId);
            if (!active) return;
            setSeatSummary(summary);
            setPaidStaffSeats(summary.paidStaffSeats);
            setSeatError("");
          } catch (seatLoadError) {
            if (!active) return;
            setSeatError(
              seatLoadError instanceof Error
                ? seatLoadError.message
                : "Unable to load staff-seat access.",
            );
          }
        }
      } catch (loadError) {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load this business from Supabase.",
        );
      } finally {
        if (active) setIsLoading(false);
      }
    };
    if (tenantId) void load();
    else {
      setError("A tenant ID is required.");
      setIsLoading(false);
    }
    return () => {
      active = false;
    };
  }, [tenantId]);

  const updateSubscription = async (
    status: Tenant["subscriptionStatus"],
    trialDays?: number,
    plan: Tenant["plan"] = data?.tenant.plan ?? selectedPlan,
    successMessage?: string,
  ) => {
    setIsUpdatingSubscription(true);
    setSubscriptionError("");
    setSubscriptionMessage("");
    try {
      await updateAdminTenantSubscription(
        tenantId,
        plan,
        status,
        trialDays,
      );

      // Read the tenant back from Supabase instead of trusting optimistic UI
      // state. A success message therefore means the change survived a reload.
      const refreshed = await loadAdminTenantData(tenantId);
      if (!refreshed) throw new Error("The business could not be reloaded after saving.");
      if (refreshed.tenant.plan !== plan || refreshed.tenant.subscriptionStatus !== status) {
        throw new Error("Supabase did not retain the requested plan and access status.");
      }
      setData(refreshed);
      setSelectedPlan(refreshed.tenant.plan);

      try {
        const summary = await getAdminSeatSummary(tenantId);
        setSeatSummary(summary);
        setPaidStaffSeats(summary.paidStaffSeats);
        setSeatError("");
      } catch (seatLoadError) {
        setSeatError(
          seatLoadError instanceof Error
            ? seatLoadError.message
            : "Unable to refresh staff-seat access.",
        );
      }
      setSubscriptionMessage(
        successMessage ?? (
          status === "active"
            ? "Plan and testing access saved and verified in Supabase. The tester can now refresh their dashboard."
            : status === "trial"
              ? "The trial was extended by 14 days and verified in Supabase."
              : "Tenant access is now marked past due and was verified in Supabase."
        ),
      );
    } catch (updateError) {
      setSubscriptionError(updateError instanceof Error ? updateError.message : "Unable to update subscription access.");
    } finally {
      setIsUpdatingSubscription(false);
    }
  };

  const reloadSavedSubscription = async () => {
    setIsUpdatingSubscription(true);
    setSubscriptionError("");
    setSubscriptionMessage("");
    try {
      const refreshed = await loadAdminTenantData(tenantId);
      if (!refreshed) throw new Error("The business could not be reloaded from Supabase.");
      setData(refreshed);
      setSelectedPlan(refreshed.tenant.plan);
      const summary = await getAdminSeatSummary(tenantId);
      setSeatSummary(summary);
      setPaidStaffSeats(summary.paidStaffSeats);
      setSeatError("");
      setSubscriptionMessage("Saved plan and access status reloaded from Supabase.");
    } catch (reloadError) {
      setSubscriptionError(reloadError instanceof Error ? reloadError.message : "Unable to reload subscription access.");
    } finally {
      setIsUpdatingSubscription(false);
    }
  };

  const refreshSeatSummary = async () => {
    const summary = await getAdminSeatSummary(tenantId);
    setSeatSummary(summary);
    setPaidStaffSeats(summary.paidStaffSeats);
    return summary;
  };

  const savePaidStaffSeats = async (requestId?: string, requestedSeats?: number) => {
    const nextSeats = requestedSeats ?? paidStaffSeats;
    setIsUpdatingSeats(true);
    setSeatError("");
    setSeatMessage("");
    try {
      await setAdminPaidStaffSeats(tenantId, nextSeats, requestId, seatReviewNote);
      await refreshSeatSummary();
      setSeatReviewNote("");
      setSeatMessage(
        nextSeats > (seatSummary?.paidStaffSeats ?? 0)
          ? "Additional staff-seat access saved for this business."
          : "Staff-seat access saved and verified in Supabase.",
      );
    } catch (seatUpdateError) {
      setSeatError(
        seatUpdateError instanceof Error
          ? seatUpdateError.message
          : "Unable to update staff-seat access.",
      );
    } finally {
      setIsUpdatingSeats(false);
    }
  };

  const rejectSeatRequest = async () => {
    if (!seatSummary?.pendingRequest) return;
    setIsUpdatingSeats(true);
    setSeatError("");
    setSeatMessage("");
    try {
      await rejectAdminPaidStaffSeatRequest(
        tenantId,
        seatSummary.pendingRequest.id,
        seatReviewNote,
      );
      await refreshSeatSummary();
      setSeatReviewNote("");
      setSeatMessage("The paid staff-seat request was rejected.");
    } catch (seatUpdateError) {
      setSeatError(
        seatUpdateError instanceof Error
          ? seatUpdateError.message
          : "Unable to reject this staff-seat request.",
      );
    } finally {
      setIsUpdatingSeats(false);
    }
  };

  if (isLoading) {
    return (
      <div className="pwa-page-safe flex min-h-dvh items-center justify-center bg-[#070b14] text-sm text-slate-400 light:bg-white">
        Loading business data from Supabase...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="pwa-page-safe min-h-dvh bg-[#070b14] p-4 text-white light:bg-white light:text-gray-900 sm:p-8">
        <div className="mx-auto mt-12 max-w-md rounded-2xl border border-red-500 bg-red-900/20 p-6 light:border-red-300 light:bg-red-50">
          <div className="flex gap-3">
            <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-red-500" />
            <div>
              <h3 className="mb-2 font-semibold text-red-400 light:text-red-700">
                Unable to load tenant
              </h3>
              <p className="mb-4 text-sm text-red-300 light:text-red-600">{error}</p>
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 font-medium text-white transition-colors hover:bg-violet-500"
              >
                <ArrowLeft className="h-4 w-4" /> Back to Admin
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { tenant, analytics } = data;
  const hasUnsavedPlan = selectedPlan !== tenant.plan;
  return (
    <div className="pwa-page-safe min-h-dvh space-y-6 bg-[#070b14] p-4 text-white light:bg-white light:text-gray-900 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white light:text-gray-600 light:hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Admin
        </Link>
        <a
          href={`/store-front/${tenant.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-500"
        >
          <Eye className="h-4 w-4" /> View Business
        </a>
      </div>

      {!tenant.isActive && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-300 light:text-amber-700">
          <AlertCircle className="h-5 w-5" />
          This tenant is inactive or suspended in Supabase.
        </div>
      )}

      <div className="flex min-w-0 items-center gap-4">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold text-white"
          style={{ backgroundColor: tenant.logoBg }}
        >
          {tenant.logo}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-black text-white light:text-gray-900">{tenant.name}</h1>
            <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-300 light:bg-slate-100 light:text-slate-600">
              {tenant.isActive ? "Active" : "Inactive"}
            </span>
          </div>
          <p className="text-slate-400 light:text-gray-600">
            {tenant.businessType === "appointment" ? "Appointment Booking" : "Food Ordering"}
            {tenant.city ? ` · ${tenant.city}` : ""}
          </p>
          <p className="mt-1 break-all text-xs text-slate-500 light:text-gray-500">ID: {tenant.id}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label="Recognized Revenue" value={formatCurrency(analytics.totalRevenue)} />
        <StatCard label="Transactions" value={analytics.totalActivity.toString()} />
        <StatCard label="Customers" value={analytics.newCustomers.toString()} />
        <StatCard label="30-Day Revenue" value={formatCurrency(tenant.monthlyRevenue ?? 0)} />
      </div>

      <Card className="border-slate-700 bg-slate-800/50 light:border-slate-200 light:bg-white">
        <CardHeader>
          <h3 className="font-semibold text-white light:text-gray-900">Business Information</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Info label="Email" value={tenant.email || "Not provided"} />
            <Info label="Phone" value={tenant.phone || "Not provided"} />
            <Info
              label="Address"
              value={[tenant.address, tenant.city].filter(Boolean).join(", ") || "Not provided"}
            />
            <Info label="Plan" value={`${tenant.plan} plan`} capitalize />
            <Info label="Subscription" value={tenant.subscriptionStatus} capitalize />
            <Info
              label="Trial Ends"
              value={tenant.trialEndsAt ? new Date(tenant.trialEndsAt).toLocaleString() : "Not set"}
            />
            <Info
              label="Created"
              value={tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString() : "Unknown"}
            />
          </div>
        </CardBody>
      </Card>

      <Card className="border-slate-700 bg-slate-800/50 light:border-slate-200 light:bg-white">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-violet-400" />
            <h3 className="font-semibold text-white light:text-gray-900">Paid Staff Seats</h3>
          </div>
        </CardHeader>
        <CardBody>
          {seatError && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300 light:text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{seatError}</span>
            </div>
          )}

          {seatSummary ? (
            <>
              <p className="max-w-3xl text-sm leading-6 text-slate-400 light:text-slate-600">
                Staff access belongs to this business, not the owner&apos;s account. During testing, assign seats manually with an admin note. Pending requests never grant access or create a charge.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <SeatStat label="Active staff" value={seatSummary.activeStaff} />
                <SeatStat label="Included" value={seatSummary.includedStaff} />
                <SeatStat label="Paid seats" value={seatSummary.paidStaffSeats} />
                <SeatStat label="Maximum staff" value={seatSummary.maxStaff} />
              </div>

              {seatSummary.pendingRequest && (
                <div className="mt-5 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4">
                  <p className="font-semibold text-amber-200 light:text-amber-800">
                    Payment approval requested for {seatSummary.pendingRequest.requestedPaidSeats} paid staff {seatSummary.pendingRequest.requestedPaidSeats === 1 ? "seat" : "seats"}
                  </p>
                  <p className="mt-1 text-xs text-amber-200/70 light:text-amber-700">
                    Requested {new Date(seatSummary.pendingRequest.createdAt).toLocaleString()} · BZD ${seatSummary.pendingRequest.requestedPaidSeats * seatSummary.additionalSeatPrice}/month
                  </p>
                </div>
              )}

              <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(180px,240px)_minmax(260px,1fr)]">
                <label>
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Approved paid seats</span>
                  <select
                    value={paidStaffSeats}
                    onChange={(event) => setPaidStaffSeats(Number(event.target.value))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500 light:border-slate-300 light:bg-white light:text-slate-900"
                  >
                    {Array.from(
                      { length: Math.max(0, seatSummary.maxStaff - seatSummary.includedStaff) + 1 },
                      (_, index) => index,
                    ).map((count) => (
                      <option key={count} value={count}>
                        {count} {count === 1 ? "seat" : "seats"} · BZD ${count * seatSummary.additionalSeatPrice}/month
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Admin note</span>
                  <input
                    value={seatReviewNote}
                    onChange={(event) => setSeatReviewNote(event.target.value)}
                    placeholder="Required when increasing seats, e.g. Beta tester — no payment"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-500 light:border-slate-300 light:bg-white light:text-slate-900"
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  disabled={isUpdatingSeats}
                  onClick={() => void savePaidStaffSeats()}
                  className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  Save staff-seat changes
                </button>
                {seatSummary.pendingRequest && (
                  <>
                    <button
                      disabled={isUpdatingSeats}
                      onClick={() => void savePaidStaffSeats(
                        seatSummary.pendingRequest?.id,
                        seatSummary.pendingRequest?.requestedPaidSeats,
                      )}
                      className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      Approve requested seats
                    </button>
                    <button
                      disabled={isUpdatingSeats}
                      onClick={() => void rejectSeatRequest()}
                      className="rounded-xl border border-rose-500/40 px-4 py-2.5 text-sm font-bold text-rose-300 hover:bg-rose-500/10 disabled:opacity-50 light:text-rose-700"
                    >
                      Reject request
                    </button>
                  </>
                )}
              </div>
              {seatMessage && (
                <p className="mt-4 flex items-center gap-2 text-sm text-emerald-400 light:text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> {seatMessage}
                </p>
              )}
            </>
          ) : !seatError ? (
            <p className="text-sm text-slate-400">Loading staff-seat access...</p>
          ) : null}
        </CardBody>
      </Card>

      <Card className="border-slate-700 bg-slate-800/50 light:border-slate-200 light:bg-white">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-violet-400" />
            <h3 className="font-semibold text-white light:text-gray-900">Subscription Access</h3>
          </div>
        </CardHeader>
        <CardBody>
          <p className="max-w-2xl text-sm leading-6 text-slate-400 light:text-slate-600">
            Assign a plan to a tester without payment. Saving grants active access to exactly that plan&apos;s limits and features, then reloads the record from Supabase to verify it persisted. The tester should refresh their dashboard after you save.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-slate-700/70 px-3 py-1.5 text-slate-300 light:bg-slate-100 light:text-slate-700">
              Saved plan: <strong className="capitalize">{tenant.plan === "starter" ? "Beginner" : tenant.plan}</strong>
            </span>
            <span className="rounded-full bg-slate-700/70 px-3 py-1.5 text-slate-300 light:bg-slate-100 light:text-slate-700">
              Access: <strong className="capitalize">{tenant.subscriptionStatus}</strong>
            </span>
            {hasUnsavedPlan && <span className="rounded-full bg-amber-500/15 px-3 py-1.5 font-bold text-amber-300 light:text-amber-700">Unsaved plan change</span>}
          </div>
          <div className="mt-5 flex flex-wrap items-end gap-3">
            <label className="w-full sm:min-w-44 sm:w-auto">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Plan</span>
              <select value={selectedPlan} onChange={(event) => setSelectedPlan(event.target.value as Tenant["plan"])} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500 light:border-slate-300 light:bg-white light:text-slate-900">
                <option value="starter">Beginner — $9 BZD</option>
                <option value="pro">Pro — $12 BZD</option>
                <option value="enterprise">Enterprise — $16 BZD</option>
              </select>
            </label>
            <button disabled={isUpdatingSubscription} onClick={() => void updateSubscription("active", undefined, selectedPlan)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50">
              <Save className="h-4 w-4" /> Save changes
            </button>
            <button disabled={isUpdatingSubscription} onClick={() => void reloadSavedSubscription()} className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-bold text-slate-300 hover:bg-slate-700/50 disabled:opacity-50 light:border-slate-300 light:text-slate-700">
              <RefreshCw className={`h-4 w-4 ${isUpdatingSubscription ? "animate-spin" : ""}`} /> Reload saved values
            </button>
          </div>
          <div className="mt-5 border-t border-slate-700 pt-5 light:border-slate-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Other access actions</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">A trial unlocks the full product for evaluation, so use active testing access above when checking plan-specific restrictions.</p>
            <div className="mt-3 flex flex-wrap gap-3">
            <button disabled={isUpdatingSubscription} onClick={() => void updateSubscription("trial", 14, tenant.plan)} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-50">
              Extend trial 14 days
            </button>
            <button disabled={isUpdatingSubscription} onClick={() => void updateSubscription("past_due", undefined, tenant.plan)} className="rounded-xl border border-rose-500/40 px-4 py-2.5 text-sm font-bold text-rose-300 hover:bg-rose-500/10 disabled:opacity-50 light:text-rose-700">
              Mark past due
            </button>
            </div>
          </div>
          {subscriptionError && <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300 light:text-rose-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{subscriptionError}</p>}
          {subscriptionMessage && <p className="mt-4 flex items-center gap-2 text-sm text-emerald-400 light:text-emerald-700"><CheckCircle2 className="h-4 w-4" />{subscriptionMessage}</p>}
        </CardBody>
      </Card>

      <Card className="border-slate-700 bg-slate-800/50 light:border-slate-200 light:bg-white">
        <CardHeader>
          <h3 className="font-semibold text-white light:text-gray-900">Top Items</h3>
        </CardHeader>
        <CardBody>
          {analytics.topItems.length === 0 ? (
            <p className="text-sm text-slate-400">No completed business activity yet.</p>
          ) : (
            <div className="space-y-3">
              {analytics.topItems.map((item) => (
                <div key={item.name} className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium text-slate-300 light:text-gray-700">
                    {item.name}
                  </span>
                  <span className="text-sm text-slate-400 light:text-gray-600">
                    {item.count} × {formatCurrency(item.revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <p className="text-xs text-slate-500">Subscription changes use a secured SUPER_ADMIN-only database action. Tenant suspension and deletion remain read-only.</p>
    </div>
  );
}

function Info({ label, value, capitalize = false }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-slate-400 light:text-gray-600">{label}</p>
      <p className={`mt-1 text-sm text-white light:text-gray-900 ${capitalize ? "capitalize" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-6 shadow-sm light:border-slate-100 light:bg-white">
      <p className="text-sm font-medium text-slate-400 light:text-slate-500">{label}</p>
      <p className="mt-1.5 text-2xl font-bold text-white light:text-slate-900">{value}</p>
    </div>
  );
}

function SeatStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 light:border-slate-200 light:bg-slate-50">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-white light:text-slate-900">{value}</p>
    </div>
  );
}
