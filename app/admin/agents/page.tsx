"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/app/contexts/auth";
import { Card, CardBody, CardHeader } from "@/app/components/Card";
import { mockUsers } from "@/app/data/mock";
import { Plus, Shield, User } from "lucide-react";
import { createAdminAgent } from "@/app/services/adminService";

/**
 * Agent Management
 *
 * SECURITY NOTES:
 * ------------------------------------------------------------------
 * This page is only for creating tenant-scoped Staff/Admin accounts.
 *
 * Platform SUPER_ADMIN accounts must NOT be created from this screen.
 *
 * IMPORTANT:
 * - Every Staff/Admin account MUST have a tenant ID.
 * - The API must independently enforce the same rule.
 * - UI validation is not a security boundary.
 * - Edit/Delete remain disabled until persistent PATCH/DELETE API
 *   operations are implemented.
 * ------------------------------------------------------------------
 */

type AgentRole = "staff" | "admin";

interface AgentFormData {
  name: string;
  email: string;
  tenantId: string;
  role: AgentRole;
}

const EMPTY_FORM: AgentFormData = {
  name: "",
  email: "",
  tenantId: "",
  role: "staff",
};

export default function AgentsManagementPage() {
  const { user, logout } = useAuth();

  const [showAddAgent, setShowAddAgent] = useState(false);

  /**
   * Existing data is still coming from mockUsers.
   *
   * This should eventually be replaced with a database-backed GET
   * operation from the Agent Management API.
   */
  const [agents] = useState(mockUsers);

  const [formData, setFormData] = useState<AgentFormData>(EMPTY_FORM);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  /**
   * SUPER_ADMIN users are intentionally excluded.
   *
   * This page manages tenant-level users only.
   */
  const filteredAgents = useMemo(
    () => agents.filter((agent) => agent.role !== "superadmin"),
    [agents],
  );

  /**
   * Reset form state whenever the form is closed/opened.
   */
  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setFormError(null);
    setFormSuccess(null);
  };

  /**
   * Creates a tenant-scoped Staff or Admin account.
   *
   * Important:
   * We DO NOT create a fake React-state agent if the database request
   * fails. The server/database result is treated as authoritative.
   */
  const handleAddAgent = async () => {
    setFormError(null);
    setFormSuccess(null);

    const name = formData.name.trim();
    const email = formData.email.trim().toLowerCase();
    const tenantId = formData.tenantId.trim();

    // All fields are required.
    if (!name || !email || !tenantId) {
      setFormError(
        "Please enter the agent's name, email address, and tenant ID.",
      );
      return;
    }

    /**
     * Basic client-side email validation.
     *
     * Server-side validation must still be performed by the API.
     */
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
      setFormError("Please enter a valid email address.");
      return;
    }

    /**
     * Defense-in-depth check.
     *
     * The TypeScript type already limits this to staff/admin,
     * but we explicitly verify it before sending the request.
     */
    if (formData.role !== "staff" && formData.role !== "admin") {
      setFormError("Invalid agent role.");
      return;
    }

    setIsSubmitting(true);

    try {
      /**
       * CRITICAL SECURITY FIX:
       *
       * tenantId is now explicitly included.
       *
       * Previously Staff/Admin accounts were sent without tenantId.
       * If the API interpreted a missing tenant as SUPER_ADMIN,
       * that could cause privilege escalation.
       */
      await createAdminAgent({
        name,
        email,
        role: formData.role,
        tenantId,
        sendPasswordEmail: true,
      });

      /**
       * Do NOT manually insert a fake agent into React state.
       *
       * Once the GET endpoint is database-backed, this page should
       * refresh/re-fetch the list from the server here instead.
       */
      setFormSuccess("Agent created successfully.");

      resetForm();

      /**
       * Leave the success message visible momentarily by reopening
       * its state after reset.
       */
      setFormSuccess("Agent created successfully.");

      /**
       * Close the form after successful creation.
       */
      setShowAddAgent(false);
    } catch (error) {
      /**
       * CRITICAL FIX:
       *
       * Previously this error was logged and execution continued,
       * causing a fake local agent to appear even when Supabase/API
       * creation failed.
       *
       * We now STOP here and show the actual failure to the user.
       */
      console.error("Could not create agent:", error);

      setFormError(
        error instanceof Error
          ? error.message
          : "The agent could not be created. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Client-side authorization improves UX but is NOT sufficient security.
   *
   * The API, server layout, and Supabase RLS must independently verify
   * that the current account is a SUPER_ADMIN.
   */
  if (user?.role !== "superadmin") {
    return (
      <div className="pwa-page-safe min-h-dvh bg-[#070b14] p-4 text-white sm:p-8">
        <p className="text-red-400">
          Access denied. This page is restricted to platform super
          administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="pwa-page-safe min-h-dvh space-y-6 bg-[#070b14] p-4 text-white light:bg-white light:text-gray-900 sm:p-8">
      {/* PAGE HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black">Agent Management</h1>

          <p className="text-slate-400">
            Manage tenant-level staff and administrators
          </p>
        </div>

        <div className="flex flex-wrap gap-2 sm:gap-4">
          <button
            type="button"
            onClick={() => {
              resetForm();
              setShowAddAgent((current) => !current);
            }}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 font-semibold transition hover:bg-violet-700"
          >
            <Plus className="h-5 w-5" />
            Add Agent
          </button>

          <button
            type="button"
            onClick={logout}
            className="rounded-lg bg-slate-800 px-4 py-2 font-semibold text-slate-400 transition hover:bg-slate-700 hover:text-white"
          >
            Logout
          </button>
        </div>
      </div>

      {/* SUCCESS MESSAGE */}
      {formSuccess && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
          {formSuccess}
        </div>
      )}

      {/* ADD AGENT FORM */}
      {showAddAgent && (
        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader>
            <div>
              <h3 className="font-semibold">Add New Agent</h3>

              <p className="mt-1 text-sm text-slate-400">
                Staff and administrators must belong to a business tenant.
              </p>
            </div>
          </CardHeader>

          <CardBody className="space-y-4">
            {/* FORM ERROR */}
            {formError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {formError}
              </div>
            )}

            {/* FULL NAME */}
            <div>
              <label
                htmlFor="agent-name"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Full Name
              </label>

              <input
                id="agent-name"
                type="text"
                value={formData.name}
                disabled={isSubmitting}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-white placeholder-slate-400 focus:border-violet-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="John Doe"
                autoComplete="name"
              />
            </div>

            {/* EMAIL */}
            <div>
              <label
                htmlFor="agent-email"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Email
              </label>

              <input
                id="agent-email"
                type="email"
                value={formData.email}
                disabled={isSubmitting}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-white placeholder-slate-400 focus:border-violet-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="john@example.com"
                autoComplete="email"
              />
            </div>

            {/* TENANT ID */}
            <div>
              <label
                htmlFor="agent-tenant"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Business / Tenant ID
              </label>

              <input
                id="agent-tenant"
                type="text"
                value={formData.tenantId}
                disabled={isSubmitting}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    tenantId: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-white placeholder-slate-400 focus:border-violet-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="Enter tenant UUID"
                autoComplete="off"
              />

              <p className="mt-2 text-xs text-slate-400">
                Required. The agent will only belong to this business tenant.
              </p>
            </div>

            {/* ROLE */}
            <div>
              <label
                htmlFor="agent-role"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Role
              </label>

              <select
                id="agent-role"
                value={formData.role}
                disabled={isSubmitting}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    role: event.target.value as AgentRole,
                  }))
                }
                className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-white focus:border-violet-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="staff">Staff - Order/Booking management</option>

                <option value="admin">Admin - Full tenant access</option>
              </select>

              <p className="mt-2 text-xs text-slate-400">
                Platform super-admin accounts cannot be created here.
              </p>
            </div>

            {/* FORM ACTIONS */}
            <div className="flex flex-wrap gap-4">
              <button
                type="button"
                onClick={handleAddAgent}
                disabled={isSubmitting}
                className="rounded-lg bg-violet-600 px-6 py-2 font-semibold transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Creating..." : "Save Agent"}
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  resetForm();
                  setShowAddAgent(false);
                }}
                className="rounded-lg bg-slate-700 px-6 py-2 font-semibold transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* AGENT LIST */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredAgents.map((agent) => (
          <Card key={agent.id} className="border-slate-700 bg-slate-800/50">
            <CardBody className="space-y-4">
              {/* AGENT HEADER */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600 font-bold text-white">
                    {agent.avatar}
                  </div>

                  <div>
                    <h3 className="font-semibold">{agent.name}</h3>

                    <p className="text-sm text-slate-400">{agent.email}</p>
                  </div>
                </div>
              </div>

              {/* ROLE */}
              <div className="flex items-center justify-between border-t border-slate-700/50 pt-4 text-sm">
                <span className="text-slate-400">Role:</span>

                <span className="flex items-center gap-1 rounded-full bg-violet-600/20 px-2 py-1 text-xs font-semibold capitalize text-violet-400">
                  {agent.role === "admin" ? (
                    <Shield className="h-3 w-3" />
                  ) : (
                    <User className="h-3 w-3" />
                  )}

                  {agent.role}
                </span>
              </div>

              {/* AGENT INFORMATION */}
              <div className="space-y-2 border-t border-slate-700/50 pt-4 text-xs text-slate-400">
                <div className="flex justify-between">
                  <span>Created:</span>
                  <span>{agent.createdAt}</span>
                </div>

                <div className="flex justify-between">
                  <span>Last Login:</span>
                  <span>{agent.lastLogin}</span>
                </div>
              </div>

              {/* TEMPORARILY DISABLED MANAGEMENT ACTIONS */}
              <div className="border-t border-slate-700/50 pt-4">
                <p className="text-xs text-slate-500">
                  Editing and deletion are temporarily disabled until persistent
                  database-backed operations are available.
                </p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* EMPTY STATE */}
      {filteredAgents.length === 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-8 text-center">
          <User className="mx-auto mb-3 h-8 w-8 text-slate-500" />

          <p className="font-semibold text-slate-300">No agents found</p>

          <p className="mt-1 text-sm text-slate-500">
            Create a tenant-level staff or administrator account to get started.
          </p>
        </div>
      )}
    </div>
  );
}
