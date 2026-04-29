"use client";

import React, { useState } from "react";
import { Tenant, TenantStatus } from "@/app/types";
import { Card, CardHeader } from "@/app/components/Card";
import { formatCurrency, cn } from "@/app/lib/utils";
import {
  Plus,
  Edit2,
  Trash2,
  Power,
  PowerOff,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { SearchFilters } from "@/app/components/SearchFilters";

interface TenantManagementProps {
  tenants: Tenant[];
  onAddTenant: (tenant: Partial<Tenant>) => void;
  onDeleteTenant: (id: string) => void;
  onToggleTenantStatus: (id: string) => void;
}

export function TenantManagement({
  tenants,
  onAddTenant,
  onDeleteTenant,
  onToggleTenantStatus,
}: TenantManagementProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<{
    tenantStatus?: TenantStatus;
    businessType?: "appointment" | "ordering";
    subscriptionPlan?: "starter" | "pro" | "enterprise";
  }>({});
  const [isAddingTenant, setIsAddingTenant] = useState(false);
  const [newTenant, setNewTenant] = useState<Partial<Tenant>>({
    name: "",
    email: "",
    phone: "",
    businessType: "appointment",
    plan: "starter",
  });

  // Filter tenants based on search and filters
  const filteredTenants = tenants.filter((tenant) => {
    const matchesSearch =
      searchTerm === "" ||
      tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tenant.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tenant.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      !filters.tenantStatus ||
      tenant.isActive === (filters.tenantStatus === "active");
    const matchesType =
      !filters.businessType || tenant.businessType === filters.businessType;
    const matchesPlan =
      !filters.subscriptionPlan || tenant.plan === filters.subscriptionPlan;

    return matchesSearch && matchesStatus && matchesType && matchesPlan;
  });

  const handleAddTenant = () => {
    if (newTenant.name && newTenant.email) {
      onAddTenant({
        ...newTenant,
        id: `tenant-${Date.now()}`,
        createdAt: new Date().toISOString(),
        isActive: true,
      });
      setNewTenant({
        name: "",
        email: "",
        phone: "",
        businessType: "appointment",
        plan: "starter",
      });
      setIsAddingTenant(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white light:text-gray-900">
            Tenant Management
          </h2>
          <p className="text-sm text-slate-400 light:text-gray-600 mt-1">
            Create, manage, and monitor all business tenants
          </p>
        </div>
        <button
          onClick={() => setIsAddingTenant(!isAddingTenant)}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition"
        >
          <Plus className="w-4 h-4" />
          Add Tenant
        </button>
      </div>

      {/* Add Tenant Form */}
      {isAddingTenant && (
        <Card className="bg-slate-800/50 light:bg-white border-slate-700 light:border-gray-200">
          <CardHeader>
            <h3 className="font-semibold text-white light:text-gray-900">
              Create New Tenant
            </h3>
          </CardHeader>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Tenant Name"
                value={newTenant.name || ""}
                onChange={(e) =>
                  setNewTenant({ ...newTenant, name: e.target.value })
                }
                className="px-4 py-2 bg-slate-700 light:bg-gray-50 text-white light:text-gray-900 rounded-lg border border-slate-600 light:border-gray-300 focus:outline-none focus:border-violet-500"
              />
              <input
                type="email"
                placeholder="Email"
                value={newTenant.email || ""}
                onChange={(e) =>
                  setNewTenant({ ...newTenant, email: e.target.value })
                }
                className="px-4 py-2 bg-slate-700 light:bg-gray-50 text-white light:text-gray-900 rounded-lg border border-slate-600 light:border-gray-300 focus:outline-none focus:border-violet-500"
              />
              <input
                type="tel"
                placeholder="Phone"
                value={newTenant.phone || ""}
                onChange={(e) =>
                  setNewTenant({ ...newTenant, phone: e.target.value })
                }
                className="px-4 py-2 bg-slate-700 light:bg-gray-50 text-white light:text-gray-900 rounded-lg border border-slate-600 light:border-gray-300 focus:outline-none focus:border-violet-500"
              />
              <label htmlFor="business-type" className="sr-only">
                Business Type
              </label>
              <select
                id="business-type"
                value={newTenant.businessType || "appointment"}
                onChange={(e) =>
                  setNewTenant({
                    ...newTenant,
                    businessType: e.target.value as "appointment" | "ordering",
                  })
                }
                className="px-4 py-2 bg-slate-700 light:bg-gray-50 text-white light:text-gray-900 rounded-lg border border-slate-600 light:border-gray-300 focus:outline-none focus:border-violet-500"
              >
                <option value="appointment">Appointment</option>
                <option value="ordering">Ordering</option>
              </select>
              <label htmlFor="plan" className="sr-only">
                Plan
              </label>
              <select
                id="plan"
                value={newTenant.plan || "starter"}
                onChange={(e) =>
                  setNewTenant({
                    ...newTenant,
                    plan: e.target.value as "starter" | "pro" | "enterprise",
                  })
                }
                className="px-4 py-2 bg-slate-700 light:bg-gray-50 text-white light:text-gray-900 rounded-lg border border-slate-600 light:border-gray-300 focus:outline-none focus:border-violet-500"
              >
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setIsAddingTenant(false)}
                className="px-4 py-2 bg-slate-700 light:bg-gray-200 text-white light:text-gray-900 rounded-lg hover:bg-slate-600 light:hover:bg-gray-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTenant}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition"
              >
                Create Tenant
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Search and Filters */}
      <SearchFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        filters={filters}
        onFiltersChange={setFilters}
        showTenantFilters={true}
      />

      {/* Tenants Table */}
      <Card className="bg-slate-800/50 light:bg-white border-slate-700 light:border-gray-200">
        <CardHeader>
          <h3 className="font-semibold text-white light:text-gray-900">
            All Tenants ({filteredTenants.length})
          </h3>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700 light:border-gray-200">
              <tr className="text-left text-xs font-semibold text-slate-400 light:text-gray-600 uppercase">
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Plan</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Revenue</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700 light:divide-gray-200">
              {filteredTenants.map((tenant) => (
                <tr
                  key={tenant.id}
                  className="hover:bg-slate-700/50 light:hover:bg-gray-50 transition"
                >
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-white light:text-gray-900">
                        {tenant.name}
                      </p>
                      <p className="text-xs text-slate-400 light:text-gray-600">
                        {tenant.email}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={cn(
                        "text-xs px-2 py-1 rounded-full",
                        tenant.businessType === "appointment"
                          ? "bg-violet-500/20 light:bg-violet-100 text-violet-400 light:text-violet-700"
                          : "bg-orange-500/20 light:bg-orange-100 text-orange-400 light:text-orange-700",
                      )}
                    >
                      {tenant.businessType}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-medium text-slate-300 light:text-gray-700 capitalize">
                      {tenant.plan}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      {tenant.isActive ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                          <span className="text-xs text-emerald-400 light:text-emerald-600">
                            Active
                          </span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 text-slate-500" />
                          <span className="text-xs text-slate-400">
                            Inactive
                          </span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-emerald-400 light:text-emerald-600">
                      {formatCurrency(tenant.monthlyRevenue || 0)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onToggleTenantStatus(tenant.id)}
                        title={
                          tenant.isActive
                            ? "Deactivate tenant"
                            : "Activate tenant"
                        }
                        className="p-1.5 hover:bg-slate-700 light:hover:bg-gray-200 rounded transition text-slate-400 hover:text-white light:hover:text-gray-900"
                      >
                        {tenant.isActive ? (
                          <Power className="w-4 h-4" />
                        ) : (
                          <PowerOff className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        title="Edit tenant"
                        className="p-1.5 hover:bg-slate-700 light:hover:bg-gray-200 rounded transition text-slate-400 hover:text-violet-400 light:hover:text-violet-600"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeleteTenant(tenant.id)}
                        title="Delete tenant"
                        className="p-1.5 hover:bg-slate-700 light:hover:bg-gray-200 rounded transition text-slate-400 hover:text-red-400 light:hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
