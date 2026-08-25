"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  ChevronDown,
  Clock,
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";
import { StatCard } from "../components/StatCard";
import { Card, CardBody, CardHeader } from "../components/Card";
import { StatusBadge } from "../components/Badge";
import { getAppointmentsByTenant, getOrdersByTenant, mockAnalytics } from "../data/mock";
import { isSupabaseConfigured } from "../lib/supabase/config";
import { cn, formatCurrency, formatDate, formatTime } from "../lib/utils";
import { loadDashboardData, type DashboardData } from "../services/dashboardService";
import { useAuth } from "../contexts/auth";
import type { AnalyticsSummary, Tenant } from "../types/index";

interface OverviewProps { tenant: Tenant }

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

function initialData(tenant: Tenant): DashboardData {
  if (isSupabaseConfigured()) {
    return { analytics: EMPTY_ANALYTICS, appointments: [], orders: [], customers: [] };
  }
  return {
    analytics: mockAnalytics[tenant.id] ?? EMPTY_ANALYTICS,
    appointments: getAppointmentsByTenant(tenant.id),
    orders: getOrdersByTenant(tenant.id),
    customers: [],
  };
}

export function DashboardOverview({ tenant }: OverviewProps) {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData>(() => initialData(tenant));
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured());
  const [error, setError] = useState("");
  const isAppt = tenant.businessType === "appointment";
  const activity = isAppt ? data.appointments : data.orders;
  const pendingCount = activity.filter((record) => record.status === "pending").length;
  const todayKey = new Date().toLocaleDateString("en-CA");
  const recentAppointments = data.appointments
    .filter(
      (appointment) =>
        appointment.date >= todayKey &&
        (appointment.status === "pending" || appointment.status === "confirmed"),
    )
    .slice(0, 4);
  const recentOrders = data.orders.slice(0, 4);
  const chartData = data.analytics.revenueData.slice(-7);
  const maxRevenue = Math.max(1, ...chartData.map((point) => point.revenue));
  const firstName = user?.name.split(" ")[0] || "there";
  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let active = true;
    loadDashboardData(tenant)
      .then((loaded) => {
        if (!active) return;
        setData(loaded);
        setError("");
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load the dashboard.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tenant]);

  return (
    <div className="space-y-3.5 p-4 md:p-5">
      <section className="relative min-h-[124px] overflow-hidden rounded-xl border border-slate-700/60 light:border-[#e4e9f1] bg-slate-900 light:bg-white shadow-sm">
        <div
          className="absolute inset-y-0 right-0 w-[58%] bg-cover bg-center opacity-50 light:opacity-75"
          style={{ backgroundImage: `url("${tenant.coverImage}")` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/95 to-slate-950/25 light:from-white light:via-white/95 light:to-white/15" />
        <div className="relative z-10 flex min-h-[124px] items-center justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-xs font-medium text-slate-400 light:text-[#566681]">
              Good morning, {firstName}! <span aria-hidden="true">👋</span>
            </p>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-white light:text-[#111b31]">
              Welcome back to {tenant.name}
            </h2>
            <p className="mt-1 text-xs text-slate-400 light:text-[#71809a]">
              {pendingCount
                ? `You have ${pendingCount} pending ${isAppt ? "appointment" : "order"}${pendingCount === 1 ? "" : "s"} today.`
                : `Here’s what’s happening with your business today.`}
            </p>
          </div>
          <div className="hidden items-center gap-2 rounded-lg border border-slate-700/80 light:border-violet-200 bg-slate-900/90 light:bg-white/95 px-3 py-2 text-[10px] font-semibold text-slate-200 light:text-violet-700 shadow-sm sm:flex">
            <Calendar className="h-3.5 w-3.5" />
            <span suppressHydrationWarning>{todayLabel}</span>
            <ChevronDown className="h-3 w-3" />
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-xs text-red-300 light:text-red-700">
          {error}
        </div>
      )}
      {isLoading && <p className="text-xs text-slate-400 light:text-slate-500">Loading your business activity...</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={isAppt ? "Total Revenue" : "Delivered Value"}
          value={formatCurrency(data.analytics.totalRevenue)}
          icon={<DollarSign className="h-4 w-4 text-violet-600" />}
          iconBg="bg-violet-500/15 light:bg-violet-50"
          chartColor="text-violet-500"
        />
        <StatCard
          label={isAppt ? "Total Bookings" : "Total Orders"}
          value={String(data.analytics.totalActivity)}
          icon={isAppt
            ? <Calendar className="h-4 w-4 text-blue-600" />
            : <ShoppingBag className="h-4 w-4 text-orange-600" />}
          iconBg={isAppt ? "bg-blue-500/15 light:bg-blue-50" : "bg-orange-500/15 light:bg-orange-50"}
          chartColor="text-blue-500"
        />
        <StatCard
          label="New Customers"
          value={String(data.analytics.newCustomers)}
          icon={<Users className="h-4 w-4 text-emerald-600" />}
          iconBg="bg-emerald-500/15 light:bg-emerald-50"
          chartColor="text-emerald-500"
        />
        <StatCard
          label="Avg. Value"
          value={formatCurrency(data.analytics.avgOrderValue)}
          icon={<WalletCards className="h-4 w-4 text-orange-600" />}
          iconBg="bg-orange-500/15 light:bg-orange-50"
          chartColor="text-orange-500"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="py-3">
            <div>
              <h3 className="text-xs font-bold text-white light:text-[#17223a]">Revenue Overview</h3>
              <p className="mt-1 text-[10px] text-slate-400 light:text-[#7b879d]">Last 7 days</p>
            </div>
            <div className="rounded-lg border border-slate-700 light:border-[#e3e8f0] px-3 py-2 text-[10px] text-slate-400 light:text-[#5f6d85]">
              Last 7 days <ChevronDown className="ml-2 inline h-3 w-3" />
            </div>
          </CardHeader>
          <CardBody className="min-h-[220px]">
            {chartData.every((point) => point.revenue === 0) ? (
              <EmptyState
                icon={<WalletCards className="h-5 w-5" />}
                title="No revenue data yet"
                description="Your revenue stats will appear here once you start receiving bookings."
              />
            ) : (
              <div className="flex h-44 items-end gap-3 border-b border-l border-slate-700/70 light:border-[#e8ecf3] px-3">
                {chartData.map((point) => (
                  <div key={point.date} className="group relative flex h-full flex-1 items-end justify-center">
                    <div
                      className="w-full max-w-8 rounded-t bg-violet-500 transition-colors group-hover:bg-violet-600"
                      style={{ height: `${Math.max((point.revenue / maxRevenue) * 100, 4)}%` }}
                    />
                    <span className="absolute top-full mt-2 text-[9px] text-slate-400 light:text-[#78859b]">
                      {point.date.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="py-3">
            <h3 className="text-xs font-bold text-white light:text-[#17223a]">
              {isAppt ? "Top Services" : "Top Products"}
            </h3>
            <Link
              href={isAppt ? "/dashboard/services" : "/dashboard/products"}
              className="text-[10px] font-semibold text-violet-400 light:text-violet-600 hover:text-violet-500"
            >
              View all
            </Link>
          </CardHeader>
          <CardBody className="min-h-[220px]">
            {data.analytics.topItems.length === 0 ? (
              <EmptyState
                icon={<TrendingUp className="h-5 w-5" />}
                title={isAppt ? "No services yet" : "No products yet"}
                description={isAppt ? "Add services to see your top performers here." : "Add products to see your top performers here."}
              />
            ) : (
              <div className="space-y-4">
                {data.analytics.topItems.map((item, index) => (
                  <div key={item.name} className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15 text-[10px] font-bold text-violet-400 light:bg-violet-50 light:text-violet-700">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-white light:text-[#17223a]">{item.name}</p>
                      <p className="mt-0.5 text-[10px] text-slate-400 light:text-[#7b879d]">{item.count} bookings</p>
                    </div>
                    <p className="text-xs font-bold text-white light:text-[#17223a]">{formatCurrency(item.revenue)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader className="py-3">
            <h3 className="text-xs font-bold text-white light:text-[#17223a]">
              {isAppt ? "Upcoming Appointments" : "Recent Orders"}
            </h3>
            <Link
              href={isAppt ? "/dashboard/appointments" : "/dashboard/orders"}
              className="flex items-center gap-1 text-[10px] font-semibold text-violet-400 light:text-violet-600"
            >
              View all {isAppt ? "appointments" : "orders"} <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <div className="min-h-[172px] divide-y divide-slate-700/60 light:divide-[#edf0f5]">
            {!isLoading && (isAppt ? recentAppointments.length === 0 : recentOrders.length === 0) && (
              <EmptyState
                icon={isAppt ? <Calendar className="h-5 w-5" /> : <ShoppingBag className="h-5 w-5" />}
                iconBg={isAppt ? "bg-blue-500/15 text-blue-400 light:bg-blue-50 light:text-blue-600" : "bg-orange-500/15 text-orange-400 light:bg-orange-50 light:text-orange-600"}
                title={isAppt ? "No upcoming appointments" : "No recent orders"}
                description={isAppt ? "When you get bookings, they’ll show up here." : "When customers order, they’ll show up here."}
                action={
                  isAppt ? (
                    <Link
                      href="/dashboard/appointments"
                      className="mt-3 inline-flex items-center justify-center rounded-lg bg-violet-600 px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm transition-colors hover:bg-violet-700"
                    >
                      Create Appointment
                    </Link>
                  ) : undefined
                }
              />
            )}
            {isAppt
              ? recentAppointments.map((appointment) => (
                  <div key={appointment.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/15 text-blue-400 light:bg-blue-50 light:text-blue-600">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-white light:text-[#17223a]">{appointment.customerName}</p>
                      <p className="mt-0.5 truncate text-[10px] text-slate-400 light:text-[#7b879d]">
                        {appointment.serviceName} · {formatDate(appointment.date)} at {formatTime(appointment.time)}
                      </p>
                    </div>
                    <StatusBadge status={appointment.status} className="text-[9px]" />
                  </div>
                ))
              : recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500/15 text-orange-400 light:bg-orange-50 light:text-orange-600">
                      <ShoppingBag className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-white light:text-[#17223a]">{order.customerName}</p>
                      <p className="mt-0.5 text-[10px] text-slate-400 light:text-[#7b879d]">{order.orderNumber}</p>
                    </div>
                    <StatusBadge status={order.status} className="text-[9px]" />
                  </div>
                ))}
          </div>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <h3 className="text-xs font-bold text-white light:text-[#17223a]">Recent Customers</h3>
            <Link href="/dashboard/customers" className="text-[10px] font-semibold text-violet-400 light:text-violet-600">
              View all
            </Link>
          </CardHeader>
          <div className="min-h-[172px] divide-y divide-slate-700/60 light:divide-[#edf0f5]">
            {!isLoading && data.customers.length === 0 && (
              <EmptyState
                icon={<Users className="h-5 w-5" />}
                iconBg="bg-emerald-500/15 text-emerald-400 light:bg-emerald-50 light:text-emerald-600"
                title="No customers yet"
                description="Add customers to build relationships and grow your business."
              />
            )}
            {data.customers.slice(0, 4).map((customer) => (
              <div key={customer.key} className="flex items-center gap-3 px-5 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 text-[10px] font-bold text-emerald-400 light:bg-emerald-50 light:text-emerald-700">
                  {customer.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-white light:text-[#17223a]">{customer.name}</p>
                  <p className="truncate text-[10px] text-slate-400 light:text-[#7b879d]">{customer.email || customer.phone}</p>
                </div>
                <p className="text-[10px] font-semibold text-slate-300 light:text-[#526079]">{formatCurrency(customer.totalValue)}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
  iconBg = "bg-violet-500/15 text-violet-400 light:bg-violet-50 light:text-violet-600",
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  iconBg?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[170px] flex-col items-center justify-center px-6 py-4 text-center">
      <div className={cn("flex h-12 w-12 items-center justify-center rounded-full", iconBg)}>
        {icon}
      </div>
      <p className="mt-3 text-xs font-bold text-white light:text-[#17223a]">{title}</p>
      <p className="mt-1 max-w-56 text-[10px] leading-4 text-slate-400 light:text-[#7b879d]">{description}</p>
      {action}
    </div>
  );
}
