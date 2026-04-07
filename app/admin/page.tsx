"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/app/contexts/auth";
// NEW: Import useRealtime to get real-time registered users and tenants
import { useRealtime } from "@/app/contexts/realtime";
import { mockTenants, mockAnalytics } from "@/app/data/mock";
import { Card, CardHeader } from "@/app/components/Card";
import { formatCurrency, cn } from "@/app/lib/utils"; // added cn import
import { Building2, Users, DollarSign, ShoppingBag, ArrowRight } from "lucide-react";

export default function AdminPage() {
  // COMMENT: Removed unused 'user' - not needed in admin view
  const { logout } = useAuth();
  // NEW: Get realtime context to show registered users and tenants
  const realtime = useRealtime();

  // NEW: Combine mock tenants with dynamically created tenants from signup
  const registeredUsers = useMemo(() => realtime.getAllRegisteredUsers(), [realtime]);
  const dynamicTenants = useMemo(() => realtime.getTenantTenants(), [realtime]);
  const allTenants = [...mockTenants, ...dynamicTenants];

  const totalRevenue = Object.values(mockAnalytics).reduce((sum, a) => sum + a.totalRevenue, 0);
  const totalActivity = Object.values(mockAnalytics).reduce((sum, a) => sum + a.totalActivity, 0);
  const totalCustomers = Object.values(mockAnalytics).reduce((sum, a) => sum + a.newCustomers, 0) + registeredUsers.length;

  return (
    <div className="p-8 space-y-6 bg-[#070b14] light:bg-white min-h-screen text-white light:text-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white light:text-gray-900">Admin Dashboard</h1>
          <p className="text-slate-400 light:text-gray-600">Super admin overview — all tenants & real-time activity</p>
        </div>
        <button
          onClick={logout}
          className="px-4 py-2 text-sm font-medium text-slate-400 light:text-gray-700 hover:text-white light:hover:text-gray-900 bg-slate-800 light:bg-gray-100 rounded-xl hover:bg-slate-700 light:hover:bg-gray-200 transition"
        >
          Logout
        </button>
      </div>

      {/* Global stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Revenue"
          value={formatCurrency(totalRevenue)}
          icon={<DollarSign className="w-5 h-5 text-emerald-500" />}
          bg="bg-emerald-500/20 light:bg-emerald-50"
        />
        <StatCard
          label="Total Transactions"
          value={totalActivity.toString()}
          icon={<ShoppingBag className="w-5 h-5 text-blue-500" />}
          bg="bg-blue-500/20 light:bg-blue-50"
        />
        <StatCard
          label="Total Customers"
          value={totalCustomers.toString()}
          icon={<Users className="w-5 h-5 text-violet-500" />}
          bg="bg-violet-500/20 light:bg-violet-50"
        />
        <StatCard
          label="Active Tenants"
          value={allTenants.length.toString()}
          icon={<Building2 className="w-5 h-5 text-amber-500" />}
          bg="bg-amber-500/20 light:bg-amber-50"
        />
      </div>

      {/* COMMENT: Removed "New Signups" section - new businesses now appear in "All Businesses" as tenants */}
      {/* The dynamicTenants are shown below in the All Businesses section with "✨ New" badge */}

      {/* Tenant list */}
      <Card className="bg-slate-800/50 light:bg-white border-slate-700 light:border-gray-200">
        <CardHeader>
          <h3 className="font-semibold text-white light:text-gray-900">All Businesses</h3>
        </CardHeader>
        <div className="divide-y divide-slate-700 light:divide-slate-100">
          {/* ENHANCED: Show both mock and dynamically created tenants */}
          {allTenants.map(tenant => {
            const analytics = mockAnalytics[tenant.id];
            return (
              <div
                key={tenant.id}
                className="px-6 py-4 flex items-center gap-4 hover:bg-slate-700 light:hover:bg-gray-50 transition-colors"
              >
                {/* COMMENT: Using inline style for dynamic background color from tenant.logoBg */}
                {/* This is necessary because logoBg is dynamic hex color (e.g. #c084fc) */}
                {/* and cannot be predicted by Tailwind's static class generation */}
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                  // @ts-ignore: Dynamic color style
                  style={{ backgroundColor: tenant.logoBg }}
                >
                  {tenant.logo}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white light:text-gray-900">{tenant.name}</p>
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full",
                        tenant.businessType === 'appointment'
                          ? "bg-violet-500/20 light:bg-violet-100 text-violet-400 light:text-violet-700"
                          : "bg-orange-500/20 light:bg-orange-100 text-orange-400 light:text-orange-700"
                      )}
                    >
                      {tenant.businessType}
                    </span>
                    {/* NEW: Badge for newly created tenants */}
                    {dynamicTenants.some(t => t.id === tenant.id) && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                        ✨ New
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 light:text-gray-600 mt-0.5">
                    Revenue: {formatCurrency(analytics?.totalRevenue ?? 0)} · Transactions: {analytics?.totalActivity}
                  </p>
                </div>
                <Link
                  href={`/admin/tenant/${tenant.id}`}
                  className="text-sm text-violet-400 light:text-violet-600 hover:text-violet-300 light:hover:text-violet-800 font-medium flex items-center gap-1"
                >
                  View <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon, bg }: { label: string; value: string; icon: React.ReactNode; bg: string }) {
  return (
    <div className="bg-slate-800/50 light:bg-white rounded-2xl border border-slate-700 light:border-gray-200 shadow-sm p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-400 light:text-gray-600">{label}</p>
          <p className="text-2xl font-bold text-white light:text-gray-900 mt-1.5">{value}</p>
        </div>
        <div className={`p-3 rounded-xl ${bg}`}>{icon}</div>
      </div>
    </div>
  );
}