"use client";

import { useState } from "react";
import {
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  CheckCircle,
  XCircle,
  ChevronRight,
} from "lucide-react";
import { Card } from "./Card";
import { Button } from "./Button";
import { StatusBadge } from "./Badge";
import { Modal } from "./Modal";
import { getAppointmentsByTenant } from "../data/mock";
import {
  formatCurrency,
  formatDate,
  formatTime,
  formatDuration,
  cn,
} from "../lib/utils";
// NEW: Import useRealtime for emitting appointment events
import { useRealtime } from "../contexts/realtime";
import type { Appointment, AppointmentStatus, Tenant } from "../types/index";

type Filter = "all" | AppointmentStatus;

interface Props {
  tenant: Tenant;
}

export function AppointmentsView({ tenant }: Props) {
  // NEW: Get realtime context to emit appointment events
  const realtime = useRealtime();
  
  const [apts, setApts] = useState<Appointment[]>(
    getAppointmentsByTenant(tenant.id),
  );
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Appointment | null>(null);

  const tabs: Filter[] = [
    "all",
    "pending",
    "confirmed",
    "completed",
    "cancelled",
  ];

  const counts = tabs.reduce<Record<string, number>>((acc, t) => {
    acc[t] =
      t === "all" ? apts.length : apts.filter((a) => a.status === t).length;
    return acc;
  }, {});

  const filtered =
    filter === "all" ? apts : apts.filter((a) => a.status === filter);

  // ENHANCED: Emit real-time event when appointment status changes
  const updateStatus = (id: string, status: AppointmentStatus) => {
    setApts((prev) => {
      const updated = prev.map((a) => (a.id === id ? { ...a, status } : a));
      
      // NEW: Emit real-time event for appointment updated
      const updatedApt = updated.find(a => a.id === id);
      if (updatedApt) {
        realtime.addEvent({
          type: "appointment_updated",
          tenantId: tenant.id,
          appointment: updatedApt,
        });
      }
      
      return updated;
    });
    setSelected((prev) => (prev?.id === id ? { ...prev, status } : prev));
  };

  return (
    <div className="p-8 space-y-6 bg-[#0a0f1a] light:bg-white text-white light:text-gray-900 min-h-screen">
      {/* Summary chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: "Today",
            value: apts.filter((a) => a.date === "2025-01-13").length,
            bg: "bg-blue-500/20 light:bg-blue-100",
            text: "text-blue-400 light:text-blue-700",
          },
          {
            label: "Pending",
            value: counts.pending,
            bg: "bg-amber-500/20 light:bg-amber-100",
            text: "text-amber-400 light:text-amber-700",
          },
          {
            label: "Confirmed",
            value: counts.confirmed,
            bg: "bg-green-500/20 light:bg-green-100",
            text: "text-green-400 light:text-green-700",
          },
          {
            label: "Completed",
            value: counts.completed,
            bg: "bg-slate-700/50 light:bg-slate-100",
            text: "text-slate-300 light:text-slate-700",
          },
        ].map((s) => (
          <div
            key={s.label}
            className={cn("rounded-2xl p-4", s.bg)}
          >
            <p className="text-xs font-medium text-slate-400 light:text-gray-600">{s.label}</p>
            <p className={cn("text-3xl font-black mt-1", s.text)}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 bg-slate-800 light:bg-gray-100 p-1 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all",
              filter === tab
                ? "bg-violet-600 light:bg-white text-white light:text-gray-900 shadow-sm"
                : "text-slate-400 light:text-gray-600 hover:text-white light:hover:text-gray-900",
            )}
          >
            {tab}{" "}
            <span className="text-slate-500 light:text-gray-500 text-xs ml-0.5">
              ({counts[tab]})
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      <Card className="bg-slate-800/50 light:bg-white border-slate-700 light:border-gray-200">
        <div className="divide-y divide-slate-700 light:divide-slate-100">
          {filtered.length === 0 && (
            <div className="py-16 text-center text-slate-400 light:text-gray-500">
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No appointments found</p>
            </div>
          )}
          {filtered.map((apt) => (
            <button
              key={apt.id}
              onClick={() => setSelected(apt)}
              className="w-full px-6 py-4 flex items-center gap-4 hover:bg-slate-700 light:hover:bg-gray-50 transition-colors text-left"
            >
              {/* Date badge */}
              <div className="w-11 h-11 rounded-xl bg-violet-500/20 light:bg-violet-100 flex flex-col items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-violet-400 light:text-violet-700 leading-none">
                  {apt.date.split("-")[2]}
                </span>
                <span className="text-[10px] text-violet-400 light:text-violet-500 uppercase">
                  {new Date(apt.date).toLocaleDateString("en-US", {
                    month: "short",
                  })}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white light:text-gray-900">
                    {apt.customerName}
                  </p>
                  <StatusBadge status={apt.status} />
                </div>
                <p className="text-xs text-slate-400 light:text-gray-600 mt-0.5 truncate">
                  {apt.serviceName} · {formatTime(apt.time)} ·{" "}
                  {formatDuration(apt.duration)}
                </p>
              </div>
              <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
                <div className="text-right">
                  <p className="text-sm font-bold text-white light:text-gray-900">
                    {formatCurrency(apt.servicePrice)}
                  </p>
                  <StatusBadge status={apt.paymentStatus} />
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 light:text-gray-400 flex-shrink-0" />
            </button>
          ))}
        </div>
      </Card>

      {/* Detail modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Appointment Details"
        footer={
          selected?.status === "pending" ? (
            <div className="flex gap-3">
              <Button
                variant="danger"
                className="flex-1"
                onClick={() => updateStatus(selected!.id, "cancelled")}
              >
                <XCircle className="w-4 h-4" /> Cancel
              </Button>
              <Button
                variant="success"
                className="flex-1"
                onClick={() => updateStatus(selected!.id, "confirmed")}
              >
                <CheckCircle className="w-4 h-4" /> Confirm
              </Button>
            </div>
          ) : undefined
        }
      >
        {selected && (
          <div className="space-y-4 text-white light:text-gray-900">
            <div className="bg-violet-500/20 light:bg-violet-50 rounded-xl p-4 space-y-2">
              <h4 className="font-bold text-violet-400 light:text-violet-900 text-base">
                {selected.serviceName}
              </h4>
              <div className="flex items-center gap-4 text-sm text-violet-300 light:text-violet-700">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDate(selected.date)}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {formatTime(selected.time)}
                </span>
                <span>{formatDuration(selected.duration)}</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <StatusBadge status={selected.status} />
                <span className="text-lg font-black text-violet-400 light:text-violet-900">
                  {formatCurrency(selected.servicePrice)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 light:text-gray-500 uppercase tracking-wider">
                Customer
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2.5">
                  <User className="w-4 h-4 text-slate-400 light:text-gray-500" />
                  <span className="font-medium">{selected.customerName}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-slate-400 light:text-gray-500" />
                  <span className="text-slate-300 light:text-gray-700">
                    {selected.customerEmail}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-slate-400 light:text-gray-500" />
                  <span className="text-slate-300 light:text-gray-700">
                    {selected.customerPhone}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-slate-800 light:bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400 light:text-gray-600">Payment Status</span>
                <StatusBadge status={selected.paymentStatus} />
              </div>
              {selected.depositPaid && (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-400 light:text-gray-600">Deposit Paid</span>
                    <span className="font-semibold text-white light:text-gray-900">
                      {formatCurrency(selected.depositPaid)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 light:text-gray-600">Remaining</span>
                    <span className="font-semibold text-amber-400 light:text-amber-700">
                      {formatCurrency(selected.servicePrice - selected.depositPaid)}
                    </span>
                  </div>
                </>
              )}
            </div>

            {selected.notes && (
              <div className="bg-amber-500/20 light:bg-amber-50 text-amber-400 light:text-amber-800 rounded-xl p-3 text-sm">
                <span className="font-semibold">Note: </span>
                {selected.notes}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}