"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Menu, Moon, Plus, Search, Sun } from "lucide-react";
import { useTheme } from "@/app/contexts/theme";
import { useAuth } from "@/app/contexts/auth";
import { NotificationCenter } from "@/app/components/NotificationCenter";

interface TopBarProps {
  title: string;
  subtitle?: string;
  meta?: string;
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  action?: { label: string; onClick: () => void };
}

export function TopBar({
  title,
  meta,
  searchValue,
  searchPlaceholder = "Search...",
  onSearchChange,
  action,
}: TopBarProps) {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { user, tenant } = useAuth();
  const [search, setSearch] = useState("");
  const [searchMessage, setSearchMessage] = useState("");

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (onSearchChange) return;
    const query = search.trim().toLowerCase();
    if (!query) return;
    const destinations = [
      { terms: ["dashboard", "overview", "home"], href: "/dashboard" },
      ...(tenant?.businessType === "appointment"
        ? [
            {
              terms: ["appointment", "appointments", "booking", "bookings"],
              href: "/dashboard/appointments",
            },
            { terms: ["service", "services"], href: "/dashboard/services" },
          ]
        : [
            { terms: ["order", "orders"], href: "/dashboard/orders" },
            { terms: ["product", "products"], href: "/dashboard/products" },
          ]),
      { terms: ["customer", "customers"], href: "/dashboard/customers" },
      {
        terms: ["analytics", "reports", "report"],
        href: "/dashboard/analytics",
      },
      {
        terms: ["settings", "business", "storefront", "hours"],
        href: "/dashboard/settings",
      },
      {
        terms: [
          "tools",
          "providers",
          "team",
          "departments",
          "promotions",
          "discounts",
          "reminders",
          "qr",
        ],
        href: "/dashboard/tools",
      },
    ];
    const destination = destinations.find((candidate) =>
      candidate.terms.some(
        (term) => term.includes(query) || query.includes(term),
      ),
    );
    if (destination) {
      setSearchMessage("");
      setSearch("");
      router.push(destination.href);
      return;
    }
    setSearchMessage(
      "Try appointments, services, customers, analytics, or settings.",
    );
  };

  return (
    <header className="dashboard-topbar sticky top-0 z-20 flex min-h-[64px] shrink-0 items-center justify-between gap-2 border-b px-3 py-2 backdrop-blur sm:px-5 md:min-h-[72px] md:px-6">
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
        <button
          onClick={() =>
            window.dispatchEvent(new Event("dashboard-sidebar-toggle"))
          }
          aria-label="Toggle sidebar"
          title="Toggle sidebar"
          className="dashboard-icon-button flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors sm:h-10 sm:w-10"
        >
          <Menu className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <h1 className="max-w-[55vw] truncate text-[18px] font-extrabold leading-tight tracking-[-0.03em] sm:max-w-none md:text-[20px]">
            {title}
          </h1>
          {meta && (
            <p className="mt-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">
              {meta}
            </p>
          )}
        </div>
      </div>

      <div className="hidden shrink-0 items-center gap-1.5 md:flex">
        <div className="relative hidden md:block">
          <form onSubmit={handleSearch}>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              value={onSearchChange ? (searchValue ?? "") : search}
              onChange={(event) => {
                if (onSearchChange) onSearchChange(event.target.value);
                else setSearch(event.target.value);
                setSearchMessage("");
              }}
              aria-label="Search dashboard"
              placeholder={searchPlaceholder}
              className="dashboard-search h-9 w-44 rounded-xl border pl-9 pr-3 text-[12px] outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 lg:w-52"
            />
          </form>
          {searchMessage && (
            <div className="absolute right-0 top-10 w-64 rounded-lg border border-slate-700 light:border-[#e3e8f0] bg-slate-900 light:bg-white px-3 py-2 text-[10px] text-slate-300 light:text-slate-600 shadow-xl">
              {searchMessage}
            </div>
          )}
        </div>

        <NotificationCenter tenantId={tenant?.id} userId={user?.id} />

        <button
          onClick={toggleTheme}
          className="dashboard-icon-button flex h-9 w-9 items-center justify-center rounded-xl transition-colors"
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4 text-amber-300" />
          ) : (
            <Moon className="h-4 w-4 text-slate-700" />
          )}
        </button>

        <div
          className="ml-1 hidden h-7 w-7 items-center justify-center rounded-full bg-linear-to-br from-amber-200 to-violet-300 text-[9px] font-bold text-slate-800 ring-2 ring-white/10 light:ring-slate-100 sm:flex"
          title={user?.name ?? "Account"}
        >
          {user?.avatar ||
            (user?.name
              ? user.name
                  .split(" ")
                  .filter(Boolean)
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()
              : "KM")}
        </div>

        {action && (
          <button
            onClick={action.onClick}
            className="ml-1 flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 sm:h-9 sm:px-3"
            aria-label={action.label}
            title={action.label}
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{action.label}</span>
          </button>
        )}
      </div>
    </header>
  );
}
