"use client";

import { useState } from "react";
import { PaymentFulfillmentView } from "@/app/components/PaymentFulfillmentView";
import { TopBar } from "@/app/components/TopBar";
import { AppointmentsView } from "@/app/components/AppointmentsView";
import { useAuth } from "@/app/contexts/auth";

export default function AppointmentsPage() {
  const { tenant, user } = useAuth();
  const [activeTab, setActiveTab] = useState<"appointments" | "payments">(
    "appointments",
  );
  if (!tenant || !user) return null;

  const canManagePayments =
    user.role === "owner" || user.role === "manager" || user.role === "admin";
  const showingPayments = activeTab === "payments" && canManagePayments;

  return (
    <>
      <TopBar
        title={
          showingPayments ? "Customer Payments & Fulfillment" : "Appointments"
        }
      />

      {canManagePayments && (
        <div className="dashboard-page px-3 pt-3 sm:px-4 sm:pt-4">
          <div
            className="orders-toolbar grid grid-cols-2 rounded-xl border p-1.5"
            role="tablist"
            aria-label="Appointment management sections"
          >
            {(
              [
                ["appointments", "Appointments"],
                ["payments", "Customer Payments & Fulfillment"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={activeTab === value}
                onClick={() => setActiveTab(value)}
                className={`min-h-10 rounded-lg px-3 py-2 text-[11px] font-bold transition-all sm:text-xs ${
                  activeTab === value
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white light:text-slate-600 light:hover:text-gray-900"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {showingPayments ? (
        <PaymentFulfillmentView tenant={tenant} />
      ) : (
        <AppointmentsView tenant={tenant} />
      )}
    </>
  );
}
