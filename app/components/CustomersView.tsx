"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import { Card } from "../components/Card";
import { getAppointmentsByTenant, getOrdersByTenant } from "../data/mock";
import { isSupabaseConfigured } from "../lib/supabase/config";
import { formatCurrency, formatDate } from "../lib/utils";
import { loadDashboardData, type CustomerSummary } from "../services/dashboardService";
import type { Tenant } from "../types/index";

interface Props { tenant: Tenant }

function demoCustomers(tenant: Tenant): CustomerSummary[] {
  const records = tenant.businessType === "appointment"
    ? getAppointmentsByTenant(tenant.id).map((appointment) => ({
        name: appointment.customerName,
        email: appointment.customerEmail,
        phone: appointment.customerPhone,
        date: appointment.date,
        value: appointment.status === "cancelled" ? 0 : appointment.servicePrice,
      }))
    : getOrdersByTenant(tenant.id).map((order) => ({
        name: order.customerName,
        email: order.customerEmail,
        phone: order.customerPhone,
        date: order.createdAt.slice(0, 10),
        value: order.status === "cancelled" ? 0 : order.totalAmount,
      }));
  const grouped = new Map<string, CustomerSummary>();
  for (const record of records) {
    const key = record.email.toLowerCase() || record.phone || record.name.toLowerCase();
    const current = grouped.get(key);
    grouped.set(key, {
      key,
      name: record.name,
      email: record.email,
      phone: record.phone,
      lastActivity: !current || record.date > current.lastActivity ? record.date : current.lastActivity,
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

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let active = true;
    loadDashboardData(tenant)
      .then((data) => {
        if (!active) return;
        setCustomers(data.customers);
        setError("");
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load customers.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tenant]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return customers;
    return customers.filter((customer) =>
      [customer.name, customer.email, customer.phone].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [customers, search]);

  return (
    <div className="min-h-screen space-y-4 bg-[#08111f] light:bg-[#f8fafc] p-4 text-white light:text-[#14213a] md:p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-white light:text-[#17223a]">Customers</h2>
          <p className="mt-0.5 text-[10px] text-slate-400 light:text-[#71809a]">
            {customers.length} unique customer{customers.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 light:text-gray-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search customers..."
            aria-label="Search customers"
            className="h-8 w-52 rounded-lg border border-slate-700 light:border-[#e3e8f0] bg-slate-900/70 light:bg-white pl-9 pr-3 text-[10px] text-white light:text-[#17223a] outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 placeholder:text-slate-500"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300 light:text-red-700">
          {error}
        </div>
      )}
      {isLoading && <p className="text-xs text-slate-400">Loading customers from Supabase...</p>}

      <Card>
        <div className="grid grid-cols-4 gap-4 border-b border-slate-700 light:border-[#e8ecf3] px-5 py-3">
          <p className="text-xs font-semibold text-slate-400 light:text-gray-600 uppercase tracking-wider col-span-2">Customer</p>
          <p className="text-xs font-semibold text-slate-400 light:text-gray-600 uppercase tracking-wider">Last Activity</p>
          <p className="text-xs font-semibold text-slate-400 light:text-gray-600 uppercase tracking-wider text-right">Total Spend</p>
        </div>
        <div className="divide-y divide-slate-700 light:divide-slate-100">
          {!isLoading && filtered.length === 0 && (
            <div className="py-20 text-center text-slate-400 light:text-gray-500">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 light:bg-emerald-50 light:text-emerald-600">
                <Users className="h-5 w-5" />
              </div>
              <p className="text-xs font-bold text-white light:text-[#17223a]">{search ? "No customers match your search." : "No customers yet"}</p>
              {!search && <p className="mx-auto mt-1 max-w-64 text-[10px] leading-4 text-slate-400 light:text-[#71809a]">Add customers to build relationships and grow your business.</p>}
            </div>
          )}
          {filtered.map((customer) => (
            <div key={customer.key} className="grid grid-cols-4 items-center gap-4 px-5 py-3 transition-colors hover:bg-slate-700/60 light:hover:bg-[#fafbfe]">
              <div className="col-span-2 flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {customer.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-white light:text-[#17223a]">{customer.name}</p>
                  <p className="truncate text-[10px] text-slate-400 light:text-[#71809a]">{customer.email || customer.phone || "No contact details"} · {customer.activityCount} {tenant.businessType === "appointment" ? "booking" : "order"}{customer.activityCount === 1 ? "" : "s"}</p>
                </div>
              </div>
              <p className="text-xs text-slate-300 light:text-[#566681]">{formatDate(customer.lastActivity)}</p>
              <p className="text-right text-xs font-bold text-white light:text-[#17223a]">{formatCurrency(customer.totalValue)}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
