"use client";

import React, { useState } from "react";
import { Role, PermissionType } from "@/app/types";
import { Card, CardHeader } from "@/app/components/Card";
import { Plus, Trash2, Edit2, Check } from "lucide-react";

interface RoleManagementProps {
  roles: Role[];
  onAddRole: (role: Partial<Role>) => void;
  onDeleteRole: (id: string) => void;
}

const AVAILABLE_PERMISSIONS: { value: PermissionType; label: string }[] = [
  { value: "view_dashboard", label: "View Dashboard" },
  { value: "manage_tenants", label: "Manage Tenants" },
  { value: "edit_storefront", label: "Edit Storefront" },
  { value: "view_analytics", label: "View Analytics" },
  { value: "manage_agents", label: "Manage Agents" },
  { value: "manage_roles", label: "Manage Roles" },
];

export function RoleManagement({
  roles,
  onAddRole,
  onDeleteRole,
}: RoleManagementProps) {
  const [isAddingRole, setIsAddingRole] = useState(false);
  const [newRole, setNewRole] = useState<Partial<Role>>({
    name: "",
    description: "",
    permissions: [],
    isSystem: false,
  });

  const handleAddRole = () => {
    if (newRole.name && newRole.permissions && newRole.permissions.length > 0) {
      onAddRole({
        ...newRole,
        id: `role-${Date.now()}`,
        createdAt: new Date().toISOString(),
      });
      setNewRole({
        name: "",
        description: "",
        permissions: [],
        isSystem: false,
      });
      setIsAddingRole(false);
    }
  };

  const togglePermission = (permission: PermissionType) => {
    const current = newRole.permissions || [];
    if (current.includes(permission)) {
      setNewRole({
        ...newRole,
        permissions: current.filter((p) => p !== permission),
      });
    } else {
      setNewRole({
        ...newRole,
        permissions: [...current, permission],
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white light:text-gray-900">
            Role Management
          </h2>
          <p className="text-sm text-slate-400 light:text-gray-600 mt-1">
            Create and configure user roles with permissions
          </p>
        </div>
        <button
          onClick={() => setIsAddingRole(!isAddingRole)}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition"
        >
          <Plus className="w-4 h-4" />
          Add Role
        </button>
      </div>

      {/* Add Role Form */}
      {isAddingRole && (
        <Card className="bg-slate-800/50 light:bg-white border-slate-700 light:border-gray-200">
          <CardHeader>
            <h3 className="font-semibold text-white light:text-gray-900">
              Create New Role
            </h3>
          </CardHeader>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-white light:text-gray-900 mb-2">
                Role Name
              </label>
              <input
                type="text"
                placeholder="e.g., Content Manager"
                value={newRole.name || ""}
                onChange={(e) =>
                  setNewRole({ ...newRole, name: e.target.value })
                }
                className="w-full px-4 py-2 bg-slate-700 light:bg-gray-50 text-white light:text-gray-900 rounded-lg border border-slate-600 light:border-gray-300 focus:outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white light:text-gray-900 mb-2">
                Description
              </label>
              <textarea
                placeholder="Describe the purpose of this role"
                value={newRole.description || ""}
                onChange={(e) =>
                  setNewRole({ ...newRole, description: e.target.value })
                }
                className="w-full px-4 py-2 bg-slate-700 light:bg-gray-50 text-white light:text-gray-900 rounded-lg border border-slate-600 light:border-gray-300 focus:outline-none focus:border-violet-500 resize-none"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white light:text-gray-900 mb-3">
                Permissions
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {AVAILABLE_PERMISSIONS.map((perm) => (
                  <label
                    key={perm.value}
                    className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-slate-700/50 light:hover:bg-gray-100 transition"
                  >
                    <input
                      type="checkbox"
                      checked={(newRole.permissions || []).includes(perm.value)}
                      onChange={() => togglePermission(perm.value)}
                      className="w-4 h-4 rounded bg-slate-700 light:bg-gray-300 border-slate-600 light:border-gray-400 text-violet-600 cursor-pointer"
                    />
                    <span className="text-sm text-white light:text-gray-900">
                      {perm.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <button
                onClick={() => setIsAddingRole(false)}
                className="px-4 py-2 bg-slate-700 light:bg-gray-200 text-white light:text-gray-900 rounded-lg hover:bg-slate-600 light:hover:bg-gray-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAddRole}
                disabled={(newRole.permissions || []).length === 0}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition"
              >
                Create Role
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {roles.map((role) => (
          <Card
            key={role.id}
            className="bg-slate-800/50 light:bg-white border-slate-700 light:border-gray-200"
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-white light:text-gray-900">
                    {role.name}
                  </h3>
                  <p className="text-xs text-slate-400 light:text-gray-600 mt-1">
                    {role.description}
                  </p>
                  {role.isSystem && (
                    <span className="inline-block mt-2 text-xs px-2 py-1 rounded bg-slate-700 light:bg-gray-200 text-slate-300 light:text-gray-700">
                      System Role
                    </span>
                  )}
                </div>
                {!role.isSystem && (
                  <div className="flex gap-1">
                    <button
                      title="Edit role"
                      className="p-1.5 hover:bg-slate-700 light:hover:bg-gray-200 rounded transition text-slate-400 hover:text-violet-400 light:hover:text-violet-600"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDeleteRole(role.id)}
                      title="Delete role"
                      className="p-1.5 hover:bg-slate-700 light:hover:bg-gray-200 rounded transition text-slate-400 hover:text-red-400 light:hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-medium text-slate-400 light:text-gray-600 uppercase mb-2">
                  Permissions
                </p>
                <div className="flex flex-wrap gap-2">
                  {role.permissions.map((perm) => (
                    <span
                      key={perm}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-violet-500/20 light:bg-violet-100 text-violet-400 light:text-violet-700"
                    >
                      <Check className="w-3 h-3" />
                      {AVAILABLE_PERMISSIONS.find((p) => p.value === perm)
                        ?.label || perm}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {roles.length === 0 && !isAddingRole && (
        <Card className="bg-slate-800/50 light:bg-white border-slate-700 light:border-gray-200 text-center py-12">
          <p className="text-slate-400 light:text-gray-600">
            No roles created yet. Create your first role to get started.
          </p>
        </Card>
      )}
    </div>
  );
}
