"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/app/contexts/auth";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardBody } from "@/app/components/Card";
import { mockUsers } from "@/app/data/mock";
import { Plus, Trash2, Edit2, Shield, User, UserCheck } from "lucide-react";

export default function AgentsManagementPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [agents, setAgents] = useState(mockUsers);
  const [editingAgent, setEditingAgent] = useState<
    (typeof mockUsers)[0] | null
  >(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "staff" as "staff" | "admin",
  });

  // COMMENT: Filter out super admin and get all staff/admin users
  const filteredAgents = useMemo(
    () => agents.filter((a) => a.role !== "superadmin"),
    [agents],
  );

  // COMMENT: Handle adding new agent
  const handleAddAgent = () => {
    if (!formData.name || !formData.email) {
      alert("Please fill in all fields");
      return;
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
      role: agent.role as any,
    });
    setShowAddAgent(true);
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
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">Agent Management</h1>
          <p className="text-slate-400">Manage internal staff and admins</p>
        </div>
        <div className="flex gap-4">
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
              <label
                htmlFor="role-select"
                className="block text-sm font-medium text-slate-300 mb-2"
              >
                Role
              </label>
              <select
                id="role-select"
                value={formData.role}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    role: e.target.value as "staff" | "admin",
                  })
                }
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-violet-500"
              >
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleAddAgent}
                className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg font-semibold transition"
              >
                {editingAgent ? "Update Agent" : "Add Agent"}
              </button>
              <button
                onClick={() => {
                  setShowAddAgent(false);
                  setEditingAgent(null);
                  setFormData({ name: "", email: "", role: "staff" });
                }}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition"
              >
                Cancel
              </button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* AGENTS TABLE */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <h3 className="font-semibold">
            All Agents ({filteredAgents.length})
          </h3>
        </CardHeader>
        <div className="divide-y divide-slate-700">
          <div className="px-6 py-4 grid grid-cols-4 gap-4 text-sm font-semibold text-slate-400">
            <div>Name</div>
            <div>Email</div>
            <div>Role</div>
            <div>Actions</div>
          </div>

          {/* COMMENT: Map through agents and display in table format */}
          {filteredAgents.length === 0 ? (
            <div className="px-6 py-8 text-center text-slate-400">
              No agents yet. Create one to get started.
            </div>
          ) : (
            filteredAgents.map((agent) => (
              <div
                key={agent.id}
                className="px-6 py-4 grid grid-cols-4 gap-4 items-center hover:bg-slate-700/30 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-sm font-bold">
                    {agent.avatar}
                  </div>
                  <div>
                    <p className="font-medium">{agent.name}</p>
                  </div>
                </div>

                <div className="text-slate-400">{agent.email}</div>

                <div>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-700 text-slate-200 flex items-center gap-1 w-fit">
                    {agent.role === "admin" ? (
                      <Shield className="w-3 h-3" />
                    ) : (
                      <User className="w-3 h-3" />
                    )}
                    {agent.role.charAt(0).toUpperCase() + agent.role.slice(1)}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditAgent(agent)}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition"
                    title="Edit agent"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteAgent(agent.id)}
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition"
                    title="Delete agent"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
