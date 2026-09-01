"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Bell, Menu, Plus, Search, Sun } from "lucide-react";
import { useTheme } from "@/app/contexts/theme";
import { useAuth } from "@/app/contexts/auth";

interface TopBarProps {
  title: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void };
}

export function TopBar({ title, action }: TopBarProps) {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { user, tenant } = useAuth();
  const [search, setSearch] = useState("");
  const [searchMessage, setSearchMessage] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = search.trim().toLowerCase();
    if (!query) return;
    const destinations = [
      { terms: ["dashboard", "overview", "home"], href: "/dashboard" },
      ...(tenant?.businessType === "appointment"
        ? [
            { terms: ["appointment", "appointments", "booking", "bookings"], href: "/dashboard/appointments" },
            { terms: ["service", "services"], href: "/dashboard/services" },
          ]
        : [
            { terms: ["order", "orders"], href: "/dashboard/orders" },
            { terms: ["product", "products"], href: "/dashboard/products" },
          ]),
      { terms: ["customer", "customers"], href: "/dashboard/customers" },
      { terms: ["analytics", "reports", "report"], href: "/dashboard/analytics" },
      { terms: ["settings", "business", "storefront", "hours"], href: "/dashboard/settings" },
    ];
    const destination = destinations.find((candidate) =>
      candidate.terms.some((term) => term.includes(query) || query.includes(term)),
    );
    if (destination) {
      setSearchMessage("");
      setSearch("");
      router.push(destination.href);
      return;
    }
    setSearchMessage("Try appointments, services, customers, analytics, or settings.");
  };

  return (
    <header className="sticky top-0 z-20 flex min-h-14 flex-shrink-0 items-center justify-between gap-2 border-b border-slate-700/60 bg-[#0b1424]/95 px-2 py-2 backdrop-blur light:border-[#e7ebf2] light:bg-white/95 sm:px-4 md:px-5">
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
        <button
          onClick={() => window.dispatchEvent(new Event("dashboard-sidebar-toggle"))}
          aria-label="Toggle sidebar"
          title="Toggle sidebar"
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 light:hover:bg-slate-100 hover:text-white light:hover:text-slate-900 sm:h-10 sm:w-10"
        >
          <Menu className="h-4 w-4" />
        </button>
        <h1 className="max-w-[30vw] truncate text-sm font-bold text-white light:text-[#111b31] sm:max-w-none">{title}</h1>
      </div>

      <div className="flex flex-shrink-0 items-center gap-0.5 sm:gap-2">
        <div className="relative hidden md:block">
          <form onSubmit={handleSearch}>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setSearchMessage("");
              }}
              aria-label="Search dashboard"
              placeholder="Search..."
              className="h-8 w-40 rounded-lg border border-slate-700 light:border-[#e3e8f0] bg-slate-900/70 light:bg-[#fbfcfe] pl-8 pr-3 text-[11px] text-white light:text-slate-800 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 lg:w-48"
            />
          </form>
          {searchMessage && (
            <div className="absolute right-0 top-10 w-64 rounded-lg border border-slate-700 light:border-[#e3e8f0] bg-slate-900 light:bg-white px-3 py-2 text-[10px] text-slate-300 light:text-slate-600 shadow-xl">
              {searchMessage}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setNotificationsOpen((current) => !current)}
            aria-label="Notifications"
            title="Notifications"
            className="relative flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 light:hover:bg-slate-100 hover:text-white light:hover:text-slate-900 sm:h-9 sm:w-9"
          >
            <Bell className="h-4 w-4" />
          </button>
          {notificationsOpen && (
            <div className="absolute right-0 top-10 w-64 rounded-xl border border-slate-700 light:border-[#e3e8f0] bg-slate-900 light:bg-white p-4 shadow-xl">
              <p className="text-xs font-semibold text-white light:text-slate-900">Notifications</p>
              <p className="mt-2 text-[11px] leading-5 text-slate-400 light:text-slate-500">
                No new dashboard notifications.
              </p>
            </div>
          )}
        </div>

        <button
          onClick={toggleTheme}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 light:hover:bg-slate-100 hover:text-white light:hover:text-slate-900 sm:h-9 sm:w-9"
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4 text-amber-400" />
          ) : (
            <Sun className="h-4 w-4 text-amber-500" />
          )}
        </button>

        <div
          className="ml-1 hidden h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 to-violet-300 text-[9px] font-bold text-slate-800 ring-2 ring-white/10 light:ring-slate-100 sm:flex"
          title={user?.name ?? "Account"}
        >
          {user?.avatar || (user?.name ? user.name.split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() : "KM")}
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
