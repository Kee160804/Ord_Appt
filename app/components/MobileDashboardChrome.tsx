"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Grid2X2,
  Home,
  Package,
  Plus,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/app/contexts/auth";
import { cn } from "@/app/lib/utils";
import { NotificationCenter } from "@/app/components/NotificationCenter";

export function MobileDashboardHeader() {
  const { tenant, user } = useAuth();

  return (
    <header className="dashboard-mobile-header flex h-[72px] shrink-0 items-center justify-between border-b px-5 md:hidden">
      <Link
        href="/dashboard"
        className="flex items-center gap-3"
        aria-label="YuhBusiness dashboard"
      >
        <span className="brand-mark flex h-10 w-10 items-center justify-center rounded-xl">
          <Sparkles className="h-5 w-5 text-white" />
        </span>
        <span className="leading-none">
          <span className="block text-[14px] font-extrabold tracking-[-0.03em]">
            YuhBusiness
          </span>
          <span className="mt-1 block text-[8px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Platform
          </span>
        </span>
      </Link>

      <div className="flex items-center gap-2">
        <NotificationCenter tenantId={tenant?.id} userId={user?.id} />
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-violet-200 bg-violet-100 text-[10px] font-extrabold text-violet-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white">
          {user?.avatar || "KA"}
        </div>
      </div>
    </header>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const { tenant } = useAuth();
  const activityHref =
    tenant?.businessType === "appointment"
      ? "/dashboard/appointments"
      : "/dashboard/orders";
  const catalogHref =
    tenant?.businessType === "appointment"
      ? "/dashboard/services"
      : "/dashboard/products";
  const catalogLabel =
    tenant?.businessType === "appointment" ? "Services" : "Products";

  const items = [
    { href: "/dashboard", label: "Home", icon: Home, exact: true },
    { href: catalogHref, label: catalogLabel, icon: Package },
    {
      href: activityHref,
      label: tenant?.businessType === "appointment" ? "Bookings" : "Orders",
      icon: ShoppingBag,
    },
  ];

  return (
    <nav className="dashboard-mobile-nav fixed inset-x-0 bottom-0 z-40 grid h-[68px] grid-cols-5 items-center border-t px-2 pb-[env(safe-area-inset-bottom,0px)] md:hidden">
      {items.slice(0, 2).map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn("mobile-nav-item", active && "is-active")}
          >
            <Icon className="h-[18px] w-[18px]" />
            <span>{item.label}</span>
          </Link>
        );
      })}

      <button
        type="button"
        aria-label="Add new"
        className="mobile-nav-add"
        onClick={() => {
          if (pathname.startsWith(catalogHref)) {
            window.dispatchEvent(new Event("dashboard-primary-action"));
            return;
          }
          window.location.assign(catalogHref);
        }}
      >
        <Plus className="h-6 w-6" />
      </button>

      {items.slice(2).map((item) => {
        const active = pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn("mobile-nav-item", active && "is-active")}
          >
            <Icon className="h-[18px] w-[18px]" />
            <span>{item.label}</span>
          </Link>
        );
      })}

      <button
        type="button"
        className="mobile-nav-item"
        onClick={() =>
          window.dispatchEvent(new Event("dashboard-sidebar-toggle"))
        }
        aria-label="More navigation"
      >
        <Grid2X2 className="h-[18px] w-[18px]" />
        <span>More</span>
      </button>
    </nav>
  );
}
