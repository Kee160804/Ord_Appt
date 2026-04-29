"use client";

import { useState } from "react";
import { useAuth } from "@/app/contexts/auth";
import { Card, CardHeader, CardBody } from "@/app/components/Card";
import { Plus, Trash2, Edit2, Lock } from "lucide-react";

// COMMENT: Define permission types for role-based access control
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

export default function RolesManagementPage() {
  const { user, logout } = useAuth();
  const [showAddRole, setShowAddRole] = useState(false);
  const [roles, setRoles] = useState<Role[]>([
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
  ]);

  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>(
    [],
  );
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "#8b5cf6",
  });

  // COMMENT: All available permissions for the system
  const allPermissions: {
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

  // COMMENT: Handle adding new role
  const handleAddRole = () => {
    if (!formData.name || !formData.description) {
      alert("Please fill in all fields");
      return;
    }

    // COMMENT: Generate unique ID - use editing ID if updating, otherwise use timestamp approach
    let newRoleId: string;
    if (editingRole) {
      newRoleId = editingRole.id;
    } else {
      // COMMENT: For new roles, use a UUID-like pattern without impure functions
      newRoleId = `role-custom-${roles.length + 1}`;
    }

    const newRole: Role = {
      id: newRoleId,
      name: formData.name,
      description: formData.description,
      permissions: selectedPermissions,
      color: formData.color,
      createdAt: new Date().toISOString().split("T")[0],
    };

    if (editingRole) {
      // COMMENT: Update existing role
      setRoles(roles.map((r) => (r.id === editingRole.id ? newRole : r)));
      setEditingRole(null);
    } else {
      // COMMENT: Add new role
      setRoles([...roles, newRole]);
    }

    resetForm();
  };

  // COMMENT: Reset form to initial state
  const resetForm = () => {
    setFormData({ name: "", description: "", color: "#8b5cf6" });
    setSelectedPermissions([]);
    setShowAddRole(false);
  };

  // COMMENT: Handle editing role
  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description,
      color: role.color,
    });
    setSelectedPermissions(role.permissions);
    setShowAddRole(true);
  };

  // COMMENT: Handle deleting role
  const handleDeleteRole = (id: string) => {
    if (confirm("Are you sure you want to delete this role?")) {
      setRoles(roles.filter((r) => r.id !== id));
    }
  };

  // COMMENT: Toggle permission selection
  const togglePermission = (permission: Permission) => {
    setSelectedPermissions((prev) =>
      prev.includes(permission)
        ? prev.filter((p) => p !== permission)
        : [...prev, permission],
    );
  };

  // COMMENT: Verify user is super admin
  if (user?.role !== "superadmin") {
    return (
      <div className="p-8 bg-[#070b14] min-h-screen text-white">
        <p className="text-red-400">Access denied. Super admin only.</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 bg-[#070b14] light:bg-white min-h-screen text-white light:text-gray-900">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">Role Management</h1>
          <p className="text-slate-400">Define roles and permissions</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => {
              setEditingRole(null);
              resetForm();
              setShowAddRole(!showAddRole);
            }}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg font-semibold flex items-center gap-2 transition"
          >
            <Plus className="w-5 h-5" />
            Create Role
          </button>
          <button
            onClick={logout}
            className="px-4 py-2 text-slate-400 hover:text-white bg-slate-800 rounded-lg font-semibold hover:bg-slate-700 transition"
          >
            Logout
          </button>
        </div>
      </div>

      {/* CREATE/EDIT ROLE FORM */}
      {showAddRole && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <h3 className="font-semibold">
              {editingRole ? "Edit Role" : "Create New Role"}
            </h3>
          </CardHeader>
          <CardBody className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Role Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-violet-500"
                  placeholder="e.g., Moderator"
                />
              </div>

              <div>
                <label
                  htmlFor="color-input"
                  className="block text-sm font-medium text-slate-300 mb-2"
                >
                  Color
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    id="color-input"
                    type="color"
                    value={formData.color}
                    onChange={(e) =>
                      setFormData({ ...formData, color: e.target.value })
                    }
                    className="h-10 w-14 rounded-lg border border-slate-600 cursor-pointer"
                  />
                  <span className="text-sm text-slate-400">
                    {formData.color}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-violet-500"
                placeholder="Describe this role's purpose"
                rows={2}
              />
            </div>

            {/* Permissions */}
            <div>
              <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Permissions
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* COMMENT: Display all available permissions as checkboxes */}
                {allPermissions.map((perm) => (
                  <label
                    key={perm.key}
                    className="flex items-start gap-3 p-3 rounded-lg bg-slate-700/50 cursor-pointer hover:bg-slate-700 transition"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPermissions.includes(perm.key)}
                      onChange={() => togglePermission(perm.key)}
                      className="mt-1 w-4 h-4 rounded accent-violet-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-white">
                        {perm.label}
                      </p>
                      <p className="text-xs text-slate-400">
                        {perm.description}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleAddRole}
                className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg font-semibold transition"
              >
                {editingRole ? "Update Role" : "Create Role"}
              </button>
              <button
                onClick={resetForm}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition"
              >
                Cancel
              </button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ROLES LIST */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* COMMENT: Display each role as a card */}
        {roles.map((role) => (
          <Card
            key={role.id}
            className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition"
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full"
                  title={`Role color: ${role.color}`}
                  style={{ backgroundColor: role.color } as React.CSSProperties}
                />
                <h3 className="font-semibold">{role.name}</h3>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <p className="text-sm text-slate-400">{role.description}</p>

              <div>
                <h4 className="text-xs font-semibold text-slate-300 mb-2">
                  Permissions ({role.permissions.length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {/* COMMENT: Display permissions as tags */}
                  {role.permissions.map((perm) => (
                    <span
                      key={perm}
                      className="px-2 py-1 text-xs rounded bg-slate-700 text-slate-300"
                    >
                      {allPermissions
                        .find((p) => p.key === perm)
                        ?.label.split(" ")[0] || perm}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t border-slate-700">
                <button
                  onClick={() => handleEditRole(role)}
                  className="flex-1 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition flex items-center justify-center gap-2"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteRole(role.id)}
                  className="flex-1 px-3 py-2 text-sm text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
