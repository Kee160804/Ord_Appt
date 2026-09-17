"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Eye,
  EyeOff,
  Heart,
  Mail,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Zap,
} from "lucide-react";

import { PublicHeader } from "@/app/components/PublicHeader";
import { useAuth } from "@/app/contexts/auth";

/** Only permit redirects to routes within this YuhBusiness deployment. */
function getSafeInternalPath(value: string | null): string | null {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return null;
  }

  try {
    const resolved = new URL(value, window.location.origin);
    if (resolved.origin !== window.location.origin) return null;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return null;
  }
}

const BUSINESS_CARDS = [
  {
    title: "Restaurants",
    description: "Order for pickup or delivery",
    image:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=700&q=80",
    icon: ShoppingBag,
    accent: "from-orange-500 to-amber-600",
  },
  {
    title: "Salons & Studios",
    description: "Book appointments in minutes",
    image:
      "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=700&q=80",
    icon: CalendarDays,
    accent: "from-violet-500 to-purple-700",
  },
  {
    title: "Retail Stores",
    description: "Sell products online 24/7",
    image:
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=700&q=80",
    icon: Store,
    accent: "from-emerald-500 to-teal-700",
  },
];

const PLATFORM_FEATURES = [
  { title: "Quick Setup", description: "Get online in minutes", icon: Zap },
  {
    title: "Secure & Reliable",
    description: "Your data is safe",
    icon: ShieldCheck,
  },
  {
    title: "Built for Growth",
    description: "Reach more customers",
    icon: BarChart3,
  },
  {
    title: "Local Support",
    description: "Real people. Real help.",
    icon: Heart,
  },
];

export default function LoginPage() {
  const { login, isLoading: isAuthLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const params = new URLSearchParams(window.location.search);
      const queryError = params.get("error");
      if (queryError) setError(queryError);
      if (params.get("confirmed") === "1") {
        setNotice("Email confirmed successfully. You can now sign in.");
      }
      if (params.get("passwordUpdated") === "1") {
        setNotice("Your password was updated. Sign in with your new password.");
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const handleLogin = async () => {
    if (loading || isAuthLoading) return;
    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }

    setError("");
    setLoading(true);
    const result = await login(email, password, rememberMe);
    setLoading(false);

    if (!result.success) {
      setError(result.error ?? "Login failed.");
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const safeNextPath = getSafeInternalPath(params.get("next"));

    if (result.user?.role === "superadmin") {
      const adminDestination =
        safeNextPath === "/admin" || safeNextPath?.startsWith("/admin/")
          ? safeNextPath
          : "/admin";
      window.location.replace(adminDestination);
      return;
    }

    // Full navigation makes the new Supabase cookies available to the route
    // proxy immediately, preventing mobile/PWA authentication redirect loops.
    const dashboardDestination =
      safeNextPath === "/dashboard" || safeNextPath?.startsWith("/dashboard/")
        ? safeNextPath
        : "/dashboard";
    window.location.replace(dashboardDestination);
  };

  const submitOnEnter = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !isAuthLoading && !loading) {
      void handleLogin();
    }
  };

  return (
    <div className="min-h-dvh bg-[#070b14] text-white transition-colors light:bg-white light:text-slate-950">
      <PublicHeader />

      <main className="relative grid min-h-[calc(100dvh-85px)] overflow-hidden lg:grid-cols-[minmax(0,1.05fr)_minmax(520px,0.95fr)]">
        <section className="relative hidden overflow-hidden border-r border-[#1b2940] px-8 py-12 lg:block xl:px-14 xl:py-14 light:border-slate-200 light:bg-slate-50">
          <span className="pointer-events-none absolute -left-28 -top-28 h-72 w-72 rounded-full bg-violet-700/25 blur-3xl" />
          <span className="pointer-events-none absolute -bottom-36 right-6 h-80 w-80 rounded-full bg-indigo-800/20 blur-3xl" />

          <div className="relative mx-auto max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#334766] bg-[#0d1829]/80 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#9fb2ce] light:border-slate-300 light:bg-white light:text-slate-600">
              <Store className="h-3.5 w-3.5 text-violet-400" />
              For local business owners
            </div>

            <h1 className="mt-6 text-4xl font-black leading-[1.08] tracking-tight text-white xl:text-5xl light:text-slate-950">
              Your Business Online.
              <br />
              <span className="text-violet-500">Made Simple.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#9aabc3] xl:text-lg light:text-slate-600">
              Join thousands of local business owners using YuhBusiness to
              accept bookings and orders, manage their business, and grow online
              — without building a website.
            </p>

            <div className="mt-7 grid grid-cols-4 gap-4">
              {PLATFORM_FEATURES.map(({ title, description, icon: Icon }) => (
                <div key={title} className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-violet-500/15 text-violet-300 ring-1 ring-violet-400/15">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-xs font-black text-white light:text-slate-950">
                      {title}
                    </p>
                    <p className="mt-1 text-[10px] leading-4 text-[#8292aa] light:text-slate-500">
                      {description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 grid grid-cols-3 gap-4">
              {BUSINESS_CARDS.map(
                ({ title, description, image, icon: Icon, accent }) => (
                  <article
                    key={title}
                    className="overflow-hidden rounded-2xl border border-[#2a3b56] bg-[#0b1525] shadow-xl light:border-slate-200 light:bg-white"
                  >
                    <div className="relative h-36 overflow-hidden bg-[#142138]">
                      <Image
                        src={image}
                        alt=""
                        fill
                        sizes="220px"
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                    <div className="flex gap-3 p-3.5">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br ${accent} text-white shadow-lg`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-black text-white light:text-slate-950">
                          {title}
                        </p>
                        <p className="mt-1 text-[10px] leading-4 text-[#8fa0b9] light:text-slate-500">
                          {description}
                        </p>
                      </div>
                    </div>
                  </article>
                ),
              )}
            </div>

            <blockquote className="mt-8 text-sm italic leading-6 text-[#8fa4c3] light:text-slate-500">
              “YuhBusiness made it so easy to get my business online.
              <br /> Now I can focus on what I love.”
              <br />
              <span className="mt-2 block not-italic">
                — Local Business Owner
              </span>
            </blockquote>
          </div>
        </section>

        <section className="relative flex items-center justify-center px-4 py-8 sm:px-8 lg:px-10">
          <span className="pointer-events-none absolute right-0 top-1/4 h-80 w-80 rounded-full bg-violet-700/10 blur-3xl" />
          <div className="relative w-full max-w-2xl rounded-3xl border border-[#2b3c58] bg-[linear-gradient(145deg,rgba(15,28,48,0.94),rgba(7,15,27,0.96))] p-5 shadow-[0_30px_100px_rgba(0,0,0,0.38)] sm:p-8 lg:p-9 light:border-slate-200 light:bg-white">
            <div className="mb-7 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-purple-700 text-white shadow-lg shadow-violet-900/30">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <p className="text-lg font-black text-white light:text-slate-950">
                  Yuh<span className="text-violet-500">Business</span>
                </p>
                <p className="text-[10px] text-[#8292aa] light:text-slate-500">
                  Built for Local Business Owners
                </p>
              </div>
            </div>
            <h2 className="text-3xl font-black tracking-tight text-white light:text-slate-950">
              Welcome back
            </h2>
            <p className="mt-2 text-base text-[#9aabc3] light:text-slate-600">
              Sign in to your YuhBusiness account
            </p>

            <div className="mt-7 space-y-5">
              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300 light:text-red-700"
                >
                  {error}
                </div>
              )}
              {notice && (
                <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm font-medium text-violet-200 light:text-violet-700">
                  {notice}
                </div>
              )}

              <label className="block text-sm font-bold text-slate-200 light:text-slate-800">
                Email Address
                <span className="relative mt-2 block">
                  <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#71839e]" />
                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    onKeyDown={submitOnEnter}
                    disabled={isAuthLoading || loading}
                    placeholder="you@business.com"
                    className="w-full rounded-xl border border-[#3a4e6c] bg-[#17243a] py-3.5 pl-12 pr-4 text-sm font-medium text-white outline-none transition placeholder:text-[#6f819c] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 disabled:opacity-60 light:border-slate-300 light:bg-slate-50 light:text-slate-950"
                  />
                </span>
              </label>

              <label className="block text-sm font-bold text-slate-200 light:text-slate-800">
                Password
                <span className="relative mt-2 block">
                  <ShieldCheck className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#71839e]" />
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    onKeyDown={submitOnEnter}
                    disabled={isAuthLoading || loading}
                    placeholder="Enter your password"
                    className="w-full rounded-xl border border-[#3a4e6c] bg-[#17243a] py-3.5 pl-12 pr-12 text-sm font-medium text-white outline-none transition placeholder:text-[#6f819c] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 disabled:opacity-60 light:border-slate-300 light:bg-slate-50 light:text-slate-950"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    aria-pressed={showPassword}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#71839e] transition hover:text-white light:hover:text-slate-950"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </span>
              </label>

              <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
                <label className="flex cursor-pointer items-center gap-2 font-medium text-[#9aabc3] light:text-slate-600">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                    className="h-4 w-4 rounded accent-violet-500"
                  />
                  Remember me
                </label>
                <Link
                  href="/forgot-password"
                  className="font-bold text-violet-400 transition hover:text-violet-300 light:text-violet-700"
                >
                  Forgot password?
                </Link>
              </div>

              <button
                type="button"
                onClick={() => void handleLogin()}
                disabled={loading || isAuthLoading}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-linear-to-r from-violet-600 via-purple-600 to-violet-600 py-4 text-sm font-black text-white shadow-[0_14px_35px_rgba(124,58,237,0.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading || isAuthLoading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    {loading ? "Signing in..." : "Preparing sign in..."}
                  </>
                ) : (
                  <>
                    Sign in <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>

            <p className="mt-7 text-center text-sm font-medium text-[#91a2ba] light:text-slate-600">
              New to YuhBusiness?{" "}
              <Link
                href="/register"
                className="font-black text-violet-400 hover:text-violet-300 light:text-violet-700"
              >
                Create your business <ArrowRight className="inline h-4 w-4" />
              </Link>
            </p>
            <p className="mt-5 text-center text-xs text-[#5e728f] light:text-slate-500">
              <Link href="/privacy" className="hover:text-violet-400">
                Privacy Policy
              </Link>{" "}
              ·{" "}
              <Link href="/terms" className="hover:text-violet-400">
                Terms of Service
              </Link>
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
