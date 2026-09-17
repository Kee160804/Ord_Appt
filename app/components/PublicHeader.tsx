"use client";

import Link from "next/link";
import { Moon, Sparkles, Sun } from "lucide-react";

import { useTheme } from "@/app/contexts/theme";

interface PublicHeaderProps {
  ctaHref?: string;
  ctaLabel?: string;
  showSignIn?: boolean;
}

const NAV_ITEMS = [
  { href: "/home", label: "Home" },
  { href: "/home#features", label: "Features" },
  { href: "/home#demos", label: "Live Demos" },
  { href: "/home#pricing", label: "Pricing" },
];

/** Shared navigation for every public YuhBusiness page. */
export function PublicHeader({
  ctaHref = "/register",
  ctaLabel = "Get Started Free",
  showSignIn = false,
}: PublicHeaderProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="site-header sticky top-0 z-50 shrink-0 border-b border-white/10 bg-[#070b14]/95 backdrop-blur-xl light:border-slate-200 light:bg-white/95">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
        <Link
          href="/home"
          className="group flex min-w-0 shrink-0 items-center gap-3"
          aria-label="YuhBusiness home"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-violet-400/50 bg-linear-to-br from-violet-500 to-purple-700 text-white shadow-[0_10px_30px_rgba(124,58,237,0.35)] transition group-hover:scale-105">
            <Sparkles className="h-5 w-5" />
          </span>
          <span className="whitespace-nowrap text-xl font-black tracking-tight text-white light:text-slate-950">
            Yuh<span className="text-violet-500">Business</span>
          </span>
        </Link>

        <nav
          className="hidden items-center gap-9 text-sm font-semibold text-[#9aa9bf] lg:flex light:text-slate-600"
          aria-label="Public navigation"
        >
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition hover:text-white light:hover:text-slate-950"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {showSignIn && (
            <Link
              href="/login"
              className="hidden text-sm font-bold text-[#aab7ca] transition hover:text-white sm:inline-flex light:text-slate-600 light:hover:text-slate-950"
            >
              Sign In
            </Link>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-11 min-w-11 items-center justify-center gap-1 rounded-2xl border border-[#2a3952] bg-[#0d1728] px-2.5 text-[#aab7ca] transition hover:border-violet-400 hover:text-white light:border-slate-300 light:bg-slate-50 light:text-slate-600"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            <Sun className="h-4 w-4" />
            <span className="hidden h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-slate-700 sm:flex dark:bg-white dark:text-slate-900">
              <Moon className="h-3.5 w-3.5" />
            </span>
          </button>
          <Link
            href={ctaHref}
            className={`inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-xl bg-linear-to-r from-violet-600 to-purple-600 px-4 text-xs font-black text-white shadow-[0_10px_28px_rgba(124,58,237,0.28)] transition hover:brightness-110 sm:px-6 sm:text-sm ${showSignIn ? "pwa-combined-primary-cta" : ""}`}
          >
            {ctaLabel}
          </Link>
        </div>
      </div>

      {showSignIn && (
        <div className="pwa-public-actions mx-auto w-full max-w-7xl grid-cols-2 gap-2 pt-3">
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#33445f] bg-[#0d1728] px-4 text-sm font-bold text-white transition hover:border-violet-400 light:border-slate-300 light:bg-white light:text-slate-800"
          >
            Sign In
          </Link>
          <Link
            href={ctaHref}
            className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-xl bg-linear-to-r from-violet-600 to-purple-600 px-4 text-sm font-black text-white shadow-[0_10px_28px_rgba(124,58,237,0.28)] transition hover:brightness-110"
          >
            {ctaLabel}
          </Link>
        </div>
      )}
    </header>
  );
}
