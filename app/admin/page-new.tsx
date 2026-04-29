"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/app/contexts/auth";
import { useRealtime } from "@/app/contexts/realtime";
import { mockTenants, mockAnalytics } from "@/app/data/mock";
import { Card, CardHeader } from "@/app/components/Card";
import { formatCurrency, cn } from "@/app/lib/utils";
import { TenantManagement } from "@/app/components/TenantManagement";
import { AgentManagement } from "@/app/components/AgentManagement";
import { RoleManagement } from "@/app/components/RoleManagement";
import {
  Building2,
  Users,
  DollarSign,
  ShoppingBag,
  ArrowRight,
  LayoutGrid,
  Users2,
  Shield,
} from "lucide-react";
import type { Role, Agent } from "@/app/types";

export default function AdminPage() {
  const { logout } = useAuth();
  const realtime = useRealtime();

  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "overview" | "tenants" | "agents" | "roles"
  >("overview");
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

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const registeredUsers = isMounted ? realtime.getAllRegisteredUsers() : [];
  const dynamicTenants = isMounted ? realtime.getTenantTenants() : [];
  const allTenants = [...mockTenants, ...dynamicTenants];

  const totalRevenue = Object.values(mockAnalytics).reduce(
    (sum, a) => sum + a.totalRevenue,
    0,
  );
  const totalActivity = Object.values(mockAnalytics).reduce(
    (sum, a) => sum + a.totalActivity,
    0,
  );
  const totalCustomers =
    Object.values(mockAnalytics).reduce((sum, a) => sum + a.newCustomers, 0) +
    registeredUsers.length;

  const handleAddRole = (newRole: Partial<Role>) => {
    setRoles([...roles, newRole as Role]);
  };

  const handleDeleteRole = (id: string) => {
    setRoles(roles.filter((r) => r.id !== id));
  };

  const handleAddAgent = (newAgent: Partial<Agent>) => {
    setAgents([...agents, newAgent as Agent]);
  };

  const handleDeleteAgent = (id: string) => {
    setAgents(agents.filter((a) => a.id !== id));
  };

  const handleToggleAgentStatus = (id: string) => {
    setAgents(
      agents.map((a) => (a.id === id ? { ...a, isActive: !a.isActive } : a)),
    );
  };

  const handleAddTenant = () => {
    // In a real app, this would persist to database
  };

  const handleDeleteTenant = () => {
    // In a real app, this would delete from database
  };

  const handleToggleTenantStatus = () => {
    // In a real app, this would update in database
  };

  const tabs = [
    { id: "overview", label: "Overview", icon: LayoutGrid },
    { id: "tenants", label: "Tenant Management", icon: Building2 },
    { id: "agents", label: "Agent Management", icon: Users2 },
    { id: "roles", label: "Role Management", icon: Shield },
  ];

  return (
    <div className="p-8 space-y-6 bg-[#070b14] light:bg-white min-h-screen text-white light:text-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white light:text-gray-900">
            Super Admin Dashboard
          </h1>
          <p className="text-slate-400 light:text-gray-600">
            Platform management &amp; configuration
          </p>
        </div>
        <button
          onClick={logout}
          className="px-4 py-2 text-sm font-medium text-slate-400 light:text-gray-700 hover:text-white light:hover:text-gray-900 bg-slate-800 light:bg-gray-100 rounded-xl hover:bg-slate-700 light:hover:bg-gray-200 transition"
        >
          Logout
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-700 light:border-gray-200 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            activeTab ===
            (tab.id as "overview" | "tenants" | "agents" | "roles");
          return (
            <button
              key={tab.id}
              onClick={() =>
                setActiveTab(
                  tab.id as "overview" | "tenants" | "agents" | "roles",
                )
              }
              className={cn(
                "flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition whitespace-nowrap",
                isActive
                  ? "border-violet-500 text-violet-400 light:text-violet-600"
                  : "border-transparent text-slate-400 light:text-gray-600 hover:text-white light:hover:text-gray-900",
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
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

          {/* Tenant list */}
          <Card className="bg-slate-800/50 light:bg-white border-slate-700 light:border-gray-200">
            <CardHeader>
              <h3 className="font-semibold text-white light:text-gray-900">
                All Businesses
              </h3>
            </CardHeader>
            <div className="divide-y divide-slate-700 light:divide-slate-100">
              {allTenants.map((tenant) => {
                const analytics = mockAnalytics[tenant.id];
                return (
                  <div
                    key={tenant.id}
                    className="px-6 py-4 flex items-center gap-4 hover:bg-slate-700 light:hover:bg-gray-50 transition-colors"
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: tenant.logoBg }}
                    >
                      {tenant.logo}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white light:text-gray-900">
                          {tenant.name}
                        </p>
                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full",
                            tenant.businessType === "appointment"
                              ? "bg-violet-500/20 light:bg-violet-100 text-violet-400 light:text-violet-700"
                              : "bg-orange-500/20 light:bg-orange-100 text-orange-400 light:text-orange-700",
                          )}
                        >
                          {tenant.businessType}
                        </span>
                        {dynamicTenants.some((t) => t.id === tenant.id) && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                            ✨ New
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 light:text-gray-600 mt-0.5">
                        Revenue: {formatCurrency(analytics?.totalRevenue ?? 0)}{" "}
                        · Transactions: {analytics?.totalActivity}
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
      )}

      {/* Tenant Management Tab */}
      {activeTab === "tenants" && (
        <TenantManagement
          tenants={allTenants}
          onAddTenant={handleAddTenant}
          onDeleteTenant={handleDeleteTenant}
          onToggleTenantStatus={handleToggleTenantStatus}
        />
      )}

      {/* Agent Management Tab */}
      {activeTab === "agents" && (
        <AgentManagement
          agents={agents}
          roles={roles}
          tenants={allTenants}
          onAddAgent={handleAddAgent}
          onDeleteAgent={handleDeleteAgent}
          onToggleAgentStatus={handleToggleAgentStatus}
        />
      )}

      {/* Role Management Tab */}
      {activeTab === "roles" && (
        <RoleManagement
          roles={roles}
          onAddRole={handleAddRole}
          onDeleteRole={handleDeleteRole}
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
    <div className="bg-slate-800/50 light:bg-white rounded-2xl border border-slate-700 light:border-gray-200 shadow-sm p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-400 light:text-gray-600">
            {label}
          </p>
          <p className="text-2xl font-bold text-white light:text-gray-900 mt-1.5">
            {value}
          </p>
        </div>
        <div className={`p-3 rounded-xl ${bg}`}>{icon}</div>
      </div>
    </div>
  );
}
