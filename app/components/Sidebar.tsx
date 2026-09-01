"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Calendar,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Package,
  Scissors,
  Settings,
  ShoppingBag,
  Sparkles,
  Users,
  LockKeyhole,
} from "lucide-react";
import { cn } from "../lib/utils";
import { tenantHasFeature } from "../lib/plans";
import type { Tenant, User } from "../types/index";
import { useAuth } from "../contexts/auth";

interface SidebarProps {
  tenant: Tenant;
  user: User;
}

export function Sidebar({ tenant, user }: SidebarProps) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAppointmentBusiness = tenant.businessType === "appointment";
  const base = "/dashboard";
  const navItems = [
    { href: base, label: "Overview", icon: LayoutDashboard },
    ...(isAppointmentBusiness
      ? [
          { href: `${base}/appointments`, label: "Appointments", icon: Calendar },
          { href: `${base}/services`, label: "Services", icon: Scissors },
        ]
      : [
          { href: `${base}/orders`, label: "Orders", icon: ShoppingBag },
          { href: `${base}/products`, label: "Products", icon: Package },
        ]),
    { href: `${base}/customers`, label: "Customers", icon: Users },
    {
      href: `${base}/analytics`,
      label: "Analytics",
      icon: BarChart3,
      locked: !tenantHasFeature(tenant, "detailed_analytics"),
    },
    { href: `${base}/settings`, label: "Settings", icon: Settings },
  ];

  useEffect(() => {
    const toggle = () => {
      if (window.matchMedia("(max-width: 767px)").matches) {
        setCollapsed(false);
        setMobileOpen((current) => !current);
        return;
      }
      setCollapsed((current) => !current);
    };
    const media = window.matchMedia("(max-width: 767px)");
    const handleViewportChange = (event: MediaQueryListEvent) => {
      setMobileOpen(false);
      if (event.matches) setCollapsed(false);
    };
    window.addEventListener("dashboard-sidebar-toggle", toggle);
    media.addEventListener("change", handleViewportChange);
    return () => {
      window.removeEventListener("dashboard-sidebar-toggle", toggle);
      media.removeEventListener("change", handleViewportChange);
    };
  }, []);

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-[2px] md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={cn(
          "pwa-sidebar-safe fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(86vw,280px)] flex-shrink-0 flex-col overflow-hidden bg-[#111a35] text-white shadow-[6px_0_28px_rgba(8,20,44,0.18)] transition-[transform,width] duration-300 md:relative md:z-30 md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "md:w-[72px]" : "md:w-[216px]",
        )}
      >
      <div className={cn("flex h-[66px] items-center gap-3 border-b border-white/[0.06] px-5 pt-[max(0.25rem,env(safe-area-inset-top))]", collapsed && "justify-center px-3")}>
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-700 shadow-lg shadow-violet-950/30">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        {!collapsed && (
          <div className="leading-none">
            <p className="text-[13px] font-bold tracking-tight text-white">YuhBusiness</p>
            <p className="mt-1 text-[7px] font-semibold uppercase tracking-[0.2em] text-slate-400">Platform</p>
          </div>
        )}
      </div>

      <div className={cn("border-b border-white/[0.06] px-4 py-4", collapsed && "px-3")}>
        <div className={cn("flex items-center gap-3 rounded-xl px-1 py-1", collapsed && "justify-center")}>
          <div
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white shadow-sm"
            style={{ backgroundColor: tenant.logoBg }}
            title={tenant.name}
          >
            {tenant.logo}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">{tenant.name}</p>
              <span className="mt-1 inline-flex rounded-full bg-violet-600 px-2 py-0.5 text-[7px] font-bold uppercase tracking-wide text-white">
                {isAppointmentBusiness ? "Business" : "Ordering"}
              </span>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== base && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? item.label : undefined}
              className={cn(
                "group flex h-10 items-center gap-3 rounded-lg px-3 text-[12px] font-medium transition-colors",
                active
                  ? "bg-violet-500/20 text-white"
                  : "text-slate-300 hover:bg-white/[0.06] hover:text-white",
                collapsed && "justify-center px-2",
              )}
            >
              <Icon className={cn("h-[15px] w-[15px] flex-shrink-0", active ? "text-violet-300" : "text-slate-400 group-hover:text-white")} />
              {!collapsed && <span className="flex-1">{item.label}</span>}
              {!collapsed && item.locked && <LockKeyhole className="h-3 w-3 text-violet-300" />}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/[0.06] px-3 py-2">
        <Link
          href={`/store-front/${tenant.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          title={collapsed ? "View Storefront" : undefined}
          className={cn(
            "flex h-9 items-center gap-3 rounded-lg px-3 text-[11px] font-medium text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white",
            collapsed && "justify-center px-2",
          )}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {!collapsed && "View Storefront"}
        </Link>
      </div>

      <div className={cn("border-t border-white/[0.06] p-3", collapsed && "px-2") }>
        <div className={cn(
          "flex items-center gap-3 rounded-2xl border border-white/[0.04] bg-white/[0.02] px-3 py-2.5",
          collapsed && "justify-center px-2 py-2.5"
        )}>
          {!collapsed && (
            <div
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-violet-400/30 bg-violet-500/15 text-[10px] font-bold text-violet-100"
              title={user.name}
            >
              {user.avatar}
            </div>
          )}
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold text-white">{user.name}</p>
              <p className="mt-0.5 text-[9px] capitalize text-slate-400">{user.role}</p>
            </div>
          )}
          <button
            onClick={() => void logout()}
            aria-label="Sign out"
            title="Sign out"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      </aside>
    </>
  );
}
