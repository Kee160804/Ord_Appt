"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/app/contexts/auth";
import { Card, CardBody, CardHeader } from "@/app/components/Card";
import { Lock, Shield } from "lucide-react";

/**
 * Role Management
 * ------------------------------------------------------------------
 * This page is currently READ-ONLY while the database-backed role
 * and permission implementation is being connected.
 *
 * WHY:
 * The previous implementation created, edited, and deleted roles
 * only in React state. Those changes were not persisted to Supabase
 * and therefore disappeared after refresh.
 *
 * We intentionally do NOT pretend that local state changes are real
 * role-management operations.
 *
 * The next implementation step will connect this screen to:
 * - roles
 * - role permissions / permission enforcement
 * - tenant memberships
 * - the existing team-access security model
 *
 * IMPORTANT:
 * The database/RLS layer must remain the final authority over what
 * each role is actually allowed to do.
 * ------------------------------------------------------------------
 */

type Permission =
  | "view_dashboard"
  | "manage_tenants"
  | "edit_storefront"
  | "view_analytics"
  | "manage_orders"
  | "manage_appointments"
  | "manage_customers"
  | "manage_users"
  | "view_reports"
  | "manage_billing";

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  color: string;
  createdAt: string;
}

/**
 * TEMPORARY DISPLAY DATA
 * ------------------------------------------------------------------
 * These roles are retained only so the existing Role Management UI
 * does not become empty while the real database implementation is
 * being wired.
 *
 * They MUST NOT be treated as authoritative application roles.
 *
 * Once the role schema/API is connected, remove this constant and
 * load roles from the database.
 */
const DISPLAY_ROLES: Role[] = [
  {
    id: "role-owner",
    name: "Owner",
    description: "Full access to business management",
    permissions: [
      "view_dashboard",
      "manage_tenants",
      "edit_storefront",
      "view_analytics",
      "manage_orders",
      "manage_appointments",
      "manage_customers",
      "manage_users",
      "view_reports",
      "manage_billing",
    ],
    color: "#8b5cf6",
    createdAt: "2024-01-01",
  },
  {
    id: "role-admin",
    name: "Administrator",
    description: "Can manage operations and staff",
    permissions: [
      "view_dashboard",
      "edit_storefront",
      "view_analytics",
      "manage_orders",
      "manage_appointments",
      "manage_customers",
      "manage_users",
      "view_reports",
    ],
    color: "#3b82f6",
    createdAt: "2024-01-01",
  },
  {
    id: "role-staff",
    name: "Staff",
    description: "Can view and process appointments/orders",
    permissions: [
      "view_dashboard",
      "view_analytics",
      "manage_orders",
      "manage_appointments",
      "view_reports",
    ],
    color: "#10b981",
    createdAt: "2024-01-01",
  },
];

/**
 * Permission labels currently used by the existing UI.
 *
 * IMPORTANT:
 * These have NOT yet been assumed to match the database permission
 * model. We will verify them against the team-access migration before
 * making them writable.
 */
const PERMISSION_CATALOG: {
  key: Permission;
  label: string;
  description: string;
}[] = [
  {
    key: "view_dashboard",
    label: "View Dashboard",
    description: "Access main dashboard",
  },
  {
    key: "manage_tenants",
    label: "Manage Tenants",
    description: "Create/edit/delete tenants",
  },
  {
    key: "edit_storefront",
    label: "Edit Storefront",
    description: "Customize storefront appearance",
  },
  {
    key: "view_analytics",
    label: "View Analytics",
    description: "Access analytics & reports",
  },
  {
    key: "manage_orders",
    label: "Manage Orders",
    description: "Create/edit/cancel orders",
  },
  {
    key: "manage_appointments",
    label: "Manage Appointments",
    description: "Schedule/edit appointments",
  },
  {
    key: "manage_customers",
    label: "Manage Customers",
    description: "View/edit customer data",
  },
  {
    key: "manage_users",
    label: "Manage Users",
    description: "Add/remove staff members",
  },
  {
    key: "view_reports",
    label: "View Reports",
    description: "Generate and view reports",
  },
  {
    key: "manage_billing",
    label: "Manage Billing",
    description: "Handle billing & subscriptions",
  },
];

export default function RolesManagementPage() {
  const { user, logout } = useAuth();

  /**
   * Local UI filtering/search can safely use React state because it
   * does not change authorization or database data.
   */
  const [search, setSearch] = useState("");

  const filteredRoles = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return DISPLAY_ROLES;
    }

    return DISPLAY_ROLES.filter(
      (role) =>
        role.name.toLowerCase().includes(query) ||
        role.description.toLowerCase().includes(query),
    );
  }, [search]);

  /**
   * Defense-in-depth UI check.
   *
   * /admin should already be protected by the server-side AdminLayout
   * implemented during the previous security fix.
   *
   * This client check is retained for UX only.
   */
  if (user?.role !== "superadmin") {
    return (
      <div className="pwa-page-safe min-h-dvh bg-[#070b14] p-4 text-white sm:p-8">
        <p className="text-red-400">Access denied. Super admin only.</p>
      </div>
    );
  }

  return (
    <div className="pwa-page-safe min-h-dvh space-y-6 bg-[#070b14] p-4 text-white light:bg-white light:text-gray-900 sm:p-8">
      {/* ============================================================
          PAGE HEADER
          ============================================================ */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black">Role Management</h1>

          <p className="text-slate-400">Define roles and permissions</p>
        </div>

        <button
          type="button"
          onClick={logout}
          className="rounded-lg bg-slate-800 px-4 py-2 font-semibold text-slate-400 transition hover:bg-slate-700 hover:text-white"
        >
          Logout
        </button>
      </div>

      {/* ============================================================
          DATABASE IMPLEMENTATION NOTICE
          ============================================================ */}

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
        <div className="flex items-start gap-3">
          <Shield className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />

          <div>
            <h2 className="font-semibold text-amber-300">
              Role Management is temporarily read-only
            </h2>

            <p className="mt-1 text-sm leading-6 text-slate-300">
              Role creation, editing, and deletion are temporarily disabled
              while this screen is connected to the platform&apos;s
              database-backed role and permission system.
            </p>

            <p className="mt-1 text-xs text-slate-400">
              This prevents local-only changes from appearing successful when
              they have not actually been saved or enforced.
            </p>
          </div>
        </div>
      </div>

      {/* ============================================================
          SEARCH
          ============================================================ */}

      <Card className="border-slate-700 bg-slate-800/50">
        <CardBody>
          <label
            htmlFor="role-search"
            className="mb-2 block text-sm font-medium text-slate-300"
          >
            Search Roles
          </label>

          <input
            id="role-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by role name or description..."
            className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-white placeholder-slate-400 focus:border-violet-500 focus:outline-none"
          />
        </CardBody>
      </Card>

      {/* ============================================================
          ROLES
          ============================================================ */}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredRoles.map((role) => (
          <Card
            key={role.id}
            className="border-slate-700 bg-slate-800/50 transition hover:border-slate-600"
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div
                  className="h-4 w-4 rounded-full"
                  title={`Role color: ${role.color}`}
                  style={{
                    backgroundColor: role.color,
                  }}
                />

                <h3 className="font-semibold">{role.name}</h3>
              </div>
            </CardHeader>

            <CardBody className="space-y-4">
              {/* ROLE DESCRIPTION */}

              <p className="text-sm text-slate-400">{role.description}</p>

              {/* PERMISSIONS */}

              <div>
                <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <Lock className="h-3.5 w-3.5" />
                  Permissions ({role.permissions.length})
                </h4>

                <div className="flex flex-wrap gap-2">
                  {role.permissions.map((permission) => {
                    const permissionDefinition = PERMISSION_CATALOG.find(
                      (item) => item.key === permission,
                    );

                    return (
                      <span
                        key={permission}
                        title={permissionDefinition?.description}
                        className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-300"
                      >
                        {permissionDefinition?.label ?? permission}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* READ-ONLY STATUS */}

              <div className="border-t border-slate-700 pt-4">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Lock className="h-3.5 w-3.5" />

                  <span>Database-backed editing pending</span>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* ============================================================
          EMPTY SEARCH RESULT
          ============================================================ */}

      {filteredRoles.length === 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-8 text-center">
          <Lock className="mx-auto mb-3 h-8 w-8 text-slate-500" />

          <p className="font-semibold text-slate-300">No matching roles</p>

          <p className="mt-1 text-sm text-slate-500">
            Try another role name or description.
          </p>
        </div>
      )}
    </div>
  );
}
