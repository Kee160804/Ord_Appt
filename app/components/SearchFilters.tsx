"use client";

import React from "react";
import { Search, Filter, X } from "lucide-react";
import { BusinessType, PlanType, TenantStatus } from "@/app/types";

interface FilterState {
  tenantStatus?: TenantStatus;
  agentRole?: string;
  businessType?: BusinessType;
  subscriptionPlan?: PlanType;
}

interface SearchFiltersProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  showTenantFilters?: boolean;
  showAgentFilters?: boolean;
}

export function SearchFilters({
  searchTerm,
  onSearchChange,
  filters,
  onFiltersChange,
  showTenantFilters = false,
  showAgentFilters = false,
}: SearchFiltersProps) {
  const clearFilters = () => {
    onSearchChange("");
    onFiltersChange({});
  };

  const hasActiveFilters =
    searchTerm ||
    Object.values(filters).some((f) => f !== undefined && f !== "");

  return (
    <div className="space-y-3 p-4 bg-slate-800/30 light:bg-gray-50 rounded-xl border border-slate-700 light:border-gray-200">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name, email, or ID..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-slate-700 light:bg-white text-white light:text-gray-900 rounded-lg border border-slate-600 light:border-gray-300 focus:outline-none focus:border-violet-500 light:focus:border-violet-500 transition"
        />
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter className="w-4 h-4 text-slate-400" />

        {showTenantFilters && (
          <>
            {/* Tenant Status Filter */}
            <label htmlFor="status-filter" className="sr-only">
              Tenant Status
            </label>
            <select
              id="status-filter"
              value={filters.tenantStatus || ""}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  tenantStatus: (e.target.value || undefined) as
                    | TenantStatus
                    | undefined,
                })
              }
              className="px-3 py-1 text-sm bg-slate-700 light:bg-white text-white light:text-gray-900 rounded-lg border border-slate-600 light:border-gray-300 focus:outline-none focus:border-violet-500"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>

            {/* Business Type Filter */}
            <label htmlFor="type-filter" className="sr-only">
              Business Type
            </label>
            <select
              id="type-filter"
              value={filters.businessType || ""}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  businessType: (e.target.value || undefined) as
                    | BusinessType
                    | undefined,
                })
              }
              className="px-3 py-1 text-sm bg-slate-700 light:bg-white text-white light:text-gray-900 rounded-lg border border-slate-600 light:border-gray-300 focus:outline-none focus:border-violet-500"
            >
              <option value="">All Types</option>
              <option value="appointment">Appointment</option>
              <option value="ordering">Ordering</option>
            </select>

            {/* Subscription Plan Filter */}
            <label htmlFor="plan-filter" className="sr-only">
              Subscription Plan
            </label>
            <select
              id="plan-filter"
              value={filters.subscriptionPlan || ""}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  subscriptionPlan: (e.target.value || undefined) as
                    | PlanType
                    | undefined,
                })
              }
              className="px-3 py-1 text-sm bg-slate-700 light:bg-white text-white light:text-gray-900 rounded-lg border border-slate-600 light:border-gray-300 focus:outline-none focus:border-violet-500"
            >
              <option value="">All Plans</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </>
        )}

        {showAgentFilters && (
          <>
            {/* Agent Role Filter */}
            <label htmlFor="role-filter" className="sr-only">
              Agent Role
            </label>
            <select
              id="role-filter"
              value={filters.agentRole || ""}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  agentRole: e.target.value || undefined,
                })
              }
              className="px-3 py-1 text-sm bg-slate-700 light:bg-white text-white light:text-gray-900 rounded-lg border border-slate-600 light:border-gray-300 focus:outline-none focus:border-violet-500"
            >
              <option value="">All Roles</option>
              <option value="admin">Admin</option>
              <option value="staff">Staff</option>
              <option value="support">Support</option>
            </select>

            {/* Status Filter */}
            <label htmlFor="agent-status-filter" className="sr-only">
              Agent Status
            </label>
            <select
              id="agent-status-filter"
              value={filters.tenantStatus || ""}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  tenantStatus: (e.target.value || undefined) as
                    | TenantStatus
                    | undefined,
                })
              }
              className="px-3 py-1 text-sm bg-slate-700 light:bg-white text-white light:text-gray-900 rounded-lg border border-slate-600 light:border-gray-300 focus:outline-none focus:border-violet-500"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </>
        )}

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="ml-auto flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-white light:hover:text-gray-900 hover:bg-slate-700 light:hover:bg-gray-200 rounded transition"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
