"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/app/contexts/auth";
import { Card, CardHeader, CardBody } from "@/app/components/Card";
import { mockUsers } from "@/app/data/mock";
import { Plus, Trash2, Edit2, Shield, User } from "lucide-react";
import { createAdminAgent } from "@/app/services/adminService";

export default function AgentsManagementPage() {
  const { user, logout } = useAuth();
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [agents, setAgents] = useState(mockUsers);
  const [editingAgent, setEditingAgent] = useState<
    (typeof mockUsers)[0] | null
  >(null);
  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    role: "staff" | "admin";
  }>({
    name: "",
    email: "",
    role: "staff",
  });

  // COMMENT: Filter out super admin and get all staff/admin users
  const filteredAgents = useMemo(
    () => agents.filter((a) => a.role !== "superadmin"),
    [agents],
  );

  // COMMENT: Handle adding new agent
  const handleAddAgent = async () => {
    if (!formData.name || !formData.email) {
      alert("Please fill in all fields");
      return;
    }

    try {
      await createAdminAgent({
        name: formData.name,
        email: formData.email,
        role: formData.role,
        sendPasswordEmail: true,
      });
    } catch (err) {
      console.warn("Could not create agent in database:", err);
    }

    const newAgent = {
      id: `agent-${Date.now()}`,
      tenantId: null,
      name: formData.name,
      email: formData.email,
      role: formData.role,
      avatar: formData.name.charAt(0).toUpperCase(),
      createdAt: new Date().toISOString().split("T")[0],
      lastLogin: new Date().toISOString().split("T")[0],
    };

    if (editingAgent) {
      // COMMENT: Update existing agent
      setAgents(agents.map((a) => (a.id === editingAgent.id ? newAgent : a)));
      setEditingAgent(null);
    } else {
      // COMMENT: Add new agent
      setAgents([...agents, newAgent]);
    }

    setFormData({ name: "", email: "", role: "staff" });
    setShowAddAgent(false);
  };

  // COMMENT: Handle deleting agent
  const handleDeleteAgent = (id: string) => {
    if (confirm("Are you sure you want to delete this agent?")) {
      setAgents(agents.filter((a) => a.id !== id));
    }
  };

  // COMMENT: Handle editing agent
  const handleEditAgent = (agent: (typeof mockUsers)[0]) => {
    setEditingAgent(agent);
    setFormData({
      name: agent.name,
      email: agent.email,
      role: agent.role === "admin" ? "admin" : "staff",
    });
    setShowAddAgent(true);
  };

  // COMMENT: Verify user is super admin
  if (user?.role !== "superadmin") {
    return (
      <div className="pwa-page-safe min-h-dvh bg-[#070b14] p-4 text-white sm:p-8">
        <p className="text-red-400">Access denied. Super admin only.</p>
      </div>
    );
  }

  return (
    <div className="pwa-page-safe min-h-dvh space-y-6 bg-[#070b14] p-4 text-white light:bg-white light:text-gray-900 sm:p-8">
      {/* HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black">Agent Management</h1>
          <p className="text-slate-400">Manage internal staff and admins</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-4">
          <button
            onClick={() => {
              setEditingAgent(null);
              setFormData({ name: "", email: "", role: "staff" });
              setShowAddAgent(!showAddAgent);
            }}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg font-semibold flex items-center gap-2 transition"
          >
            <Plus className="w-5 h-5" />
            Add Agent
          </button>
          <button
            onClick={logout}
            className="px-4 py-2 text-slate-400 hover:text-white bg-slate-800 rounded-lg font-semibold hover:bg-slate-700 transition"
          >
            Logout
          </button>
        </div>
      </div>

      {/* ADD/EDIT AGENT FORM */}
      {showAddAgent && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <h3 className="font-semibold">
              {editingAgent ? "Edit Agent" : "Add New Agent"}
            </h3>
          </CardHeader>
          <CardBody className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-violet-500"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-violet-500"
                placeholder="john@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Role
              </label>
              <select
                value={formData.role}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    role: e.target.value as "staff" | "admin",
                  })
                }
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-violet-500"
              >
                <option value="staff">Staff - Order/Booking management</option>
                <option value="admin">Admin - Full tenant access</option>
              </select>
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleAddAgent}
                className="px-6 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg font-semibold transition"
              >
                {editingAgent ? "Update Agent" : "Save Agent"}
              </button>
              <button
                onClick={() => {
                  setShowAddAgent(false);
                  setEditingAgent(null);
                }}
                className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition"
              >
                Cancel
              </button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* AGENTS LIST */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAgents.map((agent) => (
          <Card key={agent.id} className="bg-slate-800/50 border-slate-700">
            <CardBody className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center font-bold text-white">
                    {agent.avatar}
                  </div>
                  <div>
                    <h3 className="font-semibold">{agent.name}</h3>
                    <p className="text-sm text-slate-400">{agent.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEditAgent(agent)}
                    className="p-2 text-slate-400 hover:text-white rounded-lg transition"
                    title="Edit agent"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteAgent(agent.id)}
                    className="p-2 text-red-400 hover:text-red-300 rounded-lg transition"
                    title="Delete agent"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-700/50 pt-4 flex justify-between items-center text-sm">
                <span className="text-slate-400">Role:</span>
                <span className="px-2 py-1 bg-violet-600/20 text-violet-400 rounded-full text-xs font-semibold capitalize flex items-center gap-1">
                  {agent.role === "admin" ? (
                    <Shield className="w-3 h-3" />
                  ) : (
                    <User className="w-3 h-3" />
                  )}
                  {agent.role}
                </span>
              </div>

              <div className="border-t border-slate-700/50 pt-4 space-y-2 text-xs text-slate-400">
                <div className="flex justify-between">
                  <span>Created:</span>
                  <span>{agent.createdAt}</span>
                </div>
                <div className="flex justify-between">
                  <span>Last Login:</span>
                  <span>{agent.lastLogin}</span>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
