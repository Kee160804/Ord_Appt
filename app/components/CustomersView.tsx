"use client";

import { Search } from "lucide-react";
import { Card } from "../components/Card";
import { getAppointmentsByTenant, getOrdersByTenant } from "../data/mock";
import { formatCurrency, formatDate } from "../lib/utils";
import type { Tenant } from "../types/index";

interface Props { tenant: Tenant }

export function CustomersView({ tenant }: Props) {
  const isAppt = tenant.businessType === "appointment";

  // Derive unique customers from appointments or orders
  const customers = isAppt
    ? [...new Map(
        getAppointmentsByTenant(tenant.id).map(a => [
          a.customerEmail,
          { name: a.customerName, email: a.customerEmail, phone: a.customerPhone, lastActivity: a.date, total: a.servicePrice },
        ]),
      ).values()]
    : [...new Map(
        getOrdersByTenant(tenant.id).map(o => [
          o.customerEmail,
          { name: o.customerName, email: o.customerEmail, phone: o.customerPhone, lastActivity: o.createdAt.split("T")[0], total: o.totalAmount },
        ]),
      ).values()];

  return (
    <div className="p-8 space-y-6 bg-[#0a0f1a] light:bg-white min-h-screen text-white light:text-gray-900">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white light:text-gray-900">Customers</h2>
          <p className="text-sm text-slate-400 light:text-gray-600">{customers.length} unique customers</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 light:text-gray-500" />
          <input
            placeholder="Search customers..."
            className="pl-9 pr-4 py-2 text-sm bg-slate-800 light:bg-white border border-slate-700 light:border-gray-200 rounded-xl w-52
                       focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500
                       text-white light:text-gray-900 placeholder:text-slate-500 light:placeholder:text-gray-400"
          />
        </div>
      </div>

      <Card className="bg-slate-800/50 light:bg-white border-slate-700 light:border-gray-200">
        <div className="px-6 py-3 grid grid-cols-4 gap-4 border-b border-slate-700 light:border-slate-100">
          <p className="text-xs font-semibold text-slate-400 light:text-gray-600 uppercase tracking-wider col-span-2">Customer</p>
          <p className="text-xs font-semibold text-slate-400 light:text-gray-600 uppercase tracking-wider">Last Activity</p>
          <p className="text-xs font-semibold text-slate-400 light:text-gray-600 uppercase tracking-wider text-right">Total Spend</p>
        </div>
        <div className="divide-y divide-slate-700 light:divide-slate-100">
          {customers.map((c, i) => (
            <div key={i} className="px-6 py-4 grid grid-cols-4 gap-4 items-center hover:bg-slate-700 light:hover:bg-slate-50 transition-colors">
              <div className="col-span-2 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 light:from-violet-400 light:to-indigo-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {c.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white light:text-gray-900 truncate">{c.name}</p>
                  <p className="text-xs text-slate-400 light:text-gray-600 truncate">{c.email}</p>
                </div>
              </div>
              <p className="text-sm text-slate-300 light:text-gray-700">{formatDate(c.lastActivity)}</p>
              <p className="text-sm font-bold text-white light:text-gray-900 text-right">{formatCurrency(c.total)}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}