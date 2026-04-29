"use client";

import React, { useState } from "react";
import { Agent, Role, Tenant } from "@/app/types";
import { Card, CardHeader } from "@/app/components/Card";
import {
  Plus,
  Edit2,
  Trash2,
  Power,
  PowerOff,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { SearchFilters } from "@/app/components/SearchFilters";

interface AgentManagementProps {
  agents: Agent[];
  roles: Role[];
  tenants: Tenant[];
  onAddAgent: (agent: Partial<Agent>) => void;
  onDeleteAgent: (id: string) => void;
  onToggleAgentStatus: (id: string) => void;
}

export function AgentManagement({
  agents,
  roles,
  tenants,
  onAddAgent,
  onDeleteAgent,
  onToggleAgentStatus,
}: AgentManagementProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<{
    agentRole?: string;
    tenantStatus?: "active" | "inactive" | undefined;
  }>({});
  const [isAddingAgent, setIsAddingAgent] = useState(false);
  const [newAgent, setNewAgent] = useState<Partial<Agent>>({
    name: "",
    email: "",
    phone: "",
    role: "staff",
    roleId: "",
    tenantId: null,
  });

  // Filter agents based on search and filters
  const filteredAgents = agents.filter((agent) => {
    const matchesSearch =
      searchTerm === "" ||
      agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = !filters.agentRole || agent.role === filters.agentRole;
    const matchesStatus =
      !filters.tenantStatus ||
      agent.isActive === (filters.tenantStatus === "active");

    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleAddAgent = () => {
    if (newAgent.name && newAgent.email && newAgent.roleId) {
      const selectedRole = roles.find((r) => r.id === newAgent.roleId);
      onAddAgent({
        ...newAgent,
        id: `agent-${Date.now()}`,
        role: selectedRole?.name || "staff",
        isActive: true,
        createdAt: new Date().toISOString(),
      });
      setNewAgent({
        name: "",
        email: "",
        phone: "",
        role: "staff",
        roleId: "",
        tenantId: null,
      });
      setIsAddingAgent(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white light:text-gray-900">
            Agent Management
          </h2>
          <p className="text-sm text-slate-400 light:text-gray-600 mt-1">
            Add and manage internal staff and agents
          </p>
        </div>
        <button
          onClick={() => setIsAddingAgent(!isAddingAgent)}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition"
        >
          <Plus className="w-4 h-4" />
          Add Agent
        </button>
      </div>

      {/* Add Agent Form */}
      {isAddingAgent && (
        <Card className="bg-slate-800/50 light:bg-white border-slate-700 light:border-gray-200">
          <CardHeader>
            <h3 className="font-semibold text-white light:text-gray-900">
              Add New Agent
            </h3>
          </CardHeader>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Full Name"
                value={newAgent.name || ""}
                onChange={(e) =>
                  setNewAgent({ ...newAgent, name: e.target.value })
                }
                className="px-4 py-2 bg-slate-700 light:bg-gray-50 text-white light:text-gray-900 rounded-lg border border-slate-600 light:border-gray-300 focus:outline-none focus:border-violet-500"
              />
              <input
                type="email"
                placeholder="Email"
                value={newAgent.email || ""}
                onChange={(e) =>
                  setNewAgent({ ...newAgent, email: e.target.value })
                }
                className="px-4 py-2 bg-slate-700 light:bg-gray-50 text-white light:text-gray-900 rounded-lg border border-slate-600 light:border-gray-300 focus:outline-none focus:border-violet-500"
              />
              <input
                type="tel"
                placeholder="Phone (optional)"
                value={newAgent.phone || ""}
                onChange={(e) =>
                  setNewAgent({ ...newAgent, phone: e.target.value })
                }
                className="px-4 py-2 bg-slate-700 light:bg-gray-50 text-white light:text-gray-900 rounded-lg border border-slate-600 light:border-gray-300 focus:outline-none focus:border-violet-500"
              />
              <label htmlFor="agent-role" className="sr-only">
                Role
              </label>
              <select
                id="agent-role"
                value={newAgent.roleId || ""}
                onChange={(e) => {
                  const selectedRole = roles.find(
                    (r) => r.id === e.target.value,
                  );
                  setNewAgent({
                    ...newAgent,
                    roleId: e.target.value,
                    role: selectedRole?.name || "",
                  });
                }}
                className="px-4 py-2 bg-slate-700 light:bg-gray-50 text-white light:text-gray-900 rounded-lg border border-slate-600 light:border-gray-300 focus:outline-none focus:border-violet-500"
              >
                <option value="">Select a Role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
              <label htmlFor="tenant-select" className="sr-only">
                Assign to Tenant (Optional)
              </label>
              <select
                id="tenant-select"
                value={newAgent.tenantId || ""}
                onChange={(e) =>
                  setNewAgent({
                    ...newAgent,
                    tenantId: e.target.value || null,
                  })
                }
                className="px-4 py-2 bg-slate-700 light:bg-gray-50 text-white light:text-gray-900 rounded-lg border border-slate-600 light:border-gray-300 focus:outline-none focus:border-violet-500"
              >
                <option value="">Platform-wide</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setIsAddingAgent(false)}
                className="px-4 py-2 bg-slate-700 light:bg-gray-200 text-white light:text-gray-900 rounded-lg hover:bg-slate-600 light:hover:bg-gray-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAgent}
                disabled={!newAgent.name || !newAgent.email || !newAgent.roleId}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition"
              >
                Add Agent
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Search and Filters */}
      <SearchFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        filters={{
          agentRole: filters.agentRole,
        }}
        onFiltersChange={(newFilters) => {
          setFilters({
            agentRole: newFilters.agentRole,
            tenantStatus: filters.tenantStatus,
          });
        }}
        showAgentFilters={true}
      />

      {/* Agents Table */}
      <Card className="bg-slate-800/50 light:bg-white border-slate-700 light:border-gray-200">
        <CardHeader>
          <h3 className="font-semibold text-white light:text-gray-900">
            All Agents ({filteredAgents.length})
          </h3>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700 light:border-gray-200">
              <tr className="text-left text-xs font-semibold text-slate-400 light:text-gray-600 uppercase">
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Assigned To</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700 light:divide-gray-200">
              {filteredAgents.map((agent) => {
                const tenant = tenants.find((t) => t.id === agent.tenantId);
                return (
                  <tr
                    key={agent.id}
                    className="hover:bg-slate-700/50 light:hover:bg-gray-50 transition"
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-white light:text-gray-900">
                        {agent.name}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs text-slate-400 light:text-gray-600">
                        {agent.email}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-500/20 light:bg-blue-100 text-blue-400 light:text-blue-700">
                        {agent.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-300 light:text-gray-700">
                        {tenant ? tenant.name : "Platform-wide"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        {agent.isActive ? (
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
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onToggleAgentStatus(agent.id)}
                          title={
                            agent.isActive
                              ? "Deactivate agent"
                              : "Activate agent"
                          }
                          className="p-1.5 hover:bg-slate-700 light:hover:bg-gray-200 rounded transition text-slate-400 hover:text-white light:hover:text-gray-900"
                        >
                          {agent.isActive ? (
                            <Power className="w-4 h-4" />
                          ) : (
                            <PowerOff className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          title="Edit agent"
                          className="p-1.5 hover:bg-slate-700 light:hover:bg-gray-200 rounded transition text-slate-400 hover:text-violet-400 light:hover:text-violet-600"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeleteAgent(agent.id)}
                          title="Delete agent"
                          className="p-1.5 hover:bg-slate-700 light:hover:bg-gray-200 rounded transition text-slate-400 hover:text-red-400 light:hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
