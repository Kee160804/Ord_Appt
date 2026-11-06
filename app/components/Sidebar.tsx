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
  BriefcaseBusiness,
} from "lucide-react";
import { cn } from "../lib/utils";
import { tenantHasFeature } from "../lib/plans";
import type { Tenant, User } from "../types/index";
import { useAuth } from "../contexts/auth";
import { AccountSwitcher } from "./AccountSwitcher";
import { BusinessSwitcher } from "./BusinessSwitcher";

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
  const canManageBusiness =
    user.role === "owner" || user.role === "manager" || user.role === "admin";
  const isOwner = user.role === "owner";
  const base = "/dashboard";
  const navItems = [
    { href: base, label: "Overview", icon: LayoutDashboard },
    ...(isAppointmentBusiness
      ? [
          {
            href: `${base}/appointments`,
            label: "Appointments",
            icon: Calendar,
          },
          ...(canManageBusiness
            ? [{ href: `${base}/services`, label: "Services", icon: Scissors }]
            : []),
        ]
      : [
          { href: `${base}/orders`, label: "Orders", icon: ShoppingBag },
          ...(canManageBusiness
            ? [{ href: `${base}/products`, label: "Products", icon: Package }]
            : []),
        ]),
    ...(canManageBusiness
      ? [{ href: `${base}/customers`, label: "Customers", icon: Users }]
      : []),
    ...(canManageBusiness
      ? [
          {
            href: `${base}/analytics`,
            label: "Analytics",
            icon: BarChart3,
            locked: !tenantHasFeature(tenant, "detailed_analytics"),
          },
        ]
      : []),
    ...(isOwner
      ? [
          {
            href: `${base}/tools`,
            label: "Business Tools",
            icon: BriefcaseBusiness,
          },
          { href: `${base}/settings`, label: "Settings", icon: Settings },
        ]
      : []),
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
          "pwa-sidebar-safe dashboard-sidebar fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(86vw,280px)] shrink-0 flex-col overflow-hidden shadow-[6px_0_28px_rgba(8,20,44,0.12)] transition-[transform,width] duration-300 md:relative md:z-30 md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "md:w-18" : "md:w-54",
        )}
      >
        <div
          className={cn(
            "sidebar-brand flex h-[76px] items-center gap-3 border-b px-5 pt-[max(0.25rem,env(safe-area-inset-top))]",
            collapsed && "justify-center px-3",
          )}
        >
          <div className="brand-mark flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          {!collapsed && (
            <div className="leading-none">
              <p className="sidebar-strong text-[14px] font-extrabold tracking-[-0.03em]">
                YuhBusiness
              </p>
              <p className="sidebar-muted mt-1 text-[8px] font-semibold uppercase tracking-[0.2em]">
                Platform
              </p>
            </div>
          )}
        </div>

        <div
          className={cn(
            "sidebar-divider border-b px-4 py-4",
            collapsed && "px-3",
          )}
        >
          <BusinessSwitcher
            tenant={tenant}
            collapsed={collapsed}
            onBusinessSelected={() => setMobileOpen(false)}
          />
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== base && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "sidebar-nav-item group flex min-h-11 items-center gap-3 rounded-xl px-3 text-[12px] font-semibold transition-colors",
                  active ? "is-active" : "",
                  collapsed && "justify-center px-2",
                )}
              >
                <Icon
                  className={cn(
                    "h-3.75 w-3.75 shrink-0",
                    active ? "text-violet-500 dark:text-violet-300" : "",
                  )}
                />
                {!collapsed && <span className="flex-1">{item.label}</span>}
                {!collapsed && item.locked && (
                  <LockKeyhole className="h-3 w-3 text-violet-300" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-divider border-t px-3 py-2">
          <Link
            href={`/store-front/${tenant.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            title={collapsed ? "View Storefront" : undefined}
            className={cn(
              "sidebar-secondary flex h-10 items-center gap-3 rounded-xl px-3 text-[11px] font-semibold transition-colors",
              collapsed && "justify-center px-2",
            )}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {!collapsed && "View Storefront"}
          </Link>
        </div>

        <div
          className={cn("sidebar-divider border-t p-3", collapsed && "px-2")}
        >
          <div
            className={cn(
              "sidebar-account flex flex-col gap-2 rounded-2xl border px-3 py-2.5",
              collapsed && "items-center px-2 py-2.5",
            )}
          >
            {!collapsed && (
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-violet-400/30 bg-violet-500/15 text-[10px] font-bold text-violet-100"
                  title={user.name}
                >
                  {user.avatar}
                </div>
                <div className="min-w-0">
                  <p className="sidebar-strong truncate text-[11px] font-semibold">
                    {user.name}
                  </p>
                  <p className="mt-0.5 text-[9px] capitalize text-slate-400">
                    {user.role}
                  </p>
                </div>
              </div>
            )}

            <div
              className={cn(
                "flex w-full flex-col gap-1.5",
                collapsed && "items-center",
              )}
            >
              <AccountSwitcher
                currentUser={user}
                collapsed={collapsed}
                onAccountSelected={() => setMobileOpen(false)}
              />
              <button
                onClick={() => void logout()}
                aria-label="Sign out"
                title="Sign out"
                className={cn(
                  "flex h-9 shrink-0 items-center gap-2 rounded-lg border border-white/6 bg-white/3 text-slate-300 transition-colors hover:border-rose-400/30 hover:bg-rose-500/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400",
                  collapsed
                    ? "w-9 justify-center"
                    : "w-full justify-start px-3 text-[10px] font-semibold",
                )}
              >
                <LogOut className="h-3.5 w-3.5" />
                {!collapsed && <span>Sign out</span>}
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
