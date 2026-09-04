"use client";

import { useEffect, useState } from "react";
import {
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  CheckCircle,
  XCircle,
  ChevronRight,
  Download,
  Trash2,
} from "lucide-react";
import { Card } from "./Card";
import { Button } from "./Button";
import { StatusBadge } from "./Badge";
import { Modal } from "./Modal";
import { getAppointmentsByTenant } from "../data/mock";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import { isSupabaseConfigured } from "../lib/supabase/config";
import {
  deleteAppointment,
  assignAppointmentProvider,
  listAppointments,
  setAppointmentStatus,
} from "../services/appointmentService";
import {
  listServiceProviders,
  type ServiceProvider,
} from "../services/businessToolsService";
import { useAuth } from "../contexts/auth";
import {
  formatCurrency,
  formatDate,
  formatTime,
  formatDuration,
  cn,
} from "../lib/utils";
import type { Appointment, AppointmentStatus, Tenant } from "../types/index";

type Filter = "all" | AppointmentStatus;

interface Props {
  tenant: Tenant;
}

export function AppointmentsView({ tenant }: Props) {
  const { user } = useAuth();

  const [apts, setApts] = useState<Appointment[]>(
    isSupabaseConfigured() ? [] : getAppointmentsByTenant(tenant.id),
  );
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured());
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Appointment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [providers, setProviders] = useState<ServiceProvider[]>([]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let active = true;
    const supabase = getSupabaseBrowserClient();

    const load = async () => {
      try {
        const loaded = await listAppointments(tenant.id);
        if (!active) return;
        setApts(loaded);
        setSelected((current) =>
          current
            ? (loaded.find((appointment) => appointment.id === current.id) ??
              null)
            : null,
        );
        setError("");
      } catch (loadError) {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load appointments.",
        );
      } finally {
        if (active) setIsLoading(false);
      }
    };

    if (user?.role === "owner") {
      void listServiceProviders(tenant.id)
        .then((value) => {
          if (active) setProviders(value);
        })
        .catch(() => undefined);
    }

    void load();
    const channel = supabase
      ?.channel(`appointments:${tenant.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `tenant_id=eq.${tenant.id}`,
        },
        () => void load(),
      )
      .subscribe();

    const handleFocus = () => void load();
    window.addEventListener("focus", handleFocus);

    return () => {
      active = false;
      window.removeEventListener("focus", handleFocus);
      if (channel && supabase) void supabase.removeChannel(channel);
    };
  }, [tenant.id, user?.role]);

  const tabs: Filter[] = [
    "all",
    "pending",
    "confirmed",
    "completed",
    "cancelled",
    "no_show",
  ];

  const counts = tabs.reduce<Record<string, number>>((acc, t) => {
    acc[t] =
      t === "all" ? apts.length : apts.filter((a) => a.status === t).length;
    return acc;
  }, {});

  const filtered =
    filter === "all" ? apts : apts.filter((a) => a.status === filter);

  const updateStatus = async (id: string, status: AppointmentStatus) => {
    const appointment = apts.find((candidate) => candidate.id === id);
    if (!appointment) return;

    const updatedAppointment = { ...appointment, status };
    setApts((previous) =>
      previous.map((candidate) =>
        candidate.id === id ? updatedAppointment : candidate,
      ),
    );
    setSelected((prev) => (prev?.id === id ? { ...prev, status } : prev));
    setUpdatingId(id);
    setError("");
    setNotice("");

    try {
      if (isSupabaseConfigured())
        await setAppointmentStatus(tenant.id, id, status);
      setNotice(`Appointment marked ${status.replace("_", "-")}.`);
    } catch (updateError) {
      setApts((previous) =>
        previous.map((candidate) =>
          candidate.id === id ? appointment : candidate,
        ),
      );
      setSelected((current) => (current?.id === id ? appointment : current));
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to update appointment.",
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const removeAppointment = async () => {
    if (!deleteTarget) return;
    const appointment = deleteTarget;
    setIsDeleting(true);
    setError("");
    setNotice("");

    try {
      if (isSupabaseConfigured()) {
        await deleteAppointment(tenant.id, appointment.id);
      }
      setApts((current) =>
        current.filter((candidate) => candidate.id !== appointment.id),
      );
      setSelected((current) =>
        current?.id === appointment.id ? null : current,
      );
      setDeleteTarget(null);
      setNotice(
        `Appointment for ${appointment.customerName} was permanently deleted.`,
      );
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete the appointment.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const today = new Date().toLocaleDateString("en-CA");
  const assignProvider = async (providerId: string) => {
    if (!selected) return;
    setUpdatingId(selected.id);
    setError("");
    try {
      await assignAppointmentProvider(
        tenant.id,
        selected.id,
        providerId || undefined,
      );
      const provider = providers.find((item) => item.id === providerId);
      const next = {
        ...selected,
        providerId: providerId || undefined,
        providerName: provider?.name,
      };
      setSelected(next);
      setApts((current) =>
        current.map((item) => (item.id === next.id ? next : item)),
      );
      setNotice(
        provider
          ? `Appointment assigned to ${provider.name}.`
          : "Provider assignment removed.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to assign provider.",
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const downloadCalendarEvent = (appointment: Appointment) => {
    const start = new Date(`${appointment.date}T${appointment.time}:00`);
    const end = new Date(start.getTime() + appointment.duration * 60_000);
    const localStamp = (value: Date) =>
      [
        value.getFullYear(),
        String(value.getMonth() + 1).padStart(2, "0"),
        String(value.getDate()).padStart(2, "0"),
        "T",
        String(value.getHours()).padStart(2, "0"),
        String(value.getMinutes()).padStart(2, "0"),
        "00",
      ].join("");
    const escape = (value: string) =>
      value
        .replaceAll("\\", "\\\\")
        .replaceAll(";", "\\;")
        .replaceAll(",", "\\,")
        .replaceAll("\n", "\\n");
    const body = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//YuhBusiness//Appointment//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${appointment.id}@yuhbusiness`,
      `DTSTAMP:${new Date()
        .toISOString()
        .replaceAll(/[-:]/g, "")
        .replace(/\.\d{3}Z$/, "Z")}`,
      `DTSTART;TZID=America/Belize:${localStamp(start)}`,
      `DTEND;TZID=America/Belize:${localStamp(end)}`,
      `SUMMARY:${escape(`${appointment.serviceName} at ${tenant.name}`)}`,
      `DESCRIPTION:${escape(`Customer: ${appointment.customerName}${appointment.providerName ? `; Provider: ${appointment.providerName}` : ""}`)}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob([body], { type: "text/calendar;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${tenant.slug}-${appointment.date}.ics`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-full space-y-4 bg-[#08111f] light:bg-[#f8fafc] p-4 text-white light:text-[#14213a] md:p-5">
      {/* Summary chips */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Today",
            value: apts.filter((a) => a.date === today).length,
            bg: "bg-blue-500/10 light:bg-blue-50 border-blue-400/20 light:border-blue-100",
            text: "text-blue-400 light:text-blue-700",
          },
          {
            label: "Pending",
            value: counts.pending,
            bg: "bg-amber-500/10 light:bg-amber-50 border-amber-400/20 light:border-amber-100",
            text: "text-amber-400 light:text-amber-700",
          },
          {
            label: "Confirmed",
            value: counts.confirmed,
            bg: "bg-green-500/10 light:bg-emerald-50 border-green-400/20 light:border-emerald-100",
            text: "text-green-400 light:text-green-700",
          },
          {
            label: "Completed",
            value: counts.completed,
            bg: "bg-slate-700/40 light:bg-slate-50 border-slate-600/40 light:border-slate-200",
            text: "text-slate-300 light:text-slate-700",
          },
        ].map((s) => (
          <div key={s.label} className={cn("rounded-xl border p-3.5", s.bg)}>
            <p className="text-[10px] font-medium text-slate-400 light:text-[#61708a]">
              {s.label}
            </p>
            <p className={cn("mt-1 text-xl font-black", s.text)}>{s.value}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300 light:text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300 light:text-emerald-700">
          {notice}
        </div>
      )}
      {isLoading && (
        <p className="text-xs text-slate-400 light:text-slate-500">
          Loading appointments from Supabase...
        </p>
      )}

      {/* Filter tabs */}
      <div className="flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-slate-700/60 light:border-[#e5e9f1] bg-slate-900/70 light:bg-white p-1">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={cn(
              "whitespace-nowrap rounded-md px-3 py-1.5 text-[10px] font-medium capitalize transition-all",
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
      <Card>
        <div className="divide-y divide-slate-700 light:divide-slate-100">
          {filtered.length === 0 && (
            <div className="py-20 text-center text-slate-400 light:text-gray-500">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-violet-500/15 text-violet-400 light:bg-violet-50 light:text-violet-600">
                <Calendar className="h-5 w-5" />
              </div>
              <p className="text-xs font-semibold text-white light:text-[#17223a]">
                No appointments found
              </p>
            </div>
          )}
          {filtered.map((apt) => (
            <button
              key={apt.id}
              onClick={() => setSelected(apt)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-800/70 light:hover:bg-[#fafbfe]"
            >
              {/* Date badge */}
              <div className="flex h-10 w-10 flex-shrink-0 flex-col items-center justify-center rounded-lg bg-violet-500/20 light:bg-violet-50">
                <span className="text-xs font-bold text-violet-400 light:text-violet-700 leading-none">
                  {apt.date.split("-")[2]}
                </span>
                <span className="text-[10px] text-violet-400 light:text-violet-500 uppercase">
                  {new Date(`${apt.date}T12:00:00`).toLocaleDateString(
                    "en-BZ",
                    {
                      month: "short",
                    },
                  )}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-white light:text-[#17223a]">
                    {apt.customerName}
                  </p>
                  <StatusBadge status={apt.status} />
                </div>
                <p className="mt-1 truncate text-[10px] text-slate-400 light:text-[#71809a]">
                  {apt.serviceName} · {formatTime(apt.time)}
                  {apt.providerName ? ` · ${apt.providerName}` : ""} ·{" "}
                  {formatDuration(apt.duration)}
                </p>
              </div>
              <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
                <div className="text-right">
                  <p className="text-xs font-bold text-white light:text-[#17223a]">
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
                disabled={updatingId === selected.id}
                onClick={() => updateStatus(selected!.id, "cancelled")}
              >
                <XCircle className="w-4 h-4" /> Cancel
              </Button>
              <Button
                variant="success"
                className="flex-1"
                disabled={updatingId === selected.id}
                onClick={() => updateStatus(selected!.id, "confirmed")}
              >
                <CheckCircle className="w-4 h-4" /> Confirm
              </Button>
            </div>
          ) : selected?.status === "confirmed" ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Button
                variant="danger"
                disabled={updatingId === selected.id}
                onClick={() => updateStatus(selected.id, "cancelled")}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                disabled={updatingId === selected.id}
                onClick={() => updateStatus(selected.id, "no_show")}
              >
                No-show
              </Button>
              <Button
                variant="success"
                disabled={updatingId === selected.id}
                onClick={() => updateStatus(selected.id, "completed")}
              >
                Complete
              </Button>
            </div>
          ) : selected &&
            ["completed", "cancelled", "no_show"].includes(selected.status) ? (
            <Button
              variant="danger"
              className="w-full"
              onClick={() => setDeleteTarget(selected)}
            >
              <Trash2 className="h-4 w-4" /> Delete Appointment
            </Button>
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
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-center"
                onClick={() => downloadCalendarEvent(selected)}
              >
                <Download className="h-3.5 w-3.5" /> Add to calendar (.ics)
              </Button>
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

            {user?.role === "owner" &&
              providers.some((provider) =>
                provider.serviceIds.includes(selected.serviceId),
              ) && (
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400 light:text-gray-500">
                    Service Provider
                  </label>
                  <select
                    value={selected.providerId ?? ""}
                    disabled={updatingId === selected.id}
                    onChange={(event) =>
                      void assignProvider(event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm light:border-slate-200 light:bg-white"
                  >
                    <option value="">Unassigned</option>
                    {providers
                      .filter(
                        (provider) =>
                          provider.isActive &&
                          provider.serviceIds.includes(selected.serviceId),
                      )
                      .map((provider) => (
                        <option key={provider.id} value={provider.id}>
                          {provider.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

            <div className="bg-slate-800 light:bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400 light:text-gray-600">
                  Payment Status
                </span>
                <StatusBadge status={selected.paymentStatus} />
              </div>
              {selected.depositPaid && (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-400 light:text-gray-600">
                      Deposit Paid
                    </span>
                    <span className="font-semibold text-white light:text-gray-900">
                      {formatCurrency(selected.depositPaid)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 light:text-gray-600">
                      Remaining
                    </span>
                    <span className="font-semibold text-amber-400 light:text-amber-700">
                      {formatCurrency(
                        selected.servicePrice - selected.depositPaid,
                      )}
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

      <Modal
        open={!!deleteTarget}
        onClose={() => !isDeleting && setDeleteTarget(null)}
        title="Delete appointment?"
        footer={
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              disabled={isDeleting}
              onClick={() => setDeleteTarget(null)}
            >
              Keep Appointment
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              loading={isDeleting}
              onClick={removeAppointment}
            >
              Delete Permanently
            </Button>
          </div>
        }
      >
        <p className="text-sm leading-6 text-slate-300 light:text-slate-700">
          This permanently removes the appointment for{" "}
          {deleteTarget?.customerName}, including its service and email-delivery
          records. This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
