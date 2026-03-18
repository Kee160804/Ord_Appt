"use client";

import { DollarSign, Calendar, ShoppingBag, Users, TrendingUp, Clock, ArrowRight } from "lucide-react";
import { StatCard } from "../components/StatCard";
import { Card, CardHeader, CardBody } from "../components/Card";
import { StatusBadge } from "../components/Badge";
import { mockAnalytics, getAppointmentsByTenant, getOrdersByTenant } from "../data/mock";
import { formatCurrency, formatDate, formatTime } from "../lib/utils";
import type { Tenant } from "../types/index";

interface OverviewProps { tenant: Tenant }

export function DashboardOverview({ tenant }: OverviewProps) {
  const analytics = mockAnalytics[tenant.id];
  const isAppt = tenant.businessType === "appointment";
  const appointments = getAppointmentsByTenant(tenant.id).slice(0, 5);
  const orders = getOrdersByTenant(tenant.id).slice(0, 5);
  const maxRev = Math.max(...(analytics?.revenueData.map(d => d.revenue) ?? [1]));

  return (
    <div className="p-8 space-y-6">
      {/* Hero welcome bar */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-white/5 rounded-full" />
        <div className="absolute -right-4 -bottom-10 w-32 h-32 bg-white/5 rounded-full" />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-sm font-medium">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
            <h2 className="text-2xl font-bold mt-1">Welcome back to {tenant.name} 👋</h2>
            <p className="text-slate-400 text-sm mt-1">
              {isAppt
                ? `${appointments.filter(a => a.status === "pending").length} pending appointments need attention`
                : `${orders.filter(o => o.status === "pending").length} new orders waiting`}
            </p>
          </div>
          <div className="hidden md:block text-right">
            <p className="text-slate-400 text-xs uppercase tracking-wider">Month Revenue</p>
            <p className="text-3xl font-black mt-1">{formatCurrency(analytics?.totalRevenue ?? 0)}</p>
            <p className="text-emerald-400 text-sm font-semibold mt-1">
              ↑ {analytics?.revenueChange}% vs last month
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Revenue" value={formatCurrency(analytics?.totalRevenue ?? 0)}
          change={analytics?.revenueChange}
          icon={<DollarSign className="w-5 h-5 text-emerald-600" />} iconBg="bg-emerald-50" />
        {isAppt
          ? <StatCard label="Total Bookings" value={String(analytics?.totalActivity ?? 0)}
              change={analytics?.activityChange}
              icon={<Calendar className="w-5 h-5 text-blue-600" />} iconBg="bg-blue-50" />
          : <StatCard label="Total Orders" value={String(analytics?.totalActivity ?? 0)}
              change={analytics?.activityChange}
              icon={<ShoppingBag className="w-5 h-5 text-orange-600" />} iconBg="bg-orange-50" />}
        <StatCard label="New Customers" value={String(analytics?.newCustomers ?? 0)}
          icon={<Users className="w-5 h-5 text-violet-600" />} iconBg="bg-violet-50" />
        <StatCard label="Avg. Value" value={formatCurrency(analytics?.avgOrderValue ?? 0)}
          icon={<TrendingUp className="w-5 h-5 text-indigo-600" />} iconBg="bg-indigo-50" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Revenue chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <h3 className="font-semibold text-slate-900">Revenue Overview</h3>
              <p className="text-xs text-slate-400 mt-0.5">Last 10 days</p>
            </div>
          </CardHeader>
          <CardBody>
            <div className="flex items-end gap-1.5 h-44">
              {analytics?.revenueData.map((d, i) => {
                const pct = (d.revenue / maxRev) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                    <div
                      className="w-full rounded-t-lg bg-slate-900 group-hover:bg-violet-600 transition-colors cursor-pointer relative"
                      style={{ height: `${Math.max(pct, 4)}%` }}
                    >
                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-10">
                        <div className="bg-slate-900 text-white text-xs rounded-lg px-2 py-1 whitespace-nowrap shadow-lg">
                          {formatCurrency(d.revenue)}
                        </div>
                      </div>
                    </div>
                    <span className="text-[9px] text-slate-400">{d.date.split(" ")[1]}</span>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>

        {/* Top items */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-slate-900">{isAppt ? "Top Services" : "Top Products"}</h3>
          </CardHeader>
          <CardBody className="space-y-4">
            {analytics?.topItems.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                  <p className="text-xs text-slate-400">{item.count}×</p>
                </div>
                <span className="text-sm font-bold text-slate-900">{formatCurrency(item.revenue)}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-slate-900">
            {isAppt ? "Upcoming Appointments" : "Recent Orders"}
          </h3>
          <button className="text-sm text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </CardHeader>
        <div className="divide-y divide-slate-50">
          {isAppt
            ? appointments.map(apt => (
                <div key={apt.id} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-violet-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{apt.customerName}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {apt.serviceName} · {formatDate(apt.date)} at {formatTime(apt.time)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <StatusBadge status={apt.status} />
                    <span className="text-sm font-bold text-slate-900 hidden sm:block">
                      {formatCurrency(apt.servicePrice)}
                    </span>
                  </div>
                </div>
              ))
            : orders.map(order => (
                <div key={order.id} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                    <ShoppingBag className="w-5 h-5 text-orange-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{order.customerName}</p>
                    <p className="text-xs text-slate-500">
                      {order.orderNumber} · {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <StatusBadge status={order.status} />
                    <span className="text-sm font-bold text-slate-900 hidden sm:block">
                      {formatCurrency(order.totalAmount)}
                    </span>
                  </div>
                </div>
              ))}
        </div>
      </Card>
    </div>
  );
}