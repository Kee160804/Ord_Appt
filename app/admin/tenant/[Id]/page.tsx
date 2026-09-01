"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, CreditCard, Eye } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/app/components/Card";
import { formatCurrency } from "@/app/lib/utils";
import {
  loadAdminTenantData,
  updateAdminTenantSubscription,
  type AdminTenantData,
} from "@/app/services/adminService";
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
  const [subscriptionMessage, setSubscriptionMessage] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const result = await loadAdminTenantData(tenantId);
        if (!active) return;
        setData(result);
        if (result) setSelectedPlan(result.tenant.plan);
        setError(result ? "" : "This tenant was not found or is not accessible.");
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
  ) => {
    setIsUpdatingSubscription(true);
    setError("");
    setSubscriptionMessage("");
    try {
      const updated = await updateAdminTenantSubscription(
        tenantId,
        selectedPlan,
        status,
        trialDays,
      );
      setData((current) => current
        ? { ...current, tenant: { ...current.tenant, ...updated } }
        : current);
      setSubscriptionMessage(
        status === "active"
          ? "Paid access activated successfully."
          : status === "trial"
            ? "The trial was extended by 14 days."
            : "Tenant access is now marked past due.",
      );
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update subscription access.");
    } finally {
      setIsUpdatingSubscription(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#070b14] text-sm text-slate-400 light:bg-white">
        Loading business data from Supabase...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-dvh bg-[#070b14] p-4 text-white light:bg-white light:text-gray-900 sm:p-8">
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
  return (
    <div className="min-h-dvh space-y-6 bg-[#070b14] p-4 text-white light:bg-white light:text-gray-900 sm:p-8">
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
            <CreditCard className="h-4 w-4 text-violet-400" />
            <h3 className="font-semibold text-white light:text-gray-900">Subscription Access</h3>
          </div>
        </CardHeader>
        <CardBody>
          <p className="max-w-2xl text-sm leading-6 text-slate-400 light:text-slate-600">
            Use these secured controls after confirming payment, to grant another trial period, or to pause access for an unpaid account.
          </p>
          <div className="mt-5 flex flex-wrap items-end gap-3">
            <label className="w-full sm:min-w-44 sm:w-auto">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Plan</span>
              <select value={selectedPlan} onChange={(event) => setSelectedPlan(event.target.value as Tenant["plan"])} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500 light:border-slate-300 light:bg-white light:text-slate-900">
                <option value="starter">Beginner — $9</option>
                <option value="pro">Pro — $12</option>
                <option value="enterprise">Enterprise — $16</option>
              </select>
            </label>
            <button disabled={isUpdatingSubscription} onClick={() => void updateSubscription("active")} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50">
              Activate paid access
            </button>
            <button disabled={isUpdatingSubscription} onClick={() => void updateSubscription("trial", 14)} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-50">
              Extend trial 14 days
            </button>
            <button disabled={isUpdatingSubscription} onClick={() => void updateSubscription("past_due")} className="rounded-xl border border-rose-500/40 px-4 py-2.5 text-sm font-bold text-rose-300 hover:bg-rose-500/10 disabled:opacity-50 light:text-rose-700">
              Mark past due
            </button>
          </div>
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
