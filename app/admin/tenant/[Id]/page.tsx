"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useMemo, useState } from "react";
// NEW: Import useRealtime to get dynamic tenants created via signup
import { useRealtime } from "@/app/contexts/realtime";
import { mockTenants, mockAnalytics } from "@/app/data/mock";
import { Card, CardHeader, CardBody } from "./../../../components/Card";
import { formatCurrency } from "@/app/lib/utils";
import { ArrowLeft, Eye, Trash2, Ban, AlertCircle } from "lucide-react";
// NEW: Import useRouter to redirect after delete
import { useRouter } from "next/navigation";

export default function TenantDetailPage() {
  const router = useRouter();
  // COMMENT: Get the tenant ID from the URL parameter
  const { id } = useParams<{ id: string }>();

  // NEW: Add state management for tenant status (active, disabled, deleted)
  const [tenantStatus, setTenantStatus] = useState<
    "active" | "disabled" | "deleted"
  >("active");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [disableReason, setDisableReason] = useState("");

  // NEW: Get dynamic tenants from realtime context
  const realtime = useRealtime();
  const dynamicTenants = useMemo(() => realtime.getTenantTenants(), [realtime]);

  // ENHANCED: Look for tenant in both mock and dynamic tenants
  const allTenants = useMemo(
    () => [...mockTenants, ...dynamicTenants],
    [dynamicTenants],
  );
  // FIXED: Decode URL parameter and handle case-sensitivity
  const decodedId = id ? decodeURIComponent(id) : "";
  const tenant = allTenants.find((t) => t.id === decodedId);
  const analytics = mockAnalytics[decodedId];

  // COMMENT: If tenant is not found, show error message with helpful info
  if (!tenant) {
    return (
      <div className="p-8 bg-[#070b14] light:bg-white min-h-screen text-white light:text-gray-900">
        <div className="max-w-md mx-auto mt-12 bg-red-900/20 light:bg-red-50 border border-red-500 light:border-red-300 rounded-2xl p-6">
          <div className="flex gap-3">
            <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-400 light:text-red-700 mb-2">
                Tenant Not Found
              </h3>
              <p className="text-sm text-red-300 light:text-red-600 mb-4">
                {/* The tenant with ID "{decodedId}" does not exist in the system. */}
              </p>
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-xl transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Admin
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // COMMENT: Handle tenant deletion - removes from system
  const handleDeleteTenant = () => {
    // TODO: In a real app, this would make an API call to delete the tenant
    setTenantStatus("deleted");
    setShowDeleteModal(false);
    // NEW: Redirect back to admin after 2 seconds
    setTimeout(() => {
      router.push("/admin");
    }, 2000);
  };

  // COMMENT: Handle tenant disabling - suspends account access
  const handleDisableTenant = () => {
    // TODO: In a real app, this would make an API call to disable the tenant
    setTenantStatus("disabled");
    setShowDisableModal(false);
  };

  // COMMENT: Handle re-enabling a disabled tenant account
  const handleEnableTenant = () => {
    // TODO: In a real app, this would make an API call to re-enable the tenant
    setTenantStatus("active");
  };

  return (
    // ENHANCED: Added dark theme styling to match admin dashboard
    <div className="p-8 space-y-6 bg-[#070b14] light:bg-white min-h-screen text-white light:text-gray-900">
      {/* COMMENT: Status badge showing if tenant is disabled or deleted */}
      {tenantStatus !== "active" && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 ${
            tenantStatus === "disabled"
              ? "bg-amber-900/20 light:bg-amber-50 border-amber-500 light:border-amber-300"
              : "bg-red-900/20 light:bg-red-50 border-red-500 light:border-red-300"
          }`}
        >
          <AlertCircle
            className={`w-5 h-5 ${tenantStatus === "disabled" ? "text-amber-500" : "text-red-500"}`}
          />
          <span
            className={`font-medium ${tenantStatus === "disabled" ? "text-amber-300 light:text-amber-700" : "text-red-300 light:text-red-700"}`}
          >
            {tenantStatus === "disabled"
              ? "This tenant account is currently disabled"
              : "This tenant account has been deleted"}
          </span>
        </div>
      )}

      {/* COMMENT: Header with back button and action buttons */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm text-slate-400 light:text-gray-600 hover:text-white light:hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Admin
        </Link>

        {/* COMMENT: Action buttons - view business and manage tenant */}
        <div className="flex items-center gap-3">
          {/* COMMENT: Button to view the tenant's business in a new tab */}
          <a
            href={`/store-front/${tenant.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors"
            title="View this business in a new tab"
          >
            <Eye className="w-4 h-4" />
            View Business
          </a>

          {/* COMMENT: Disable button - suspends tenant access if payment issues or other needs */}
          <button
            onClick={() => setShowDisableModal(true)}
            disabled={tenantStatus === "deleted"}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors"
            title="Disable this tenant account"
          >
            <Ban className="w-4 h-4" />
            Disable
          </button>

          {/* COMMENT: Delete button - permanently removes tenant from system */}
          <button
            onClick={() => setShowDeleteModal(true)}
            disabled={tenantStatus === "deleted"}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors"
            title="Permanently delete this tenant account"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>

      {/* COMMENT: Tenant header with logo, name and details */}
      <div className="flex items-center gap-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
          // COMMENT: Using inline style for dynamic background color since it's not a Tailwind class
          style={{ backgroundColor: tenant.logoBg }}
        >
          {tenant.logo}
        </div>
        <div>
          <h1 className="text-2xl font-black text-white light:text-gray-900">
            {tenant.name}
          </h1>
          <p className="text-slate-400 light:text-gray-600">
            {tenant.businessType === "appointment"
              ? "Appointment Booking"
              : "Food Ordering"}{" "}
            · {tenant.city}
          </p>
          <p className="text-xs text-slate-500 light:text-gray-500 mt-1">
            ID: {tenant.id}
          </p>
        </div>
      </div>

      {/* COMMENT: Business info cards - revenue, transactions, customers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Total Revenue"
          value={formatCurrency(analytics?.totalRevenue ?? 0)}
        />
        <StatCard
          label="Total Transactions"
          value={analytics?.totalActivity.toString() ?? "0"}
        />
        <StatCard
          label="New Customers"
          value={analytics?.newCustomers.toString() ?? "0"}
        />
      </div>

      {/* COMMENT: Display tenant contact and business information */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-white light:text-gray-900">
            Business Information
          </h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-semibold text-slate-400 light:text-gray-600 uppercase">
                Email
              </p>
              <p className="text-sm text-white light:text-gray-900 mt-1">
                {tenant.email}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 light:text-gray-600 uppercase">
                Phone
              </p>
              <p className="text-sm text-white light:text-gray-900 mt-1">
                {tenant.phone}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 light:text-gray-600 uppercase">
                Address
              </p>
              <p className="text-sm text-white light:text-gray-900 mt-1">
                {tenant.address}, {tenant.city}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 light:text-gray-600 uppercase">
                Plan
              </p>
              <p className="text-sm text-white light:text-gray-900 mt-1 capitalize">
                {tenant.plan} Plan
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* COMMENT: Top selling items or services */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-white light:text-gray-900">
            Top Items
          </h3>
        </CardHeader>
        <CardBody>
          <div className="space-y-3">
            {analytics?.topItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-300 light:text-gray-700">
                  {item.name}
                </span>
                <span className="text-sm text-slate-400 light:text-gray-600">
                  {item.count} × {formatCurrency(item.revenue)}
                </span>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* COMMENT: Disable Tenant Modal */}
      {showDisableModal && (
        <div className="fixed inset-0 bg-black/50 light:bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 light:bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-700 light:border-gray-200">
            <h2 className="text-xl font-bold text-white light:text-gray-900 mb-4">
              Disable Tenant Account
            </h2>
            <p className="text-slate-300 light:text-gray-700 mb-4">
              Are you sure you want to disable this tenant account? They will
              not be able to access their dashboard.
            </p>

            {/* COMMENT: Reason for disabling */}
            <textarea
              value={disableReason}
              onChange={(e) => setDisableReason(e.target.value)}
              placeholder="Optional: Enter reason for disabling (payment issues, policy violation, etc.)"
              className="w-full px-3 py-2 rounded-xl bg-slate-800 light:bg-gray-100 border border-slate-700 light:border-gray-300 text-white light:text-gray-900 placeholder:text-slate-500 light:placeholder:text-gray-500 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              rows={3}
            />

            {/* COMMENT: Modal action buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowDisableModal(false)}
                className="flex-1 px-4 py-2 bg-slate-800 light:bg-gray-100 text-white light:text-gray-900 rounded-xl hover:bg-slate-700 light:hover:bg-gray-200 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDisableTenant}
                className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-500 transition-colors font-medium"
              >
                Disable Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMMENT: Delete Tenant Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 light:bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 light:bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-700 light:border-gray-200">
            <h2 className="text-xl font-bold text-red-400 light:text-red-600 mb-4">
              Delete Tenant Account
            </h2>
            <p className="text-slate-300 light:text-gray-700 mb-2 font-semibold">
              ⚠️ This action cannot be undone!
            </p>
            <p className="text-slate-300 light:text-gray-700 mb-4">
              Permanently delete <strong>{tenant.name}</strong> and all
              associated data? This includes all appointments, orders, products,
              customers, and analytics.
            </p>

            {/* COMMENT: Modal action buttons - delete is destructive */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-2 bg-slate-800 light:bg-gray-100 text-white light:text-gray-900 rounded-xl hover:bg-slate-700 light:hover:bg-gray-200 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTenant}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-500 transition-colors font-medium"
              >
                Yes, Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMMENT: Confirmation message when tenant is deleted */}
      {tenantStatus === "deleted" && (
        <div className="fixed inset-0 bg-black/50 light:bg-black/30 flex items-center justify-center z-50">
          <div className="bg-slate-900 light:bg-white rounded-2xl shadow-2xl p-6 border border-slate-700 light:border-gray-200">
            <p className="text-white light:text-gray-900 font-semibold">
              Tenant deleted successfully. Redirecting...
            </p>
          </div>
        </div>
      )}

      {/* COMMENT: Re-enable button if tenant is disabled */}
      {tenantStatus === "disabled" && (
        <div className="flex justify-center pt-4">
          <button
            onClick={handleEnableTenant}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-colors"
          >
            Re-enable Account
          </button>
        </div>
      )}
    </div>
  );
}

// COMMENT: Reusable stat card component for displaying metrics
function StatCard({ label, value }: { label: string; value: string }) {
  return (
    // ENHANCED: Updated with dark theme colors to match admin dashboard
    <div className="bg-slate-800/50 light:bg-white rounded-2xl border border-slate-700 light:border-slate-100 shadow-sm p-6">
      <p className="text-sm font-medium text-slate-400 light:text-slate-500">
        {label}
      </p>
      <p className="text-2xl font-bold text-white light:text-slate-900 mt-1.5">
        {value}
      </p>
    </div>
  );
}
