"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Calendar,
  ChevronDown,
  DollarSign,
  PackageCheck,
  ShoppingBag,
  Tags,
  TrendingUp,
  Users,
} from "lucide-react";
import { StatusBadge } from "../components/Badge";
import {
  getAppointmentsByTenant,
  getOrdersByTenant,
  mockAnalytics,
} from "../data/mock";
import { isSupabaseConfigured } from "../lib/supabase/config";
import { cn, formatCurrency, formatDate, formatTime } from "../lib/utils";
import {
  loadDashboardData,
  type DashboardData,
} from "../services/dashboardService";
import { useAuth } from "../contexts/auth";
import type { AnalyticsSummary, Tenant } from "../types/index";

interface OverviewProps {
  tenant: Tenant;
}

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
    return {
      analytics: EMPTY_ANALYTICS,
      appointments: [],
      orders: [],
      customers: [],
    };
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
  const pendingCount = activity.filter(
    (record) => record.status === "pending",
  ).length;
  const todayKey = new Date().toLocaleDateString("en-CA");
  const recentAppointments = data.appointments
    .filter(
      (appointment) =>
        appointment.date >= todayKey &&
        (appointment.status === "pending" ||
          appointment.status === "confirmed"),
    )
    .slice(0, 4);
  const recentOrders = data.orders.slice(0, 4);
  const chartData = data.analytics.revenueData.slice(-7);
  const maxRevenue = Math.max(1, ...chartData.map((point) => point.revenue));
  const chartCeiling = Math.max(100, Math.ceil(maxRevenue / 100) * 100);
  const chartTicks = [1, 0.75, 0.5, 0.25, 0].map((ratio) =>
    Math.round(chartCeiling * ratio),
  );
  const firstName = user?.name.split(" ")[0] || "there";
  const todayLabel = new Date().toLocaleDateString("en-BZ", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
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
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load the dashboard.",
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tenant]);

  return (
    <div className="overview-page dashboard-page min-h-full space-y-4 p-3 sm:p-4 md:p-5">
      <OverviewHero
        tenant={tenant}
        firstName={firstName}
        pendingCount={pendingCount}
        isAppointment={isAppt}
        todayLabel={todayLabel}
      />

      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-xs text-red-300 light:text-red-700">
          {error}
        </div>
      )}
      {isLoading && (
        <p className="text-xs text-slate-400 light:text-slate-500">
          Loading your business activity...
        </p>
      )}

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
        <OverviewMetric
          label={isAppt ? "Total Revenue" : "Delivered Value"}
          value={formatCurrency(data.analytics.totalRevenue)}
          icon={<DollarSign className="h-4 w-4" />}
          tone="violet"
          change={data.analytics.revenueChange}
        />
        <OverviewMetric
          label={isAppt ? "Total Bookings" : "Total Orders"}
          value={String(data.analytics.totalActivity)}
          icon={
            isAppt ? (
              <Calendar className="h-4 w-4" />
            ) : (
              <ShoppingBag className="h-4 w-4" />
            )
          }
          tone={isAppt ? "blue" : "orange"}
          change={data.analytics.activityChange}
        />
        <OverviewMetric
          label="New Customers"
          value={String(data.analytics.newCustomers)}
          icon={<Users className="h-4 w-4" />}
          tone="emerald"
          change={0}
        />
        <OverviewMetric
          label="Avg. Value"
          value={formatCurrency(data.analytics.avgOrderValue)}
          icon={<BarChart3 className="h-4 w-4" />}
          tone="amber"
          change={data.analytics.revenueChange}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <section className="overview-panel overflow-hidden rounded-xl border lg:col-span-3">
          <PanelHeader
            icon={<BarChart3 className="h-4 w-4" />}
            title="Revenue Overview"
            subtitle="Last 7 days"
            action={
              <span className="overview-select rounded-lg border px-3 py-2 text-[10px] font-semibold">
                Last 7 days <ChevronDown className="ml-2 inline h-3 w-3" />
              </span>
            }
          />
          <div className="min-h-56 px-4 pb-4 pt-3">
            {chartData.every((point) => point.revenue === 0) ? (
              <EmptyState
                icon={<BarChart3 className="h-5 w-5" />}
                title="No revenue data yet"
                description="Your revenue stats will appear here once you start receiving completed activity."
              />
            ) : (
              <div className="grid h-44 grid-cols-[38px_1fr] gap-2">
                <div className="flex flex-col justify-between pb-5 text-right text-[9px] font-semibold text-slate-500 dark:text-slate-400">
                  {chartTicks.map((tick) => (
                    <span key={tick}>
                      {formatCurrency(tick).replace(/\.00$/, "")}
                    </span>
                  ))}
                </div>
                <div className="overview-chart-grid relative flex items-end gap-2 border-b border-l px-2 pb-5 sm:gap-4">
                  {chartData.map((point) => (
                    <div
                      key={point.date}
                      className="group relative flex h-full flex-1 items-end justify-center"
                    >
                      <div
                        className="overview-bar w-full max-w-8 rounded-t"
                        style={{
                          height: `${Math.max((point.revenue / chartCeiling) * 100, 3)}%`,
                        }}
                        title={`${point.date}: ${formatCurrency(point.revenue)}`}
                      />
                      <span className="absolute top-full mt-2 whitespace-nowrap text-[8px] font-medium text-slate-500 dark:text-slate-400 sm:text-[9px]">
                        {point.date.slice(5)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="overview-panel overflow-hidden rounded-xl border lg:col-span-2">
          <PanelHeader
            icon={<Tags className="h-4 w-4" />}
            title={isAppt ? "Top Services" : "Top Products"}
            action={
              <Link
                href={isAppt ? "/dashboard/services" : "/dashboard/products"}
                className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-500"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            }
          />
          <div className="min-h-56 px-4 py-3">
            {data.analytics.topItems.length === 0 ? (
              <EmptyState
                icon={<TrendingUp className="h-5 w-5" />}
                title={isAppt ? "No services yet" : "No products yet"}
                description={
                  isAppt
                    ? "Add services to see your top performers here."
                    : "Add products to see your top performers here."
                }
              />
            ) : (
              <div className="space-y-2.5">
                {data.analytics.topItems.slice(0, 4).map((item, index) => (
                  <div key={item.name} className="flex items-center gap-3">
                    <span className="overview-rank flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-extrabold">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-bold">
                        {item.name}
                      </p>
                      <p className="mt-0.5 text-[9px] text-slate-500 dark:text-slate-400">
                        {item.count} {isAppt ? "bookings" : "orders"}
                      </p>
                    </div>
                    <p className="text-[11px] font-extrabold">
                      {formatCurrency(item.revenue)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <RecentActivityPanel
          isAppointment={isAppt}
          isLoading={isLoading}
          recentAppointments={recentAppointments}
          recentOrders={recentOrders}
        />
        <RecentCustomersPanel
          data={data}
          isAppointment={isAppt}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}

function OverviewHero({
  tenant,
  firstName,
  pendingCount,
  isAppointment,
  todayLabel,
}: {
  tenant: Tenant;
  firstName: string;
  pendingCount: number;
  isAppointment: boolean;
  todayLabel: string;
}) {
  return (
    <section className="overview-hero relative min-h-32 overflow-hidden rounded-xl border">
      <div
        className="absolute inset-y-0 right-0 w-[62%] bg-cover bg-center"
        style={{
          backgroundImage: `url("${tenant.coverImage}")`,
          backgroundPosition: `${tenant.coverImagePositionX ?? 50}% ${tenant.coverImagePositionY ?? 50}%`,
          transform: `scale(${(tenant.coverImageZoom ?? 100) / 100})`,
        }}
      />
      <div className="overview-hero-overlay absolute inset-0" />
      <div className="relative z-10 flex min-h-32 items-center justify-between gap-4 px-5 py-5 sm:px-6">
        <div>
          <p className="text-[13px] font-medium text-white/90">
            Gud mawnin, {firstName}! <span aria-hidden="true">👋</span>
          </p>
          <h2 className="mt-2 text-[20px] font-extrabold tracking-[-0.035em] text-white sm:text-[22px]">
            Welcome back to {tenant.name}
          </h2>
          <p className="mt-1.5 text-[11px] text-white/90">
            {pendingCount
              ? `You have ${pendingCount} pending ${isAppointment ? "appointment" : "order"}${pendingCount === 1 ? "" : "s"} today.`
              : "Here's what's happening with your business today."}
          </p>
        </div>
        <div className="overview-date hidden items-center gap-2 rounded-lg border px-3 py-2 text-[10px] font-semibold text-white shadow-sm sm:flex">
          <Calendar className="h-3.5 w-3.5" />
          <span suppressHydrationWarning>{todayLabel}</span>
          <ChevronDown className="h-3 w-3" />
        </div>
      </div>
    </section>
  );
}

function OverviewMetric({
  label,
  value,
  change,
  icon,
  tone,
}: {
  label: string;
  value: string;
  change: number;
  icon: React.ReactNode;
  tone: "violet" | "blue" | "orange" | "emerald" | "amber";
}) {
  const positive = change >= 0;
  return (
    <section className="overview-metric rounded-xl border p-3 sm:p-3.5">
      <div className="flex items-center gap-2">
        <span
          className={`overview-metric-icon is-${tone} flex h-8 w-8 shrink-0 items-center justify-center rounded-lg`}
        >
          {icon}
        </span>
        <span className="line-clamp-2 text-[10px] font-extrabold leading-tight sm:text-[11px]">
          {label}
        </span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <strong className="text-lg font-black tracking-[-0.04em] sm:text-[22px]">
          {value}
        </strong>
        <MetricSparkline tone={tone} />
      </div>
      <p className="mt-2 truncate text-[8px] font-semibold sm:text-[9px]">
        <span className={positive ? "text-emerald-500" : "text-rose-500"}>
          {positive ? "↑" : "↓"} {positive ? "+" : ""}
          {change.toFixed(1)}%
        </span>{" "}
        <span className="text-slate-500 dark:text-slate-400">
          from last 7 days
        </span>
      </p>
    </section>
  );
}

function MetricSparkline({
  tone,
}: {
  tone: "violet" | "blue" | "orange" | "emerald" | "amber";
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 64 30"
      className={`overview-sparkline is-${tone} hidden h-8 w-14 shrink-0 sm:block`}
    >
      <path
        d="M1 25 10 19 17 23 25 11 33 24 42 14 50 20 62 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PanelHeader({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="overview-panel-header flex items-center justify-between gap-3 border-b px-4 py-3">
      <div>
        <h3 className="flex items-center gap-2 text-[13px] font-extrabold">
          <span className="text-violet-500">{icon}</span>
          {title}
        </h3>
        {subtitle && (
          <p className="ml-6 mt-0.5 text-[9px] text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </header>
  );
}

function RecentActivityPanel({
  isAppointment,
  isLoading,
  recentAppointments,
  recentOrders,
}: {
  isAppointment: boolean;
  isLoading: boolean;
  recentAppointments: DashboardData["appointments"];
  recentOrders: DashboardData["orders"];
}) {
  const hasRows = isAppointment
    ? recentAppointments.length > 0
    : recentOrders.length > 0;
  return (
    <section className="overview-panel overflow-hidden rounded-xl border">
      <PanelHeader
        icon={<PackageCheck className="h-4 w-4" />}
        title={isAppointment ? "Upcoming Appointments" : "Recent Orders"}
        action={
          <Link
            href={
              isAppointment ? "/dashboard/appointments" : "/dashboard/orders"
            }
            className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-500"
          >
            View all {isAppointment ? "appointments" : "orders"}{" "}
            <ArrowRight className="h-3 w-3" />
          </Link>
        }
      />
      <div className="min-h-44 overflow-x-auto">
        {!isLoading && !hasRows && (
          <EmptyState
            icon={<PackageCheck className="h-5 w-5" />}
            title={
              isAppointment ? "No upcoming appointments" : "No recent orders"
            }
            description="New activity will appear here automatically."
          />
        )}
        {hasRows && (
          <div className="overview-table-head grid min-w-125 grid-cols-[1fr_1.35fr_0.8fr_0.85fr] gap-3 px-4 py-2 text-[9px] font-bold">
            <span>{isAppointment ? "Appointment" : "Order #"}</span>
            <span>Customer</span>
            <span>{isAppointment ? "Time" : "Total"}</span>
            <span>Status</span>
          </div>
        )}
        {isAppointment
          ? recentAppointments.map((appointment) => (
              <div
                key={appointment.id}
                className="overview-table-row grid min-w-125 grid-cols-[1fr_1.35fr_0.8fr_0.85fr] items-center gap-3 border-t px-4 py-2.5 text-[10px]"
              >
                <span className="truncate font-bold">
                  {appointment.serviceName}
                </span>
                <span className="truncate font-semibold">
                  {appointment.customerName}
                </span>
                <span>
                  {formatDate(appointment.date)} {formatTime(appointment.time)}
                </span>
                <StatusBadge
                  status={appointment.status}
                  className="w-fit text-[8px]"
                />
              </div>
            ))
          : recentOrders.map((order) => (
              <div
                key={order.id}
                className="overview-table-row grid min-w-125 grid-cols-[1fr_1.35fr_0.8fr_0.85fr] items-center gap-3 border-t px-4 py-2.5 text-[10px]"
              >
                <span className="font-bold">#{order.orderNumber}</span>
                <span className="truncate font-semibold">
                  {order.customerName}
                </span>
                <span className="font-bold">
                  {formatCurrency(order.totalAmount)}
                </span>
                <StatusBadge
                  status={order.status}
                  className="w-fit text-[8px]"
                />
              </div>
            ))}
      </div>
    </section>
  );
}

function RecentCustomersPanel({
  data,
  isAppointment,
  isLoading,
}: {
  data: DashboardData;
  isAppointment: boolean;
  isLoading: boolean;
}) {
  return (
    <section className="overview-panel overflow-hidden rounded-xl border">
      <PanelHeader
        icon={<Users className="h-4 w-4" />}
        title="Recent Customers"
        action={
          <Link
            href="/dashboard/customers"
            className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-500"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        }
      />
      <div className="min-h-44 overflow-x-auto">
        {!isLoading && data.customers.length === 0 && (
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="No customers yet"
            description="Customer activity will appear here automatically."
          />
        )}
        {data.customers.length > 0 && (
          <div className="overview-table-head grid min-w-110 grid-cols-[1.5fr_0.65fr_0.85fr] gap-3 px-4 py-2 text-[9px] font-bold">
            <span>Customer</span>
            <span>{isAppointment ? "Bookings" : "Orders"}</span>
            <span>Total Spent</span>
          </div>
        )}
        {data.customers.slice(0, 4).map((customer) => (
          <div
            key={customer.key}
            className="overview-table-row grid min-w-110 grid-cols-[1.5fr_0.65fr_0.85fr] items-center gap-3 border-t px-4 py-2 text-[10px]"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="overview-avatar flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[8px] font-extrabold">
                {customer.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)}
              </span>
              <span className="truncate font-bold">{customer.name}</span>
            </div>
            <span className="font-semibold">{customer.activityCount}</span>
            <span className="font-extrabold">
              {formatCurrency(customer.totalValue)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function EmptyState({
  icon,
  title,
  description,
  iconBg = "bg-violet-500/15 text-violet-500",
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  iconBg?: string;
}) {
  return (
    <div className="flex min-h-42.5 flex-col items-center justify-center px-6 py-4 text-center">
      <div
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-full",
          iconBg,
        )}
      >
        {icon}
      </div>
      <p className="mt-3 text-xs font-bold">{title}</p>
      <p className="mt-1 max-w-56 text-[10px] leading-4 text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </div>
  );
}
