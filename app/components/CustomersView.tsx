"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Download,
  DollarSign,
  History,
  Search,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Input, Textarea } from "../components/input";
import { Modal } from "../components/Modal";
import { getAppointmentsByTenant, getOrdersByTenant } from "../data/mock";
import { isSupabaseConfigured } from "../lib/supabase/config";
import { formatCurrency, formatDate } from "../lib/utils";
import {
  loadDashboardData,
  type CustomerSummary,
} from "../services/dashboardService";
import {
  createCustomer,
  listCustomers,
  setCustomerActive,
  updateCustomer,
  type CustomerRecord,
} from "../services/customerService";
import type { Tenant } from "../types/index";

interface Props {
  tenant: Tenant;
}

function demoCustomers(tenant: Tenant): CustomerSummary[] {
  const records =
    tenant.businessType === "appointment"
      ? getAppointmentsByTenant(tenant.id).map((appointment) => ({
          name: appointment.customerName,
          email: appointment.customerEmail,
          phone: appointment.customerPhone,
          date: appointment.date,
          value:
            appointment.status === "completed" ? appointment.servicePrice : 0,
        }))
      : getOrdersByTenant(tenant.id).map((order) => ({
          name: order.customerName,
          email: order.customerEmail,
          phone: order.customerPhone,
          date: order.createdAt.slice(0, 10),
          value: order.status === "delivered" ? order.totalAmount : 0,
        }));
  const grouped = new Map<string, CustomerSummary>();
  for (const record of records) {
    const key =
      record.email.toLowerCase() || record.phone || record.name.toLowerCase();
    const current = grouped.get(key);
    grouped.set(key, {
      key,
      name: record.name,
      email: record.email,
      phone: record.phone,
      lastActivity:
        !current || record.date > current.lastActivity
          ? record.date
          : current.lastActivity,
      activityCount: (current?.activityCount ?? 0) + 1,
      totalValue: (current?.totalValue ?? 0) + record.value,
    });
  }
  return [...grouped.values()];
}

export function CustomersView({ tenant }: Props) {
  const [customers, setCustomers] = useState<CustomerSummary[]>(
    isSupabaseConfigured() ? [] : demoCustomers(tenant),
  );
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured());
  const [error, setError] = useState("");
  const [records, setRecords] = useState<CustomerRecord[]>([]);
  const [editing, setEditing] = useState<CustomerRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [historyCustomer, setHistoryCustomer] =
    useState<CustomerSummary | null>(null);
  const [activities, setActivities] = useState<
    {
      customerId?: string;
      contact: string;
      label: string;
      date: string;
      value: number;
      status: string;
    }[]
  >([]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let active = true;
    Promise.all([loadDashboardData(tenant), listCustomers(tenant.id)])
      .then(([data, loadedCustomers]) => {
        if (!active) return;
        setRecords(loadedCustomers);
        setActivities(
          tenant.businessType === "appointment"
            ? data.appointments.map((item) => ({
                customerId: item.customerId,
                contact: item.customerEmail.toLowerCase() || item.customerPhone,
                label: item.serviceName,
                date: item.date,
                value: item.servicePrice,
                status: item.status,
              }))
            : data.orders.map((item) => ({
                customerId: item.customerId,
                contact: item.customerEmail.toLowerCase() || item.customerPhone,
                label: item.orderNumber,
                date: item.createdAt,
                value: item.totalAmount,
                status: item.status,
              })),
        );
        const activityByContact = new Map(
          data.customers.map((customer) => [
            customer.email.toLowerCase() || customer.phone,
            customer,
          ]),
        );
        setCustomers(
          loadedCustomers.map((customer) => {
            const activity = activityByContact.get(
              customer.email.toLowerCase() || customer.phone,
            );
            return {
              id: customer.id,
              isActive: customer.isActive,
              key: customer.id,
              name: customer.name,
              email: customer.email,
              phone: customer.phone,
              lastActivity:
                activity?.lastActivity ?? customer.createdAt.slice(0, 10),
              activityCount: activity?.activityCount ?? 0,
              totalValue: activity?.totalValue ?? 0,
            };
          }),
        );
        setError("");
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load customers.",
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tenant]);

  const saveCustomer = async () => {
    if (!editing) return;
    setIsSaving(true);
    setError("");
    try {
      const updated = editing.id
        ? await updateCustomer(tenant.id, editing.id, editing)
        : await createCustomer(tenant.id, editing);
      setRecords((current) =>
        editing.id
          ? current.map((customer) =>
              customer.id === updated.id ? updated : customer,
            )
          : [updated, ...current],
      );
      setCustomers((current) =>
        editing.id
          ? current.map((customer) =>
              customer.id === updated.id
                ? {
                    ...customer,
                    name: updated.name,
                    email: updated.email,
                    phone: updated.phone,
                  }
                : customer,
            )
          : [
              {
                id: updated.id,
                isActive: true,
                key: updated.id,
                name: updated.name,
                email: updated.email,
                phone: updated.phone,
                lastActivity: updated.createdAt.slice(0, 10),
                activityCount: 0,
                totalValue: 0,
              },
              ...current,
            ],
      );
      setEditing(null);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to update customer.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCustomer = async (customer: CustomerSummary) => {
    if (!customer.id) return;
    const record = records.find((candidate) => candidate.id === customer.id);
    if (!record) return;
    try {
      await setCustomerActive(tenant.id, record.id, !record.isActive);
      setRecords((current) =>
        current.map((candidate) =>
          candidate.id === record.id
            ? { ...candidate, isActive: !candidate.isActive }
            : candidate,
        ),
      );
      setCustomers((current) =>
        current.map((candidate) =>
          candidate.id === record.id
            ? { ...candidate, isActive: !record.isActive }
            : candidate,
        ),
      );
      setEditing((current) =>
        current?.id === record.id
          ? { ...current, isActive: !record.isActive }
          : current,
      );
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "Unable to update customer.",
      );
    }
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return customers;
    return customers.filter((customer) =>
      [customer.name, customer.email, customer.phone].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [customers, search]);

  const returningCustomers = customers.filter(
    (customer) => customer.activityCount > 1,
  ).length;
  const lifetimeValue = customers.reduce(
    (sum, customer) => sum + customer.totalValue,
    0,
  );
  const averageValue = customers.length ? lifetimeValue / customers.length : 0;
  const selectedActivities = historyCustomer
    ? activities.filter(
        (activity) =>
          activity.customerId === historyCustomer.id ||
          activity.contact ===
            (historyCustomer.email.toLowerCase() || historyCustomer.phone),
      )
    : [];

  const exportCustomers = () => {
    const escape = (value: string | number | boolean) =>
      `"${String(value).replaceAll('"', '""')}"`;
    const rows = [
      [
        "Name",
        "Email",
        "Phone",
        "Notes",
        "Active",
        "Last activity",
        "Activity count",
        "Lifetime value",
      ],
      ...customers.map((customer) => {
        const record = records.find(
          (candidate) => candidate.id === customer.id,
        );
        return [
          customer.name,
          customer.email,
          customer.phone,
          record?.notes ?? "",
          customer.isActive !== false,
          customer.lastActivity,
          customer.activityCount,
          customer.totalValue,
        ];
      }),
    ];
    const blob = new Blob(
      [rows.map((row) => row.map(escape).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${tenant.slug}-customers.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-full space-y-4 bg-[#08111f] light:bg-[#f8fafc] p-4 text-white light:text-[#14213a] md:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-bold text-white light:text-[#17223a]">
            Customers
          </h2>
          <p className="mt-0.5 text-[10px] text-slate-400 light:text-[#71809a]">
            {customers.length} unique customer
            {customers.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            disabled={!customers.length}
            onClick={exportCustomers}
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
          {isSupabaseConfigured() && (
            <Button
              className="bg-violet-600 text-white"
              onClick={() =>
                setEditing({
                  id: "",
                  name: "",
                  email: "",
                  phone: "",
                  notes: "",
                  isActive: true,
                  createdAt: new Date().toISOString(),
                })
              }
            >
              Add Customer
            </Button>
          )}
          <div className="relative min-w-0 flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 light:text-gray-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search customers..."
              aria-label="Search customers"
              className="h-8 w-full rounded-lg border border-slate-700 light:border-[#e3e8f0] bg-slate-900/70 light:bg-white pl-9 pr-3 text-[10px] text-white light:text-[#17223a] outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 placeholder:text-slate-500 sm:w-52"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300 light:text-red-700">
          {error}
        </div>
      )}
      {isLoading && (
        <p className="text-xs text-slate-400">
          Loading customers from Supabase...
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            label: "Returning Customers",
            value: String(returningCustomers),
            icon: UserRoundCheck,
          },
          {
            label: "Customer Lifetime Value",
            value: formatCurrency(lifetimeValue),
            icon: DollarSign,
          },
          {
            label: "Average Customer Value",
            value: formatCurrency(averageValue),
            icon: Users,
          },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="p-4">
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-violet-500/15 p-2 text-violet-400">
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[10px] text-slate-400">{label}</p>
                <p className="mt-1 text-sm font-bold">{value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="overflow-x-auto">
        <div className="grid min-w-[600px] grid-cols-4 gap-4 border-b border-slate-700 light:border-[#e8ecf3] px-5 py-3">
          <p className="text-xs font-semibold text-slate-400 light:text-gray-600 uppercase tracking-wider col-span-2">
            Customer
          </p>
          <p className="text-xs font-semibold text-slate-400 light:text-gray-600 uppercase tracking-wider">
            Last Activity
          </p>
          <p className="text-xs font-semibold text-slate-400 light:text-gray-600 uppercase tracking-wider text-right">
            Total Spend
          </p>
        </div>
        <div className="divide-y divide-slate-700 light:divide-slate-100">
          {!isLoading && filtered.length === 0 && (
            <div className="py-20 text-center text-slate-400 light:text-gray-500">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 light:bg-emerald-50 light:text-emerald-600">
                <Users className="h-5 w-5" />
              </div>
              <p className="text-xs font-bold text-white light:text-[#17223a]">
                {search
                  ? "No customers match your search."
                  : "No customers yet"}
              </p>
              {!search && (
                <p className="mx-auto mt-1 max-w-64 text-[10px] leading-4 text-slate-400 light:text-[#71809a]">
                  Add customers to build relationships and grow your business.
                </p>
              )}
            </div>
          )}
          {filtered.map((customer) => (
            <div
              key={customer.key}
              className="grid min-w-[600px] grid-cols-4 items-center gap-4 px-5 py-3 transition-colors hover:bg-slate-700/60 light:hover:bg-[#fafbfe]"
            >
              <div className="col-span-2 flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {customer.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-xs font-semibold text-white light:text-[#17223a]">
                      {customer.name}
                    </p>
                    {customer.activityCount > 1 && (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-semibold text-emerald-400">
                        Returning
                      </span>
                    )}
                    {customer.isActive === false && (
                      <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[9px] text-slate-300 light:bg-slate-100 light:text-slate-500">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="truncate text-[10px] text-slate-400 light:text-[#71809a]">
                    {customer.email || customer.phone || "No contact details"} ·{" "}
                    {customer.activityCount}{" "}
                    {tenant.businessType === "appointment"
                      ? "booking"
                      : "order"}
                    {customer.activityCount === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-300 light:text-[#566681]">
                {formatDate(customer.lastActivity)}
              </p>
              <div className="flex items-center justify-end gap-2">
                <p className="text-right text-xs font-bold text-white light:text-[#17223a]">
                  {formatCurrency(customer.totalValue)}
                </p>
                <button
                  className="text-violet-400"
                  title="View customer history"
                  aria-label={`View ${customer.name} history`}
                  onClick={() => setHistoryCustomer(customer)}
                >
                  <History className="h-4 w-4" />
                </button>
                {customer.id && (
                  <button
                    className="text-[10px] text-violet-400"
                    onClick={() => {
                      const record = records.find(
                        (candidate) => candidate.id === customer.id,
                      );
                      if (record) setEditing(record);
                    }}
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Edit Customer" : "Add Customer"}
        footer={
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setEditing(null)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-violet-600 text-white"
              disabled={isSaving}
              onClick={saveCustomer}
            >
              {isSaving ? "Saving..." : "Save Customer"}
            </Button>
          </div>
        }
      >
        {editing && (
          <div className="space-y-3">
            <Input
              label="Name"
              value={editing.name}
              onChange={(event) =>
                setEditing({ ...editing, name: event.target.value })
              }
            />
            <Input
              label="Email"
              type="email"
              value={editing.email}
              onChange={(event) =>
                setEditing({ ...editing, email: event.target.value })
              }
            />
            <Input
              label="Phone"
              value={editing.phone}
              onChange={(event) =>
                setEditing({ ...editing, phone: event.target.value })
              }
            />
            <Textarea
              label="Notes"
              value={editing.notes}
              onChange={(event) =>
                setEditing({ ...editing, notes: event.target.value })
              }
            />
            {editing.id && (
              <Button
                variant="outline"
                onClick={() =>
                  void toggleCustomer({
                    id: editing.id,
                    key: editing.id,
                    name: editing.name,
                    email: editing.email,
                    phone: editing.phone,
                    lastActivity: editing.createdAt,
                    activityCount: 0,
                    totalValue: 0,
                  })
                }
              >
                {editing.isActive
                  ? "Deactivate Customer"
                  : "Reactivate Customer"}
              </Button>
            )}
          </div>
        )}
      </Modal>
      <Modal
        open={!!historyCustomer}
        onClose={() => setHistoryCustomer(null)}
        title={`${historyCustomer?.name ?? "Customer"} history`}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-violet-500/10 p-4">
            <div>
              <p className="text-[10px] text-slate-400">Visits / Orders</p>
              <p className="text-lg font-bold">
                {historyCustomer?.activityCount ?? 0}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400">Total spending</p>
              <p className="text-lg font-bold">
                {formatCurrency(historyCustomer?.totalValue ?? 0)}
              </p>
            </div>
          </div>
          {selectedActivities.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">
              No transaction history yet.
            </p>
          ) : (
            selectedActivities
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((activity, index) => (
                <div
                  key={`${activity.date}-${index}`}
                  className="flex items-center justify-between rounded-xl border border-slate-700 p-3 light:border-slate-200"
                >
                  <div>
                    <p className="text-xs font-semibold">{activity.label}</p>
                    <p className="mt-1 text-[10px] capitalize text-slate-400">
                      {formatDate(activity.date)} ·{" "}
                      {activity.status.replace("_", " ")}
                    </p>
                  </div>
                  <p className="text-xs font-bold">
                    {formatCurrency(activity.value)}
                  </p>
                </div>
              ))
          )}
        </div>
      </Modal>
    </div>
  );
}
