"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Eye } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/app/components/Card";
import { formatCurrency } from "@/app/lib/utils";
import {
  loadAdminTenantData,
  type AdminTenantData,
} from "@/app/services/adminService";

export default function TenantDetailPage() {
  const params = useParams<{ Id: string }>();
  const rawId = Array.isArray(params?.Id) ? params.Id[0] : params?.Id;
  const tenantId = rawId ? decodeURIComponent(String(rawId)).trim() : "";
  const [data, setData] = useState<AdminTenantData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const result = await loadAdminTenantData(tenantId);
        if (!active) return;
        setData(result);
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

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070b14] text-sm text-slate-400 light:bg-white">
        Loading business data from Supabase...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#070b14] p-8 text-white light:bg-white light:text-gray-900">
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
    <div className="min-h-screen space-y-6 bg-[#070b14] p-8 text-white light:bg-white light:text-gray-900">
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

      <div className="flex items-center gap-4">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold text-white"
          style={{ backgroundColor: tenant.logoBg }}
        >
          {tenant.logo}
        </div>
        <div>
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
          <p className="mt-1 text-xs text-slate-500 light:text-gray-500">ID: {tenant.id}</p>
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
              label="Created"
              value={tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString() : "Unknown"}
            />
          </div>
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

      <p className="text-xs text-slate-500">
        This screen is currently read-only. Tenant suspension and deletion will require audited
        server-side admin actions.
      </p>
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
