"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Bell,
  Building2,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Copy,
  CreditCard,
  Ellipsis,
  Eye,
  EyeOff,
  FileClock,
  Filter,
  Handshake,
  LayoutDashboard,
  Menu,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Sun,
  UserCog,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import { useAuth } from "@/app/contexts/auth";
import { PLATFORM } from "@/app/lib/platform";
import { useTheme } from "@/app/contexts/theme";
import { cn, formatCurrency } from "@/app/lib/utils";
import { PLAN_DEFINITIONS } from "@/app/lib/plans";
import {
  createAdminAgent,
  createAdminTenant,
  loadAdminPlatformData,
  type AdminActivityRecord,
  type AdminAgentRecord,
  type AdminPlatformData,
  type AdminRevenuePoint,
  type AdminRoleSummary,
  type CreateAdminAgentResult,
  type CreateAdminTenantResult,
} from "@/app/services/adminService";
import type { Tenant } from "@/app/types";
import {
  listBillingLedger,
  type BillingInvoice,
  type BillingTransaction,
} from "@/app/services/billingService";

type AdminView =
  | "overview"
  | "tenants"
  | "agents"
  | "roles"
  | "analytics"
  | "activity"
  | "billing"
  | "settings"
  | "integrations";

interface NavigationItem {
  id: AdminView;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

const NAVIGATION: NavigationItem[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "tenants", label: "Tenant Management", icon: Building2 },
  { id: "agents", label: "Agent Management", icon: UserCog },
  { id: "roles", label: "Access Oversight", icon: ShieldCheck },
  { id: "analytics", label: "System Analytics", icon: Activity },
  { id: "activity", label: "Activity Logs", icon: FileClock },
  { id: "billing", label: "Billing & Plans", icon: CreditCard },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "integrations", label: "Integrations", icon: Handshake },
];

const EMPTY_PLATFORM_DATA: AdminPlatformData = {
  tenants: [],
  analyticsByTenant: {},
  totalRevenue: 0,
  totalActivity: 0,
  totalCustomers: 0,
  totalUsers: 0,
  agents: [],
  roles: [],
  revenueSeries: [],
  recentActivity: [],
};

const panelClass =
  "rounded-2xl border border-slate-800 bg-[#0c1423] shadow-[0_18px_50px_rgba(0,0,0,0.14)] light:border-slate-200 light:bg-white light:shadow-sm";
const filterClass =
  "rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-300 outline-none focus:border-violet-500 light:border-slate-200 light:bg-white light:text-slate-700";

export default function AdminPage() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activeView, setActiveView] = useState<AdminView>("overview");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [platformData, setPlatformData] =
    useState<AdminPlatformData>(EMPTY_PLATFORM_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshPlatformData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      setPlatformData(await loadAdminPlatformData());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load platform data from Supabase.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshPlatformData();
  }, [refreshPlatformData]);

  const selectView = (view: AdminView) => {
    setActiveView(view);
    setMobileSidebarOpen(false);
  };
  const activeItem =
    NAVIGATION.find((item) => item.id === activeView) ?? NAVIGATION[0];

  return (
    <div className="min-h-dvh bg-[#070d19] text-slate-100 light:bg-[#f5f7fb] light:text-slate-900">
      {mobileSidebarOpen && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
      <AdminSidebar
        activeView={activeView}
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
        onLogout={() => void logout()}
        onSelect={selectView}
        userEmail={user?.email ?? "Platform administrator"}
        userName={user?.name ?? "Super Admin"}
      />

      <div className="min-h-dvh lg:pl-64">
        <AdminHeader
          activeItem={activeItem}
          isLoading={isLoading}
          onMenu={() => setMobileSidebarOpen(true)}
          onRefresh={() => void refreshPlatformData()}
          onToggleTheme={toggleTheme}
          theme={theme}
        />
        <main className="mx-auto max-w-[1600px] px-4 pb-10 pt-5 sm:px-6 lg:px-8">
          {error && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 light:text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {activeView === "overview" && (
            <OverviewView
              data={platformData}
              hasError={Boolean(error)}
              isLoading={isLoading}
              onSelect={selectView}
            />
          )}
          {activeView === "tenants" && (
            <TenantView
              tenants={platformData.tenants}
              isLoading={isLoading}
              onRefresh={() => void refreshPlatformData()}
            />
          )}
          {activeView === "agents" && (
            <AgentView
              agents={platformData.agents}
              tenants={platformData.tenants}
              isLoading={isLoading}
              onRefresh={() => void refreshPlatformData()}
            />
          )}
          {activeView === "roles" && (
            <RoleView roles={platformData.roles} isLoading={isLoading} />
          )}
          {activeView === "analytics" && (
            <AnalyticsView data={platformData} isLoading={isLoading} />
          )}
          {activeView === "activity" && (
            <ActivityView
              activities={platformData.recentActivity}
              isLoading={isLoading}
            />
          )}
          {activeView === "billing" && (
            <AdminBillingView tenants={platformData.tenants} />
          )}
          {activeView === "settings" && <PlatformSettingsView />}
          {activeView === "integrations" && <IntegrationsView />}
        </main>
      </div>
    </div>
  );
}

function AdminSidebar({
  activeView,
  isOpen,
  onClose,
  onLogout,
  onSelect,
  userEmail,
  userName,
}: {
  activeView: AdminView;
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  onSelect: (view: AdminView) => void;
  userEmail: string;
  userName: string;
}) {
  return (
    <aside
      className={cn(
        "pwa-admin-sidebar-safe fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-hidden border-r border-slate-800 bg-[#09101d] px-4 transition-transform duration-200 light:border-slate-200 light:bg-white lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full",
      )}
    >
      <div className="mb-7 flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-700 text-white shadow-lg shadow-violet-900/30">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white light:text-slate-950">
            YuhBusiness
          </p>
          <p className="text-[11px] text-slate-500">Super Admin</p>
        </div>
        <button
          aria-label="Close navigation"
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white light:hover:bg-slate-100 light:hover:text-slate-900 lg:hidden"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto">
        {NAVIGATION.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition",
                active
                  ? "bg-violet-500/20 text-violet-200 light:bg-violet-100 light:text-violet-700"
                  : "text-slate-400 hover:bg-slate-800/70 hover:text-white light:text-slate-600 light:hover:bg-slate-100 light:hover:text-slate-950",
              )}
              onClick={() => onSelect(item.id)}
            >
              <Icon
                className={cn(
                  "h-4 w-4",
                  active && "text-violet-400 light:text-violet-600",
                )}
              />
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-slate-800 pt-4 light:border-slate-200">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">
            {initials(userName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-slate-100 light:text-slate-900">
              {userName}
            </p>
            <p className="truncate text-[10px] text-slate-500">{userEmail}</p>
          </div>
          <button
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-white light:hover:bg-slate-100 light:hover:text-slate-900"
            onClick={onLogout}
            title="Sign out"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

function AdminHeader({
  activeItem,
  isLoading,
  onMenu,
  onRefresh,
  onToggleTheme,
  theme,
}: {
  activeItem: NavigationItem;
  isLoading: boolean;
  onMenu: () => void;
  onRefresh: () => void;
  onToggleTheme: () => void;
  theme: "dark" | "light";
}) {
  return (
    <header className="pwa-admin-header-safe sticky top-0 z-30 border-b border-slate-800/80 bg-[#070d19]/90 px-4 pb-4 backdrop-blur-xl light:border-slate-200 light:bg-[#f5f7fb]/90 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-2 sm:gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            aria-label="Open navigation"
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-slate-800 text-slate-400 hover:text-white light:border-slate-200 light:hover:text-slate-900 lg:hidden"
            onClick={onMenu}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h1 className="max-w-[42vw] truncate text-base font-bold text-white light:text-slate-950 sm:max-w-none sm:text-xl">
              {activeItem.id === "overview"
                ? "Super Admin Dashboard"
                : activeItem.label}
            </h1>
            <p className="hidden text-xs text-slate-500 sm:block">
              {activeItem.id === "overview"
                ? "Live platform data from Supabase"
                : "Platform-wide administration and oversight"}
            </p>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-2">
          <div
            suppressHydrationWarning
            className="hidden items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs text-slate-400 light:border-slate-200 light:bg-white light:text-slate-600 md:flex"
          >
            <CalendarDays className="h-4 w-4" />
            {new Intl.DateTimeFormat(PLATFORM.locale, {
              month: "short",
              day: "numeric",
              year: "numeric",
            }).format(new Date())}
          </div>
          <button
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/50 text-slate-400 transition hover:border-violet-500/50 hover:text-violet-300 light:border-slate-200 light:bg-white light:text-slate-600 light:hover:text-violet-700"
            onClick={onToggleTheme}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
          <button
            className="hidden items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2.5 text-xs font-medium text-slate-300 transition hover:border-violet-500/50 hover:text-white disabled:opacity-50 light:border-slate-200 light:bg-white light:text-slate-700 light:hover:text-violet-700 sm:flex"
            disabled={isLoading}
            onClick={onRefresh}
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            Refresh
          </button>
          <button
            aria-label="Notifications"
            className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/50 text-slate-400 light:border-slate-200 light:bg-white light:text-slate-600"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-rose-500" />
          </button>
        </div>
      </div>
    </header>
  );
}

function OverviewView({
  data,
  hasError,
  isLoading,
  onSelect,
}: {
  data: AdminPlatformData;
  hasError: boolean;
  isLoading: boolean;
  onSelect: (view: AdminView) => void;
}) {
  const activeTenants = data.tenants.filter((tenant) => tenant.isActive).length;
  const topTenants = [...data.tenants]
    .sort(
      (a, b) =>
        (data.analyticsByTenant[b.id]?.totalRevenue ?? 0) -
        (data.analyticsByTenant[a.id]?.totalRevenue ?? 0),
    )
    .slice(0, 5);
  const revenueSpark = data.revenueSeries
    .slice(-9)
    .map((point) => point.revenue);
  const activitySpark = data.revenueSeries
    .slice(-9)
    .map((point) => point.activity);
  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-2xl border border-violet-500/25 bg-gradient-to-r from-[#14102d] via-[#101736] to-[#102456] p-6 shadow-[0_20px_60px_rgba(37,23,100,0.2)] light:from-violet-50 light:via-indigo-50 light:to-blue-50 sm:p-7">
        <div className="relative z-10">
          <p className="text-sm text-slate-300 light:text-slate-600">
            Good day, Super Admin! <span aria-hidden>👋</span>
          </p>
          <h2 className="mt-3 text-xl font-bold text-white light:text-slate-950">
            Here&apos;s what&apos;s happening across the platform.
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-400 light:text-slate-600">
            Revenue, activity, tenant, user, and role information below is
            loaded from your Supabase project.
          </p>
        </div>
        <div className="absolute -bottom-12 right-4 h-44 w-44 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute right-12 top-6 hidden items-end gap-2 opacity-70 sm:flex">
          {[40, 64, 52, 92, 76, 118].map((height, index) => (
            <span
              key={`${height}-${index}`}
              className="w-5 rounded-t-md border border-violet-300/40 bg-gradient-to-t from-violet-600/60 to-cyan-400/40"
              style={{ height }}
            />
          ))}
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          accent="violet"
          icon={CircleDollarSign}
          label="Total Revenue"
          loading={isLoading}
          sparkValues={revenueSpark}
          value={formatCurrency(data.totalRevenue)}
        />
        <MetricCard
          accent="blue"
          icon={ShoppingCart}
          label="Orders & Appointments"
          loading={isLoading}
          sparkValues={activitySpark}
          value={data.totalActivity.toLocaleString()}
        />
        <MetricCard
          accent="emerald"
          icon={Users}
          label="Customers"
          loading={isLoading}
          sparkValues={[1, 2, 1, 3, 3, 5, 4, 6]}
          value={data.totalCustomers.toLocaleString()}
        />
        <MetricCard
          accent="amber"
          icon={Building2}
          label="Active Tenants"
          loading={isLoading}
          sparkValues={data.tenants.map((_, index) => index + 1).slice(-8)}
          value={activeTenants.toLocaleString()}
        />
      </section>
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.85fr)]">
        <div className={cn(panelClass, "min-w-0 p-5 sm:p-6")}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-white light:text-slate-950">
                Platform Overview
              </h3>
              <div className="mt-2 flex gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <i className="h-2 w-5 rounded-full bg-violet-500" />
                  Revenue
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="h-2 w-5 rounded-full bg-cyan-500" />
                  Activity
                </span>
              </div>
            </div>
            <span className="rounded-lg border border-slate-800 px-3 py-2 text-xs text-slate-400 light:border-slate-200 light:text-slate-600">
              Last 30 days
            </span>
          </div>
          <PlatformChart points={data.revenueSeries} />
        </div>
        <div className={cn(panelClass, "p-5 sm:p-6")}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold text-white light:text-slate-950">
              Top Performing Tenants
            </h3>
            <button
              className="text-xs font-semibold text-violet-400 light:text-violet-700"
              onClick={() => onSelect("tenants")}
            >
              View all
            </button>
          </div>
          {isLoading && <LoadingRows count={4} />}
          {!isLoading && topTenants.length === 0 && (
            <EmptyState message="No tenant performance data yet." />
          )}
          <div className="space-y-1">
            {topTenants.map((tenant) => (
              <div
                key={tenant.id}
                className="flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-slate-800/60 light:hover:bg-slate-50"
              >
                <TenantMark tenant={tenant} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-100 light:text-slate-900">
                    {tenant.name}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Recognized revenue
                  </p>
                </div>
                <p className="text-sm font-bold text-slate-100 light:text-slate-900">
                  {formatCurrency(
                    data.analyticsByTenant[tenant.id]?.totalRevenue ?? 0,
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="grid gap-5 xl:grid-cols-2">
        <RecentActivity
          activities={data.recentActivity}
          isLoading={isLoading}
          onViewAll={() => onSelect("activity")}
        />
        <SystemHealth hasError={hasError} isLoading={isLoading} />
      </section>
    </div>
  );
}

function MetricCard({
  accent,
  icon: Icon,
  label,
  loading,
  sparkValues = [],
  value,
}: {
  accent: "violet" | "blue" | "emerald" | "amber";
  icon: ComponentType<{ className?: string }>;
  label: string;
  loading: boolean;
  sparkValues?: number[];
  value: string;
}) {
  const colors = {
    violet: { box: "bg-violet-500/15 text-violet-400", stroke: "#8b5cf6" },
    blue: { box: "bg-blue-500/15 text-blue-400", stroke: "#0ea5e9" },
    emerald: { box: "bg-emerald-500/15 text-emerald-400", stroke: "#22c55e" },
    amber: { box: "bg-amber-500/15 text-amber-400", stroke: "#eab308" },
  }[accent];
  return (
    <div className={cn(panelClass, "p-5")}>
      <div className="flex items-start justify-between gap-3">
        <div className={cn("rounded-xl p-2.5", colors.box)}>
          <Icon className="h-5 w-5" />
        </div>
        <MiniSparkline color={colors.stroke} values={sparkValues} />
      </div>
      <p className="mt-4 text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black tracking-tight text-white light:text-slate-950">
        {loading ? (
          <span className="inline-block h-7 w-24 animate-pulse rounded bg-slate-800 light:bg-slate-200" />
        ) : (
          value
        )}
      </p>
      <p className="mt-2 text-[11px] text-emerald-400">Live platform total</p>
    </div>
  );
}

function MiniSparkline({ color, values }: { color: string; values: number[] }) {
  return (
    <svg aria-hidden className="h-9 w-24" viewBox="0 0 90 34">
      <polyline
        fill="none"
        points={linePoints(values.length ? values : [0], 90, 34, 2)}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function PlatformChart({ points }: { points: AdminRevenuePoint[] }) {
  const data = points.length ? points : [{ date: "", revenue: 0, activity: 0 }];
  const revenuePoints = linePoints(
    data.map((point) => point.revenue),
    720,
    220,
    14,
  );
  const activityPoints = linePoints(
    data.map((point) => point.activity),
    720,
    220,
    14,
  );
  const labels = data.filter(
    (_, index) => index % 5 === 0 || index === data.length - 1,
  );
  return (
    <div className="overflow-x-auto">
      <svg
        aria-label="Revenue and activity over the last 30 days"
        className="h-[250px] min-w-[620px] w-full"
        preserveAspectRatio="none"
        viewBox="0 0 720 250"
        role="img"
      >
        {[25, 75, 125, 175, 225].map((y) => (
          <line
            key={y}
            stroke="currentColor"
            className="text-slate-800 light:text-slate-200"
            strokeDasharray="4 7"
            x1="0"
            x2="720"
            y1={y}
            y2={y}
          />
        ))}
        <polyline
          fill="none"
          points={revenuePoints}
          stroke="#8b5cf6"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
        />
        <polyline
          fill="none"
          points={activityPoints}
          stroke="#0ea5e9"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
        />
        {labels.map((point, index) => {
          const x =
            labels.length === 1
              ? 360
              : (index / (labels.length - 1)) * 690 + 15;
          return (
            <text
              key={point.date || index}
              className="fill-slate-500 text-[10px]"
              textAnchor="middle"
              x={x}
              y="246"
            >
              {formatShortDate(point.date)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function RecentActivity({
  activities,
  isLoading,
  onViewAll,
}: {
  activities: AdminActivityRecord[];
  isLoading: boolean;
  onViewAll: () => void;
}) {
  return (
    <div className={cn(panelClass, "p-5 sm:p-6")}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-bold text-white light:text-slate-950">
          Recent Activity
        </h3>
        <button
          className="text-xs font-semibold text-violet-400 light:text-violet-700"
          onClick={onViewAll}
        >
          View all
        </button>
      </div>
      {isLoading && <LoadingRows count={4} />}
      {!isLoading && activities.length === 0 && (
        <EmptyState message="No recent platform activity." />
      )}
      <div className="space-y-1">
        {activities.slice(0, 4).map((item) => {
          const Icon =
            item.type === "tenant"
              ? Building2
              : item.type === "order"
                ? ShoppingCart
                : CalendarDays;
          return (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-slate-800/50 light:hover:bg-slate-50"
            >
              <div className="rounded-xl bg-violet-500/12 p-2.5 text-violet-400">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-100 light:text-slate-900">
                  {item.title}
                </p>
                <p className="truncate text-[11px] text-slate-500">
                  {item.tenantName} · {item.description}
                </p>
              </div>
              <span
                suppressHydrationWarning
                className="whitespace-nowrap text-[10px] text-slate-500"
              >
                {relativeTime(item.createdAt)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SystemHealth({
  hasError,
  isLoading,
}: {
  hasError: boolean;
  isLoading: boolean;
}) {
  const checks = [
    [
      "Supabase data",
      hasError ? "Unavailable" : isLoading ? "Checking" : "Connected",
    ],
    ["Authentication", "Protected"],
    ["Tenant security", "RLS enabled"],
    ["Theme preference", "Persisted"],
  ];
  return (
    <div className={cn(panelClass, "p-5 sm:p-6")}>
      <h3 className="font-bold text-white light:text-slate-950">
        System Health
      </h3>
      <p className="mt-2 text-xs text-slate-500">
        Current browser and platform connection status
      </p>
      <div className="mt-4 space-y-2">
        {checks.map(([label, status], index) => {
          const okay = !hasError || index > 0;
          return (
            <div
              key={label}
              className="flex items-center gap-3 rounded-xl bg-slate-900/50 px-3 py-3 light:bg-slate-50"
            >
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full",
                  okay
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-rose-500/15 text-rose-400",
                )}
              >
                {okay ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <X className="h-3 w-3" />
                )}
              </span>
              <span className="flex-1 text-sm text-slate-300 light:text-slate-700">
                {label}
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-1 text-[10px] font-semibold",
                  okay
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-rose-500/10 text-rose-400",
                )}
              >
                {status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TenantView({
  tenants,
  isLoading,
  onRefresh,
}: {
  tenants: Tenant[];
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [plan, setPlan] = useState("all");
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [successData, setSuccessData] =
    useState<CreateAdminTenantResult | null>(null);
  const pageSize = 7;

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return tenants.filter((tenant) => {
      const matchesSearch =
        !normalized ||
        [tenant.name, tenant.email, tenant.city, tenant.slug].some((value) =>
          value.toLowerCase().includes(normalized),
        );
      const matchesStatus =
        status === "all" ||
        (status === "active" ? tenant.isActive : !tenant.isActive);
      return (
        matchesSearch &&
        matchesStatus &&
        (plan === "all" || tenant.plan === plan)
      );
    });
  }, [plan, query, status, tenants]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );
  const changeQuery = (value: string) => {
    setQuery(value);
    setPage(1);
  };
  const changeStatus = (value: string) => {
    setStatus(value);
    setPage(1);
  };
  const changePlan = (value: string) => {
    setPlan(value);
    setPage(1);
  };

  return (
    <>
      <ManagementPanel
        action="Add Tenant"
        onAction={() => setShowAddModal(true)}
        description="Create, inspect, and manage platform businesses"
        title="Tenant Management"
      >
        <ManagementFilters
          query={query}
          onQuery={changeQuery}
          placeholder="Search by name, email, city, or slug..."
        >
          <select
            className={filterClass}
            value={status}
            onChange={(event) => changeStatus(event.target.value)}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            className={filterClass}
            value={plan}
            onChange={(event) => changePlan(event.target.value)}
          >
            <option value="all">All Plans</option>
            <option value="starter">Beginner</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </ManagementFilters>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500 light:border-slate-200">
                <th className="px-5 py-3 font-semibold">Tenant</th>
                <th className="px-4 py-3 font-semibold">Business</th>
                <th className="px-4 py-3 font-semibold">Plan</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Monthly Revenue</th>
                <th className="px-4 py-3 font-semibold">Created</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 light:divide-slate-100">
              {isLoading && <TableLoading columns={7} rows={5} />}
              {!isLoading &&
                pageRows.map((tenant) => (
                  <tr
                    key={tenant.id}
                    className="text-sm transition hover:bg-slate-800/30 light:hover:bg-slate-50"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <TenantMark tenant={tenant} />
                        <div>
                          <p className="font-semibold text-slate-100 light:text-slate-900">
                            {tenant.name}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {tenant.email || `${tenant.slug} storefront`}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 capitalize text-slate-400 light:text-slate-600">
                      {tenant.businessType}
                    </td>
                    <td className="px-4 py-4">
                      <PlanBadge plan={tenant.plan} />
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge active={tenant.isActive} />
                    </td>
                    <td className="px-4 py-4 font-semibold text-slate-200 light:text-slate-800">
                      {formatCurrency(tenant.monthlyRevenue ?? 0)}
                    </td>
                    <td className="px-4 py-4 text-slate-500">
                      {formatDate(tenant.createdAt)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Link
                        className="inline-flex rounded-lg p-2 text-slate-500 hover:bg-violet-500/10 hover:text-violet-400"
                        href={`/admin/tenant/${tenant.id}`}
                        title={`View ${tenant.name}`}
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!isLoading && pageRows.length === 0 && (
            <EmptyState message="No tenants match these filters." />
          )}
        </div>
        <Pagination
          count={filtered.length}
          page={safePage}
          pageCount={pageCount}
          pageSize={pageSize}
          onPage={setPage}
        />
      </ManagementPanel>

      {showAddModal && (
        <AddTenantModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={(result) => {
            setShowAddModal(false);
            setSuccessData(result);
            onRefresh();
          }}
        />
      )}

      {successData && (
        <CredentialsSuccessModal
          isOpen={Boolean(successData)}
          onClose={() => setSuccessData(null)}
          title="Tenant Created Successfully"
          badge="Business Onboarded"
          name={successData.tenant.name}
          email={successData.user.email}
          roleOrType={`${successData.tenant.businessType.toUpperCase()} BUSINESS · ${successData.tenant.plan.toUpperCase()}`}
          slug={successData.tenant.slug}
          emailSent={successData.emailSent}
        />
      )}
    </>
  );
}

function AgentView({
  agents,
  tenants,
  isLoading,
  onRefresh,
}: {
  agents: AdminAgentRecord[];
  tenants: Tenant[];
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [successData, setSuccessData] = useState<CreateAdminAgentResult | null>(
    null,
  );
  const roles = [...new Set(agents.map((agent) => agent.role))].sort();

  const filtered = agents.filter((agent) => {
    const normalized = query.trim().toLowerCase();
    const matchesSearch =
      !normalized ||
      [agent.name, agent.email, agent.tenantName, agent.role].some((value) =>
        value.toLowerCase().includes(normalized),
      );
    const matchesRole = role === "all" || agent.role === role;
    const matchesStatus =
      status === "all" ||
      (status === "active" ? agent.isActive : !agent.isActive);
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <>
      <ManagementPanel
        action="Add Agent"
        onAction={() => setShowAddModal(true)}
        description="Platform profiles joined to tenant memberships and roles"
        title="Agent Management"
      >
        <ManagementFilters
          query={query}
          onQuery={setQuery}
          placeholder="Search by name, email, role, or tenant..."
        >
          <select
            className={filterClass}
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            <option value="all">All Roles</option>
            {roles.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            className={filterClass}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </ManagementFilters>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500 light:border-slate-200">
                <th className="px-5 py-3 font-semibold">Agent</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Assigned To</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Created</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 light:divide-slate-100">
              {isLoading && <TableLoading columns={6} rows={5} />}
              {!isLoading &&
                filtered.map((agent) => (
                  <tr
                    key={agent.id}
                    className="text-sm transition hover:bg-slate-800/30 light:hover:bg-slate-50"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-xs font-bold text-violet-400">
                          {initials(agent.name)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-100 light:text-slate-900">
                            {agent.name}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {agent.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <RoleBadge role={agent.role} />
                    </td>
                    <td className="px-4 py-4 text-slate-400 light:text-slate-600">
                      {agent.tenantName}
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge active={agent.isActive} />
                    </td>
                    <td className="px-4 py-4 text-slate-500">
                      {formatDate(agent.createdAt)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        className="rounded-lg p-2 text-slate-500"
                        disabled
                        title="Agent editing requires a secured admin action"
                      >
                        <Ellipsis className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!isLoading && filtered.length === 0 && (
            <EmptyState message="No platform profiles match these filters." />
          )}
        </div>
        <div className="border-t border-slate-800 px-5 py-4 text-xs text-slate-500 light:border-slate-200">
          Showing {filtered.length} of {agents.length} profiles
        </div>
      </ManagementPanel>

      {showAddModal && (
        <AddAgentModal
          isOpen={showAddModal}
          tenants={tenants}
          onClose={() => setShowAddModal(false)}
          onSuccess={(result) => {
            setShowAddModal(false);
            setSuccessData(result);
            onRefresh();
          }}
        />
      )}

      {successData && (
        <CredentialsSuccessModal
          isOpen={Boolean(successData)}
          onClose={() => setSuccessData(null)}
          title="Agent Added Successfully"
          badge="Agent Provisioned"
          name={successData.agent.name}
          email={successData.agent.email}
          roleOrType={`${successData.agent.role} · ${successData.agent.tenantName}`}
          emailSent={successData.emailSent}
        />
      )}
    </>
  );
}

function RoleView({
  roles,
  isLoading,
}: {
  roles: AdminRoleSummary[];
  isLoading: boolean;
}) {
  return (
    <ManagementPanel
      description="Read-only platform audit. Each business owner manages Manager and Staff access from their own Settings > Team & Access."
      title="Access Oversight"
    >
      <div className="grid gap-4 p-5 md:grid-cols-2 2xl:grid-cols-3">
        {isLoading &&
          [1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-56 animate-pulse rounded-2xl bg-slate-800/60 light:bg-slate-100"
            />
          ))}
        {!isLoading && roles.length === 0 && (
          <div className="md:col-span-2">
            <EmptyState message="No role records were returned by Supabase." />
          </div>
        )}
        {roles.map((role, index) => (
          <RoleCard key={role.id} index={index} role={role} />
        ))}
      </div>
    </ManagementPanel>
  );
}

function RoleCard({ role, index }: { role: AdminRoleSummary; index: number }) {
  const permissionMap: Record<string, string[]> = {
    "SUPER ADMIN": [
      "View platform dashboards",
      "Manage subscriptions",
      "Approve paid seats",
      "Audit tenant access",
      "View analytics",
      "System settings",
    ],
    OWNER: [
      "View dashboard",
      "Manage team access",
      "Edit storefront",
      "Manage appointments",
      "Manage orders",
      "Manage customers",
    ],
    ADMIN: [
      "Legacy business role",
      "Manage business data",
      "Manage daily activity",
      "View analytics",
    ],
    MANAGER: [
      "View dashboard",
      "Manage business data",
      "Manage daily activity",
      "View customers",
    ],
    STAFF: ["View dashboard", "Manage daily orders or appointments"],
  };
  const permissions = permissionMap[role.name.toUpperCase()] ?? [
    "Tenant role permissions",
    "Access is defined by the application",
  ];
  const color = ["violet", "blue", "amber"][index % 3];
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 light:border-slate-200 light:bg-slate-50">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "rounded-xl p-3",
            color === "violet"
              ? "bg-violet-500/15 text-violet-400"
              : color === "blue"
                ? "bg-blue-500/15 text-blue-400"
                : "bg-amber-500/15 text-amber-400",
          )}
        >
          <Shield className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-slate-100 light:text-slate-900">
            {role.name}
          </h3>
          <p className="mt-1 line-clamp-2 text-xs text-slate-500">
            {role.description}
          </p>
        </div>
        {role.isSystem && (
          <span className="rounded-full bg-violet-500/10 px-2 py-1 text-[9px] font-bold uppercase text-violet-400">
            System
          </span>
        )}
      </div>
      <p className="mt-5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        Permissions
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {permissions.map((permission) => (
          <span
            key={permission}
            className="flex items-start gap-1.5 text-[11px] text-slate-400 light:text-slate-600"
          >
            <Check className="mt-0.5 h-3 w-3 shrink-0 text-violet-400" />
            {permission}
          </span>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-slate-800 pt-4 text-[11px] text-slate-500 light:border-slate-200">
        <span>{role.userCount} users</span>
        <span>{role.tenantCount} tenants</span>
      </div>
    </article>
  );
}

function AnalyticsView({
  data,
  isLoading,
}: {
  data: AdminPlatformData;
  isLoading: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          accent="violet"
          icon={CircleDollarSign}
          label="Recognized Revenue"
          loading={isLoading}
          sparkValues={data.revenueSeries
            .map((point) => point.revenue)
            .slice(-9)}
          value={formatCurrency(data.totalRevenue)}
        />
        <MetricCard
          accent="blue"
          icon={Activity}
          label="Total Activity"
          loading={isLoading}
          sparkValues={data.revenueSeries
            .map((point) => point.activity)
            .slice(-9)}
          value={data.totalActivity.toLocaleString()}
        />
        <MetricCard
          accent="emerald"
          icon={UsersRound}
          label="Platform Users"
          loading={isLoading}
          sparkValues={[1, 2, 3, 4]}
          value={data.totalUsers.toLocaleString()}
        />
      </div>
      <div className={cn(panelClass, "p-5 sm:p-6")}>
        <h3 className="mb-5 font-bold text-white light:text-slate-950">
          30-day Platform Analytics
        </h3>
        <PlatformChart points={data.revenueSeries} />
      </div>
    </div>
  );
}

function ActivityView({
  activities,
  isLoading,
}: {
  activities: AdminActivityRecord[];
  isLoading: boolean;
}) {
  return (
    <div className={cn(panelClass, "p-5 sm:p-6")}>
      <div className="mb-5">
        <h2 className="text-lg font-bold text-white light:text-slate-950">
          Activity Logs
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Latest tenants, orders, and appointments across the platform
        </p>
      </div>
      {isLoading && <LoadingRows count={5} />}
      {!isLoading && activities.length === 0 && (
        <EmptyState message="No recent platform activity." />
      )}
      <div className="space-y-2">
        {activities.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/30 p-4 light:border-slate-200 light:bg-slate-50"
          >
            <div className="rounded-xl bg-violet-500/15 p-2.5 text-violet-400">
              <Activity className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-100 light:text-slate-900">
                {item.title}
              </p>
              <p className="truncate text-xs text-slate-500">
                {item.tenantName} · {item.description}
              </p>
            </div>
            <span suppressHydrationWarning className="text-xs text-slate-500">
              {relativeTime(item.createdAt)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminBillingView({ tenants }: { tenants: Tenant[] }) {
  const [transactions, setTransactions] = useState<BillingTransaction[]>([]);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    listBillingLedger()
      .then((value) => {
        setTransactions(value.transactions);
        setInvoices(value.invoices);
      })
      .catch((loadError) =>
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load billing ledger.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);
  const names = new Map(tenants.map((tenant) => [tenant.id, tenant.name]));
  const paid = transactions
    .filter((item) => item.status === "SUCCEEDED")
    .reduce((sum, item) => sum + item.amount - item.refundedAmount, 0);
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          accent="emerald"
          icon={CircleDollarSign}
          label="Ledger Payments"
          loading={loading}
          value={formatCurrency(paid)}
        />
        <MetricCard
          accent="violet"
          icon={CreditCard}
          label="Transactions"
          loading={loading}
          value={String(transactions.length)}
        />
        <MetricCard
          accent="blue"
          icon={FileClock}
          label="Invoices"
          loading={loading}
          value={String(invoices.length)}
        />
      </div>
      <section className={cn(panelClass, "overflow-hidden")}>
        <div className="border-b border-slate-800 p-5 light:border-slate-200">
          <h2 className="font-bold">Payment & invoice ledger</h2>
          <p className="mt-1 text-xs text-slate-500">
            Mock transactions are explicitly identified and process no real
            money.
          </p>
        </div>
        {error && <p className="p-5 text-sm text-red-400">{error}</p>}
        {!loading && transactions.length === 0 && (
          <EmptyState message="No payment transactions yet." />
        )}
        <div className="divide-y divide-slate-800 light:divide-slate-200">
          {transactions.slice(0, 50).map((item) => (
            <div
              key={item.id}
              className="grid gap-2 p-4 text-xs sm:grid-cols-[1fr_auto_auto]"
            >
              <div>
                <p className="font-bold">
                  {names.get(item.tenantId) ?? item.tenantId}
                </p>
                <p className="text-slate-500">
                  {item.kind} · {item.provider} · {item.reference}
                </p>
              </div>
              <span className="font-bold">{formatCurrency(item.amount)}</span>
              <span className="text-emerald-400">{item.status}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function PlatformSettingsView() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "Current deployment origin";
  return (
    <div className={cn(panelClass, "p-6")}>
      <h2 className="text-lg font-bold">Platform Settings</h2>
      <p className="mt-1 text-xs text-slate-500">
        Canonical product and market configuration
      </p>
      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        {[
          ["Product", "YuhBusiness"],
          ["Market", "Belize"],
          ["Currency", "BZD"],
          ["Locale", "en-BZ"],
          ["Timezone", "America/Belize"],
          ["Application URL", appUrl || "Configured at deployment"],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-slate-800 p-4 light:border-slate-200"
          >
            <dt className="text-[10px] font-bold uppercase text-slate-500">
              {label}
            </dt>
            <dd className="mt-1 text-sm font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 text-xs text-slate-500">
        Domain-independent paths remain active until a custom domain is
        connected.
      </p>
    </div>
  );
}

function IntegrationsView() {
  const integrations = [
    {
      name: "Payments",
      state: "Sandbox ready",
      detail: "Mock provider · BZD · no real money",
    },
    {
      name: "Transactional email",
      state: "Configuration-aware",
      detail: "Resend worker with durable Supabase outbox",
    },
    {
      name: "Supabase",
      state: "Connected",
      detail: "Authentication, PostgreSQL, RLS, storage, and Realtime",
    },
    {
      name: "Calendar / SMS / WhatsApp",
      state: "Awaiting credentials",
      detail: "Provider credentials are required before activation",
    },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {integrations.map((item) => (
        <article key={item.name} className={cn(panelClass, "p-5")}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold">{item.name}</h3>
            <span className="rounded-full bg-violet-500/15 px-2.5 py-1 text-[10px] font-bold text-violet-300">
              {item.state}
            </span>
          </div>
          <p className="mt-3 text-xs text-slate-500">{item.detail}</p>
        </article>
      ))}
    </div>
  );
}

function ManagementPanel({
  action,
  onAction,
  children,
  description,
  title,
}: {
  action?: string;
  onAction?: () => void;
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className={cn(panelClass, "overflow-hidden")}>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 px-5 py-5 light:border-slate-200 sm:px-6">
        <div>
          <h2 className="text-lg font-bold text-white light:text-slate-950">
            {title}
          </h2>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>
        {action &&
          (onAction ? (
            <button
              onClick={onAction}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md transition hover:from-violet-500 hover:to-purple-500 active:scale-95"
              title={action}
            >
              <Plus className="h-4 w-4" />
              {action}
            </button>
          ) : (
            <button
              className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2.5 text-xs font-semibold text-white opacity-60"
              disabled
              title="Requires a secured and audited admin write action"
            >
              <Plus className="h-4 w-4" />
              {action}
            </button>
          ))}
      </div>
      {children}
    </section>
  );
}

function ManagementFilters({
  children,
  onQuery,
  placeholder,
  query,
}: {
  children: React.ReactNode;
  onQuery: (value: string) => void;
  placeholder: string;
  query: string;
}) {
  return (
    <div className="border-b border-slate-800 p-5 light:border-slate-200">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          className="w-full rounded-xl border border-slate-800 bg-slate-900/60 py-3 pl-10 pr-4 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-violet-500 light:border-slate-200 light:bg-slate-50 light:text-slate-900 light:placeholder:text-slate-400"
          onChange={(event) => onQuery(event.target.value)}
          placeholder={placeholder}
          value={query}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {children}
        <span className="ml-auto hidden items-center gap-2 rounded-lg border border-slate-800 px-3 py-2 text-xs text-slate-500 light:border-slate-200 sm:flex">
          <Filter className="h-3.5 w-3.5" />
          Filters
        </span>
      </div>
    </div>
  );
}

function Pagination({
  count,
  onPage,
  page,
  pageCount,
  pageSize,
}: {
  count: number;
  onPage: (page: number) => void;
  page: number;
  pageCount: number;
  pageSize: number;
}) {
  const start = count ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(count, page * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 px-5 py-4 text-xs text-slate-500 light:border-slate-200">
      <span>
        Showing {start} to {end} of {count} tenants
      </span>
      <div className="flex items-center gap-1">
        <button
          className="rounded-lg border border-slate-800 p-2 disabled:opacity-30 light:border-slate-200"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        {Array.from(
          { length: Math.min(pageCount, 5) },
          (_, index) => index + 1,
        ).map((item) => (
          <button
            key={item}
            className={cn(
              "h-8 w-8 rounded-lg border text-xs",
              page === item
                ? "border-violet-500 bg-violet-600 text-white"
                : "border-slate-800 light:border-slate-200",
            )}
            onClick={() => onPage(item)}
          >
            {item}
          </button>
        ))}
        <button
          className="rounded-lg border border-slate-800 p-2 disabled:opacity-30 light:border-slate-200"
          disabled={page >= pageCount}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function TenantMark({ tenant }: { tenant: Tenant }) {
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white shadow"
      style={{ backgroundColor: tenant.logoBg }}
    >
      {tenant.logo || tenant.name.charAt(0).toUpperCase()}
    </div>
  );
}
function PlanBadge({ plan }: { plan: Tenant["plan"] }) {
  return (
    <span className="rounded-full bg-violet-500/10 px-2.5 py-1 text-[10px] font-semibold text-violet-400 light:text-violet-700">
      {PLAN_DEFINITIONS[plan].name}
    </span>
  );
}
function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold",
        active
          ? "bg-emerald-500/10 text-emerald-400"
          : "bg-rose-500/10 text-rose-400",
      )}
    >
      <i
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          active ? "bg-emerald-400" : "bg-rose-400",
        )}
      />
      {active ? "Active" : "Inactive"}
    </span>
  );
}
function RoleBadge({ role }: { role: string }) {
  const normalized = role.toUpperCase();
  const classes = normalized.includes("SUPER")
    ? "bg-violet-500/10 text-violet-400"
    : normalized.includes("OWNER") || normalized.includes("ADMIN")
      ? "bg-blue-500/10 text-blue-400"
      : "bg-amber-500/10 text-amber-400";
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-[10px] font-semibold",
        classes,
      )}
    >
      {role}
    </span>
  );
}
function LoadingRows({ count }: { count: number }) {
  return (
    <div className="space-y-3 py-2">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="h-12 animate-pulse rounded-xl bg-slate-800/60 light:bg-slate-100"
        />
      ))}
    </div>
  );
}
function TableLoading({ columns, rows }: { columns: number; rows: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <tr key={row}>
          {Array.from({ length: columns }, (__, column) => (
            <td className="px-4 py-5" key={column}>
              <div className="h-4 animate-pulse rounded bg-slate-800 light:bg-slate-100" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
function EmptyState({ message }: { message: string }) {
  return (
    <div className="px-5 py-12 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

function linePoints(
  values: number[],
  width: number,
  height: number,
  padding: number,
) {
  if (!values.length) return "";
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  return values
    .map((value, index) => {
      const x =
        values.length === 1
          ? width / 2
          : padding + (index / (values.length - 1)) * (width - padding * 2);
      const y =
        height - padding - ((value - min) / span) * (height - padding * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "SA"
  );
}
function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat(PLATFORM.locale, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(date);
}
function formatShortDate(value: string) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat(PLATFORM.locale, {
        month: "short",
        day: "numeric",
      }).format(date);
}
function relativeTime(value: string) {
  const date = new Date(value);
  const elapsed = Date.now() - date.getTime();
  if (!Number.isFinite(elapsed)) return "";
  const minutes = Math.max(0, Math.floor(elapsed / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function generateRandomPassword(length = 18): string {
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowercase = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const symbols = "!@#$%&*";
  const all = uppercase + lowercase + numbers + symbols;

  const secureIndex = (maximum: number) => {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0] % maximum;
  };
  const characters = [
    uppercase[secureIndex(uppercase.length)],
    lowercase[secureIndex(lowercase.length)],
    numbers[secureIndex(numbers.length)],
    symbols[secureIndex(symbols.length)],
  ];
  while (characters.length < length)
    characters.push(all[secureIndex(all.length)]);
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swap = secureIndex(index + 1);
    [characters[index], characters[swap]] = [
      characters[swap],
      characters[index],
    ];
  }
  return characters.join("");
}

function AddTenantModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: CreateAdminTenantResult) => void;
}) {
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState<
    "appointment" | "ordering" | "retail"
  >("appointment");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [plan, setPlan] = useState<"starter" | "pro" | "enterprise">("starter");
  const [subscriptionStatus, setSubscriptionStatus] = useState<
    "trial" | "active"
  >("trial");
  const [sendPasswordEmail, setSendPasswordEmail] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleGeneratePassword = () => {
    const generated = generateRandomPassword();
    setPassword(generated);
    setShowPassword(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim() || !ownerName.trim() || !ownerEmail.trim()) {
      setError(
        "Please fill in all required fields (Business name, owner name, owner email).",
      );
      return;
    }
    setIsSubmitting(true);
    setError("");

    try {
      const result = await createAdminTenant({
        businessName: businessName.trim(),
        businessType,
        ownerName: ownerName.trim(),
        ownerEmail: ownerEmail.trim(),
        password: password.trim() || undefined,
        city: city.trim() || undefined,
        phone: phone.trim() || undefined,
        plan,
        subscriptionStatus,
        sendPasswordEmail,
      });
      onSuccess(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create tenant.");
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-700 bg-[#0c1425] p-6 text-slate-100 shadow-2xl light:border-slate-200 light:bg-white light:text-slate-900">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white light:hover:bg-slate-100 light:hover:text-slate-900"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white light:text-slate-900">
              Add Business Tenant
            </h3>
            <p className="text-xs text-slate-400 light:text-slate-500">
              Manual onboarding for businesses unable to self sign up
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-xs text-rose-400">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 light:text-slate-700">
                Business Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Bella's Salon"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3.5 py-2 text-xs text-slate-100 outline-none focus:border-violet-500 light:border-slate-300 light:bg-slate-50 light:text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 light:text-slate-700">
                Business Type <span className="text-rose-400">*</span>
              </label>
              <select
                value={businessType}
                onChange={(e) =>
                  setBusinessType(
                    e.target.value as "appointment" | "ordering" | "retail",
                  )
                }
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-violet-500 light:border-slate-300 light:bg-slate-50 light:text-slate-900"
              >
                <option value="appointment">Appointment / Bookings</option>
                <option value="ordering">Ordering / Food & Retail</option>
                <option value="retail">Retail / Product Store</option>
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 light:text-slate-700">
                Owner Full Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="e.g. Bella Smith"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3.5 py-2 text-xs text-slate-100 outline-none focus:border-violet-500 light:border-slate-300 light:bg-slate-50 light:text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 light:text-slate-700">
                Owner Email <span className="text-rose-400">*</span>
              </label>
              <input
                type="email"
                required
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="owner@example.com"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3.5 py-2 text-xs text-slate-100 outline-none focus:border-violet-500 light:border-slate-300 light:bg-slate-50 light:text-slate-900"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-300 light:text-slate-700">
                Temporary Password
              </label>
              <button
                type="button"
                onClick={handleGeneratePassword}
                className="text-[11px] font-medium text-violet-400 hover:text-violet-300 light:text-violet-600"
              >
                + Generate Random
              </button>
            </div>
            <div className="relative mt-1">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank to auto-generate"
                className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3.5 py-2 pr-10 text-xs text-slate-100 outline-none focus:border-violet-500 light:border-slate-300 light:bg-slate-50 light:text-slate-900"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 light:hover:text-slate-700"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="mt-1 text-[10px] text-slate-500">
              Provide this password to the client. They can sign in and change
              it, or use the email link.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 light:text-slate-700">
                City / District
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Belize City"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3.5 py-2 text-xs text-slate-100 outline-none focus:border-violet-500 light:border-slate-300 light:bg-slate-50 light:text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 light:text-slate-700">
                Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 501-610-0000"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3.5 py-2 text-xs text-slate-100 outline-none focus:border-violet-500 light:border-slate-300 light:bg-slate-50 light:text-slate-900"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 light:text-slate-700">
                Plan
              </label>
              <select
                value={plan}
                onChange={(e) =>
                  setPlan(e.target.value as "starter" | "pro" | "enterprise")
                }
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-violet-500 light:border-slate-300 light:bg-slate-50 light:text-slate-900"
              >
                <option value="starter">Starter / Beginner</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 light:text-slate-700">
                Initial Access
              </label>
              <select
                value={subscriptionStatus}
                onChange={(e) =>
                  setSubscriptionStatus(e.target.value as "trial" | "active")
                }
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-violet-500 light:border-slate-300 light:bg-slate-50 light:text-slate-900"
              >
                <option value="trial">14-Day Free Trial</option>
                <option value="active">Active (Paid / Approved)</option>
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 light:border-slate-200 light:bg-slate-50">
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={sendPasswordEmail}
                onChange={(e) => setSendPasswordEmail(e.target.checked)}
                className="mt-0.5 rounded border-slate-700 text-violet-600 focus:ring-violet-500"
              />
              <div className="text-xs">
                <span className="font-semibold text-white light:text-slate-900">
                  Send password creation / reset email
                </span>
                <p className="mt-0.5 text-[11px] text-slate-400 light:text-slate-500">
                  Prompts the owner with a secure email link to set or change
                  their password for private access.
                </p>
              </div>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 light:border-slate-300 light:text-slate-700 light:hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2 text-xs font-semibold text-white shadow-md hover:bg-violet-500 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Provisioning...</span>
                </>
              ) : (
                "Create Business Account"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddAgentModal({
  isOpen,
  tenants,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  tenants: Tenant[];
  onClose: () => void;
  onSuccess: (result: CreateAdminAgentResult) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [tenantId, setTenantId] = useState<string>("platform");
  const [role, setRole] = useState<
    "superadmin" | "owner" | "admin" | "manager" | "staff"
  >("superadmin");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sendPasswordEmail, setSendPasswordEmail] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleTenantChange = (target: string) => {
    setTenantId(target);
    if (target === "platform") {
      setRole("superadmin");
    } else if (role === "superadmin") {
      setRole("staff");
    }
  };

  const handleGeneratePassword = () => {
    const generated = generateRandomPassword();
    setPassword(generated);
    setShowPassword(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError("Please fill in agent name and email.");
      return;
    }
    setIsSubmitting(true);
    setError("");

    try {
      const result = await createAdminAgent({
        name: name.trim(),
        email: email.trim(),
        role: tenantId === "platform" ? "superadmin" : role,
        tenantId: tenantId === "platform" ? null : tenantId,
        password: password.trim() || undefined,
        sendPasswordEmail,
      });
      onSuccess(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create agent.");
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-[#0c1425] p-6 text-slate-100 shadow-2xl light:border-slate-200 light:bg-white light:text-slate-900">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white light:hover:bg-slate-100 light:hover:text-slate-900"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
            <UserCog className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white light:text-slate-900">
              Add System Agent
            </h3>
            <p className="text-xs text-slate-400 light:text-slate-500">
              Create a platform administrator or business agent
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-xs text-rose-400">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 light:text-slate-700">
              Agent Full Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex Morgan"
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3.5 py-2 text-xs text-slate-100 outline-none focus:border-violet-500 light:border-slate-300 light:bg-slate-50 light:text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 light:text-slate-700">
              Email Address <span className="text-rose-400">*</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="agent@example.com"
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3.5 py-2 text-xs text-slate-100 outline-none focus:border-violet-500 light:border-slate-300 light:bg-slate-50 light:text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 light:text-slate-700">
              Assignment
            </label>
            <select
              value={tenantId}
              onChange={(e) => handleTenantChange(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-violet-500 light:border-slate-300 light:bg-slate-50 light:text-slate-900"
            >
              <option value="platform">Platform (Super Admin / Global)</option>
              <optgroup label="Assign to Business Tenant">
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {tenantId !== "platform" && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 light:text-slate-700">
                Tenant Role
              </label>
              <select
                value={role}
                onChange={(e) =>
                  setRole(
                    e.target.value as "owner" | "admin" | "manager" | "staff",
                  )
                }
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-violet-500 light:border-slate-300 light:bg-slate-50 light:text-slate-900"
              >
                <option value="staff">Staff (Daily orders/appointments)</option>
                <option value="manager">Manager (Operations & records)</option>
                <option value="admin">Admin (Business administrator)</option>
                <option value="owner">Owner (Full business ownership)</option>
              </select>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-300 light:text-slate-700">
                Initial Password
              </label>
              <button
                type="button"
                onClick={handleGeneratePassword}
                className="text-[11px] font-medium text-violet-400 hover:text-violet-300 light:text-violet-600"
              >
                + Generate
              </button>
            </div>
            <div className="relative mt-1">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank to auto-generate"
                className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3.5 py-2 pr-10 text-xs text-slate-100 outline-none focus:border-violet-500 light:border-slate-300 light:bg-slate-50 light:text-slate-900"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 light:hover:text-slate-700"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 light:border-slate-200 light:bg-slate-50">
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={sendPasswordEmail}
                onChange={(e) => setSendPasswordEmail(e.target.checked)}
                className="mt-0.5 rounded border-slate-700 text-violet-600 focus:ring-violet-500"
              />
              <div className="text-xs">
                <span className="font-semibold text-white light:text-slate-900">
                  Send password setup email
                </span>
                <p className="mt-0.5 text-[11px] text-slate-400 light:text-slate-500">
                  Allows the agent to immediately choose their private password.
                </p>
              </div>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 light:border-slate-300 light:text-slate-700 light:hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2 text-xs font-semibold text-white shadow-md hover:bg-violet-500 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                "Create Agent"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CredentialsSuccessModal({
  isOpen,
  onClose,
  title,
  badge,
  name,
  email,
  roleOrType,
  slug,
  emailSent,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  badge: string;
  name: string;
  email: string;
  roleOrType: string;
  slug?: string;
  emailSent?: boolean;
}) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const copyAllSummary = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const lines = [
      `=== YuhBusiness Account Credentials ===`,
      `Name: ${name}`,
      `Email: ${email}`,
      `Role / Business: ${roleOrType}`,
      `Sign In: ${origin}/login`,
      slug ? `Storefront: ${origin}/store-front/${slug}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    copyToClipboard(lines, "all");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/85 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl border border-emerald-500/40 bg-[#0c1425] p-6 text-slate-100 shadow-2xl light:border-emerald-500/30 light:bg-white light:text-slate-900">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white light:hover:bg-slate-100 light:hover:text-slate-900"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
            <Check className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white light:text-slate-900">
                {title}
              </h3>
              <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400 light:bg-emerald-100 light:text-emerald-700">
                {badge}
              </span>
            </div>
            <p className="text-xs text-slate-400 light:text-slate-500">
              The account has been provisioned and is ready for use.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs light:border-slate-200 light:bg-slate-50">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 light:border-slate-200">
            <span className="text-slate-400 light:text-slate-500">
              Name / Business:
            </span>
            <span className="font-semibold text-white light:text-slate-900">
              {name}
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 light:border-slate-200">
            <span className="text-slate-400 light:text-slate-500">
              Login Email:
            </span>
            <span className="font-mono font-medium text-white light:text-slate-900">
              {email}
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 light:border-slate-200">
            <span className="text-slate-400 light:text-slate-500">
              Role / Type:
            </span>
            <span className="text-slate-300 light:text-slate-700">
              {roleOrType}
            </span>
          </div>

          {emailSent && (
            <div className="flex items-center gap-2 text-[11px] text-emerald-400">
              <Check className="h-3.5 w-3.5" />
              <span>Password setup email dispatched to {email}.</span>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-between">
          <button
            type="button"
            onClick={copyAllSummary}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-700 light:border-slate-300 light:bg-slate-100 light:text-slate-800 light:hover:bg-slate-200"
          >
            {copiedField === "all" ? (
              <>
                <CheckCheck className="h-4 w-4 text-emerald-400" />
                <span>Copied All Details!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>Copy Account Details</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-violet-600 px-6 py-2.5 text-xs font-semibold text-white shadow-md transition hover:bg-violet-500"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
