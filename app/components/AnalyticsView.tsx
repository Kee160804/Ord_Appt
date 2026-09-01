"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Award, BarChart3, Calendar, DollarSign, ShoppingBag, TrendingUp, Users } from "lucide-react";
import { StatCard } from "../components/StatCard";
import { Card, CardHeader, CardBody } from "../components/Card";
import { mockAnalytics } from "../data/mock";
import { isSupabaseConfigured } from "../lib/supabase/config";
import { formatCurrency } from "../lib/utils";
import { loadDashboardData } from "../services/dashboardService";
import type { AnalyticsSummary, Tenant } from "../types/index";

interface Props { tenant: Tenant }

const EMPTY_ANALYTICS: AnalyticsSummary = {
  totalRevenue: 0,
  totalActivity: 0,
  newCustomers: 0,
  avgOrderValue: 0,
  revenueChange: 0,
  activityChange: 0,
  topItems: [],
  revenueData: [],
};

export function AnalyticsView({ tenant }: Props) {
  const [analytics, setAnalytics] = useState<AnalyticsSummary>(
    isSupabaseConfigured() ? EMPTY_ANALYTICS : mockAnalytics[tenant.id] ?? EMPTY_ANALYTICS,
  );
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured());
  const [error, setError] = useState("");
  const isAppt = tenant.businessType === "appointment";

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let active = true;
    loadDashboardData(tenant)
      .then((data) => {
        if (!active) return;
        setAnalytics(data.analytics);
        setError("");
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load analytics.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tenant]);

  const maxRevenue = Math.max(1, ...analytics.revenueData.map((point) => point.revenue));

  if (!isLoading && !error && analytics.totalRevenue === 0) {
    return (
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center bg-[#08111f] light:bg-[#f8fafc] p-6 text-center">
        <div className="flex max-w-sm flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-500/15 text-violet-400 light:bg-violet-50 light:text-violet-600">
            <BarChart3 className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-sm font-bold text-white light:text-[#17223a]">No analytics data available</h2>
          <p className="mt-2 text-[11px] leading-5 text-slate-400 light:text-[#71809a]">
            Start making bookings and completing appointments to see your analytics here.
          </p>
          <Link href="/dashboard" className="mt-5 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-violet-700">
            View Overview
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full space-y-4 bg-[#08111f] light:bg-[#f8fafc] p-4 text-white light:text-[#14213a] md:p-5">
      <div>
        <h2 className="text-sm font-bold text-white light:text-[#17223a]">Analytics</h2>
        <p className="mt-0.5 text-[10px] text-slate-400 light:text-[#71809a]">
          Live performance from your Supabase {isAppt ? "appointments" : "orders"}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300 light:text-red-700">
          {error}
        </div>
      )}
      {isLoading && <p className="text-xs text-slate-400">Calculating analytics...</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={isAppt ? "Completed Value" : "Delivered Value"}
          value={formatCurrency(analytics.totalRevenue)}
          icon={<DollarSign className="w-5 h-5 text-emerald-600" />}
          iconBg="bg-emerald-50"
        />
        <StatCard
          label={isAppt ? "Total Bookings" : "Total Orders"}
          value={String(analytics.totalActivity)}
          icon={isAppt
            ? <Calendar className="w-5 h-5 text-blue-600" />
            : <ShoppingBag className="w-5 h-5 text-orange-600" />}
          iconBg={isAppt ? "bg-blue-50" : "bg-orange-50"}
        />
        <StatCard
          label="Unique Customers"
          value={String(analytics.newCustomers)}
          icon={<Users className="w-5 h-5 text-violet-600" />}
          iconBg="bg-violet-50"
        />
        <StatCard
          label="Average Value"
          value={formatCurrency(analytics.avgOrderValue)}
          icon={<TrendingUp className="w-5 h-5 text-indigo-600" />}
          iconBg="bg-indigo-50"
        />
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3">
          <CardHeader>
            <div>
              <h3 className="text-xs font-bold text-white light:text-[#17223a]">Last 10 Days</h3>
              <p className="text-xs text-slate-400 light:text-gray-600 mt-0.5">
                Completed value and activity
              </p>
            </div>
          </CardHeader>
          <CardBody>
            {analytics.revenueData.length === 0 ? (
              <p className="py-16 text-center text-sm text-slate-400">No activity yet.</p>
            ) : (
              <div className="flex items-end gap-1.5 h-52">
                {analytics.revenueData.map((point) => {
                  const percentage = (point.revenue / maxRevenue) * 100;
                  return (
                    <div key={point.date} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-10 hidden group-hover:block">
                        <div className="bg-slate-950 light:bg-white text-white light:text-slate-900 text-xs rounded-xl px-2.5 py-1.5 whitespace-nowrap shadow-xl light:border light:border-gray-200">
                          <p className="font-bold">{formatCurrency(point.revenue)}</p>
                          <p className="text-slate-400">{point.count} {isAppt ? "bookings" : "orders"}</p>
                        </div>
                      </div>
                      <div
                        className="w-full rounded-t-xl bg-gradient-to-t from-violet-600 to-violet-400 transition-all duration-200"
                        style={{ height: `${Math.max(percentage, point.count ? 6 : 2)}%` }}
                      />
                      <span className="text-[9px] text-slate-400">{point.date.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold text-white light:text-[#17223a]">
                {isAppt ? "Top Services" : "Top Products"}
              </h3>
            </div>
          </CardHeader>
          <CardBody className="space-y-5">
            {analytics.topItems.length === 0 && (
              <p className="py-10 text-center text-sm text-slate-400">No activity yet.</p>
            )}
            {analytics.topItems.map((item, index) => {
              const maximum = analytics.topItems[0]?.count || 1;
              return (
                <div key={item.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-md bg-slate-700 light:bg-slate-200 text-white light:text-slate-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {index + 1}
                      </span>
                      <span className="font-medium text-white light:text-gray-800 truncate">{item.name}</span>
                    </div>
                    <span className="text-slate-400 text-xs ml-2 flex-shrink-0">{item.count}x</span>
                  </div>
                  <div className="h-1.5 bg-slate-700 light:bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full"
                      style={{ width: `${(item.count / maximum) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-right text-slate-400 font-medium">{formatCurrency(item.revenue)}</p>
                </div>
              );
            })}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h3 className="font-semibold text-white light:text-gray-900">Daily Breakdown</h3>
        </CardHeader>
        <div className="divide-y divide-slate-700 light:divide-slate-100">
          {analytics.revenueData.map((point) => (
            <div key={point.date} className="px-6 py-3 flex items-center gap-4">
              <span className="text-sm text-slate-400 w-24 flex-shrink-0">{point.date}</span>
              <div className="flex-1 bg-slate-700 light:bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-slate-400 light:bg-slate-600 rounded-full"
                  style={{ width: `${(point.revenue / maxRevenue) * 100}%` }}
                />
              </div>
              <span className="text-sm font-bold text-white light:text-gray-900 w-24 text-right flex-shrink-0">
                {formatCurrency(point.revenue)}
              </span>
              <span className="text-xs text-slate-400 w-20 text-right flex-shrink-0">
                {point.count} {isAppt ? "bookings" : "orders"}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
