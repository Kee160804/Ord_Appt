"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/contexts/auth";
import { Card, CardHeader } from "@/app/components/Card";
import { formatCurrency, cn } from "@/app/lib/utils";
import { TenantManagement } from "@/app/components/TenantManagement";
import { AgentManagement } from "@/app/components/AgentManagement";
import { RoleManagement } from "@/app/components/RoleManagement";
import {
  loadAdminPlatformData,
  type AdminPlatformData,
} from "@/app/services/adminService";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  DollarSign,
  LayoutGrid,
  RefreshCw,
  Shield,
  ShoppingBag,
  Users,
  Users2,
} from "lucide-react";
import type { Agent, Role } from "@/app/types";

const EMPTY_PLATFORM_DATA: AdminPlatformData = {
  tenants: [],
  analyticsByTenant: {},
  totalRevenue: 0,
  totalActivity: 0,
  totalCustomers: 0,
};

export default function AdminPage() {
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState<
    "overview" | "tenants" | "agents" | "roles"
  >("overview");
  const [platformData, setPlatformData] = useState<AdminPlatformData>(EMPTY_PLATFORM_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [roles, setRoles] = useState<Role[]>([
    {
      id: "role-admin",
      name: "Admin",
      description: "Full platform access",
      permissions: [
        "view_dashboard",
        "manage_tenants",
        "edit_storefront",
        "view_analytics",
        "manage_agents",
        "manage_roles",
      ],
      isSystem: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: "role-staff",
      name: "Staff",
      description: "Staff member access",
      permissions: ["view_dashboard", "edit_storefront", "view_analytics"],
      isSystem: true,
      createdAt: new Date().toISOString(),
    },
  ]);
  const [agents, setAgents] = useState<Agent[]>([]);

  const refreshPlatformData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      setPlatformData(await loadAdminPlatformData());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load platform data from Supabase.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshPlatformData();
  }, [refreshPlatformData]);

  const explainReadOnlyAction = () => {
    setError(
      "Tenant write controls are not enabled yet. Live data is read-only until audited admin actions are installed.",
    );
  };

  const activeTenants = platformData.tenants.filter((tenant) => tenant.isActive).length;
  const tabs = [
    { id: "overview", label: "Overview", icon: LayoutGrid },
    { id: "tenants", label: "Tenant Management", icon: Building2 },
    { id: "agents", label: "Agent Management", icon: Users2 },
    { id: "roles", label: "Role Management", icon: Shield },
  ];

  return (
    <div className="min-h-screen space-y-6 bg-[#070b14] p-8 text-white light:bg-white light:text-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white light:text-gray-900">
            Super Admin Dashboard
          </h1>
          <p className="text-slate-400 light:text-gray-600">Live platform data from Supabase</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void refreshPlatformData()}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-700 disabled:opacity-50 light:bg-gray-100 light:text-gray-700 light:hover:bg-gray-200"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={logout}
            className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-medium text-slate-400 transition hover:bg-slate-700 hover:text-white light:bg-gray-100 light:text-gray-700 light:hover:bg-gray-200 light:hover:text-gray-900"
          >
            Logout
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 light:text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto border-b border-slate-700 light:border-gray-200">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const tabId = tab.id as typeof activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tabId)}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition",
                activeTab === tabId
                  ? "border-violet-500 text-violet-400 light:text-violet-600"
                  : "border-transparent text-slate-400 hover:text-white light:text-gray-600 light:hover:text-gray-900",
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Recognized Revenue"
              value={formatCurrency(platformData.totalRevenue)}
              icon={<DollarSign className="h-5 w-5 text-emerald-500" />}
              bg="bg-emerald-500/20 light:bg-emerald-50"
            />
            <StatCard
              label="Orders & Appointments"
              value={platformData.totalActivity.toString()}
              icon={<ShoppingBag className="h-5 w-5 text-blue-500" />}
              bg="bg-blue-500/20 light:bg-blue-50"
            />
            <StatCard
              label="Persisted Customers"
              value={platformData.totalCustomers.toString()}
              icon={<Users className="h-5 w-5 text-violet-500" />}
              bg="bg-violet-500/20 light:bg-violet-50"
            />
            <StatCard
              label="Active Tenants"
              value={activeTenants.toString()}
              icon={<Building2 className="h-5 w-5 text-amber-500" />}
              bg="bg-amber-500/20 light:bg-amber-50"
            />
          </div>

          <Card className="border-slate-700 bg-slate-800/50 light:border-gray-200 light:bg-white">
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white light:text-gray-900">All Businesses</h3>
                <span className="text-xs text-slate-400">
                  {isLoading ? "Loading..." : `${platformData.tenants.length} tenants`}
                </span>
              </div>
            </CardHeader>
            <div className="divide-y divide-slate-700 light:divide-slate-100">
              {!isLoading && platformData.tenants.length === 0 && (
                <p className="px-6 py-10 text-center text-sm text-slate-400">
                  No businesses were returned by Supabase.
                </p>
              )}
              {platformData.tenants.map((tenant) => {
                const analytics = platformData.analyticsByTenant[tenant.id];
                return (
                  <div
                    key={tenant.id}
                    className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-slate-700/60 light:hover:bg-gray-50"
                  >
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg font-bold text-white"
                      style={{ backgroundColor: tenant.logoBg }}
                    >
                      {tenant.logo}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-white light:text-gray-900">
                          {tenant.name}
                        </p>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs",
                            tenant.businessType === "appointment"
                              ? "bg-violet-500/20 text-violet-400 light:bg-violet-100 light:text-violet-700"
                              : "bg-orange-500/20 text-orange-400 light:bg-orange-100 light:text-orange-700",
                          )}
                        >
                          {tenant.businessType}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            tenant.isActive
                              ? "bg-emerald-500/15 text-emerald-400"
                              : "bg-slate-500/15 text-slate-400",
                          )}
                        >
                          {tenant.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400 light:text-gray-600">
                        Revenue: {formatCurrency(analytics?.totalRevenue ?? 0)} · Transactions:{" "}
                        {analytics?.totalActivity ?? 0} · Customers: {analytics?.newCustomers ?? 0}
                      </p>
                    </div>
                    <Link
                      href={`/admin/tenant/${tenant.id}`}
                      className="flex items-center gap-1 text-sm font-medium text-violet-400 hover:text-violet-300 light:text-violet-600 light:hover:text-violet-800"
                    >
                      View <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {activeTab === "tenants" && (
        <TenantManagement
          tenants={platformData.tenants}
          onAddTenant={explainReadOnlyAction}
          onDeleteTenant={explainReadOnlyAction}
          onToggleTenantStatus={explainReadOnlyAction}
          readOnly
        />
      )}

      {activeTab === "agents" && (
        <AgentManagement
          agents={agents}
          roles={roles}
          tenants={platformData.tenants}
          onAddAgent={(agent) => setAgents((current) => [...current, agent as Agent])}
          onDeleteAgent={(id) => setAgents((current) => current.filter((agent) => agent.id !== id))}
          onToggleAgentStatus={(id) =>
            setAgents((current) =>
              current.map((agent) =>
                agent.id === id ? { ...agent, isActive: !agent.isActive } : agent,
              ),
            )
          }
        />
      )}

      {activeTab === "roles" && (
        <RoleManagement
          roles={roles}
          onAddRole={(role) => setRoles((current) => [...current, role as Role])}
          onDeleteRole={(id) => setRoles((current) => current.filter((role) => role.id !== id))}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  bg,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  bg: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-6 shadow-sm light:border-gray-200 light:bg-white">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-400 light:text-gray-600">{label}</p>
          <p className="mt-1.5 text-2xl font-bold text-white light:text-gray-900">{value}</p>
        </div>
        <div className={`rounded-xl p-3 ${bg}`}>{icon}</div>
      </div>
    </div>
  );
}
