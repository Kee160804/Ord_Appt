"use client";

import { DollarSign, TrendingUp, Users, ShoppingBag, Calendar, Award } from "lucide-react";
import { StatCard } from "../components/StatCard";
import { Card, CardHeader, CardBody } from "../components/Card";
import { mockAnalytics } from "../data/mock";
import { formatCurrency } from "../lib/utils";
import type { Tenant } from "../types/index";

interface Props { tenant: Tenant }

export function AnalyticsView({ tenant }: Props) {
  const a = mockAnalytics[tenant.id];
  const isAppt = tenant.businessType === "appointment";
  if (!a) return <div className="p-8 text-slate-400">No analytics data available.</div>;

  const maxRev = Math.max(...a.revenueData.map(d => d.revenue));

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Analytics</h2>
        <p className="text-sm text-slate-500">Performance overview — January 2025</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Revenue"   value={formatCurrency(a.totalRevenue)} change={a.revenueChange}
          icon={<DollarSign className="w-5 h-5 text-emerald-600" />} iconBg="bg-emerald-50" />
        {isAppt
          ? <StatCard label="Total Bookings" value={String(a.totalActivity)} change={a.activityChange}
              icon={<Calendar className="w-5 h-5 text-blue-600" />} iconBg="bg-blue-50" />
          : <StatCard label="Total Orders"   value={String(a.totalActivity)} change={a.activityChange}
              icon={<ShoppingBag className="w-5 h-5 text-orange-600" />} iconBg="bg-orange-50" />}
        <StatCard label="New Customers"  value={String(a.newCustomers)}
          icon={<Users className="w-5 h-5 text-violet-600" />} iconBg="bg-violet-50" />
        <StatCard label="Avg. Value"     value={formatCurrency(a.avgOrderValue)}
          icon={<TrendingUp className="w-5 h-5 text-indigo-600" />} iconBg="bg-indigo-50" />
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Bar chart */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <div>
              <h3 className="font-semibold text-slate-900">Daily Revenue</h3>
              <p className="text-xs text-slate-400 mt-0.5">Hover for details</p>
            </div>
          </CardHeader>
          <CardBody>
            <div className="flex items-end gap-1.5 h-52">
              {a.revenueData.map((d, i) => {
                const pct = (d.revenue / maxRev) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-10 hidden group-hover:block">
                      <div className="bg-slate-900 text-white text-xs rounded-xl px-2.5 py-1.5 whitespace-nowrap shadow-xl">
                        <p className="font-bold">{formatCurrency(d.revenue)}</p>
                        <p className="text-slate-400">{d.count} {isAppt ? "bookings" : "orders"}</p>
                      </div>
                    </div>
                    <div
                      className="w-full rounded-t-xl bg-gradient-to-t from-violet-600 to-violet-400
                                 hover:from-violet-700 hover:to-violet-500 cursor-pointer transition-all duration-200"
                      style={{ height: `${Math.max(pct, 4)}%` }}
                    />
                    <span className="text-[9px] text-slate-400">{d.date.split(" ")[1]}</span>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>

        {/* Top items */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              <h3 className="font-semibold text-slate-900">
                {isAppt ? "Top Services" : "Top Products"}
              </h3>
            </div>
          </CardHeader>
          <CardBody className="space-y-5">
            {a.topItems.map((item, i) => {
              const pct = (item.count / a.topItems[0].count) * 100;
              return (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-500 text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {i + 1}
                      </span>
                      <span className="font-medium text-slate-800 truncate">{item.name}</span>
                    </div>
                    <span className="text-slate-400 text-xs ml-2 flex-shrink-0">{item.count}×</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full"
                      style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-right text-slate-500 font-medium">{formatCurrency(item.revenue)}</p>
                </div>
              );
            })}
          </CardBody>
        </Card>
      </div>

      {/* Data table */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-slate-900">Daily Breakdown</h3>
        </CardHeader>
        <div className="divide-y divide-slate-50">
          {a.revenueData.map((d, i) => (
            <div key={i} className="px-6 py-3 flex items-center gap-4">
              <span className="text-sm text-slate-500 w-14 flex-shrink-0">{d.date}</span>
              <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                <div className="h-full bg-slate-800 rounded-full"
                  style={{ width: `${(d.revenue / maxRev) * 100}%` }} />
              </div>
              <span className="text-sm font-bold text-slate-900 w-24 text-right flex-shrink-0">
                {formatCurrency(d.revenue)}
              </span>
              <span className="text-xs text-slate-400 w-20 text-right flex-shrink-0">
                {d.count} {isAppt ? "bookings" : "orders"}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}