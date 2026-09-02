"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Eye, EyeOff, AlertCircle, Sun, Moon } from "lucide-react";
import { useAuth } from "@/app/contexts/auth";
import { useTheme } from "@/app/contexts/theme";

export default function LoginPage() {
  const { login, isLoading: isAuthLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
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
    if (!email) { setError("Please enter your email."); return; }
    setError("");
    setLoading(true);
    const result = await login(email, password, rememberMe);
    setLoading(false);

    if (!result.success) {
      setError(result.error ?? "Login failed.");
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const nextPath = params.get("next");
    const safeNextPath = nextPath
      && nextPath.startsWith("/")
      && !nextPath.startsWith("//")
      && !nextPath.includes("\\")
      ? nextPath
      : null;

    if (result.user?.role === "superadmin") {
      const adminDestination = safeNextPath === "/admin" || safeNextPath?.startsWith("/admin/")
        ? safeNextPath
        : "/admin";
      window.location.replace(adminDestination);
      return;
    }

    // A full navigation guarantees that the Supabase auth cookies written by
    // signInWithPassword reach the server proxy before it evaluates the
    // protected dashboard route. This avoids a mobile/PWA redirect loop that
    // otherwise appears to resolve only after a manual refresh or tab switch.
    const dashboardDestination = safeNextPath === "/dashboard" || safeNextPath?.startsWith("/dashboard/")
      ? safeNextPath
      : "/dashboard";
    window.location.replace(dashboardDestination);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-[#070b14] text-white light:bg-white light:text-gray-900">
      {/* Navbar */}
      <nav className="site-header sticky top-0 z-50 flex flex-shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-2 border-b border-white/5 bg-[#070b14]/90 backdrop-blur-xl light:border-gray-200 light:bg-white/90 md:flex-nowrap">
        <div className="flex min-w-0 flex-shrink-0 items-center gap-2 sm:gap-2.5">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-900/40 light:shadow-violet-500/30 sm:h-8 sm:w-8">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="whitespace-nowrap text-[15px] font-black tracking-tight text-white light:text-gray-900 sm:text-lg">YuhBusiness</span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium">
          {/* Home link - active */}
          <Link
            href="/"
            className="text-slate-400 light:text-gray-600 hover:text-white light:hover:text-gray-900 transition-colors"
          >
            Home
          </Link>

          <Link href="/home#features" className="text-slate-400 light:text-gray-600 hover:text-white light:hover:text-gray-900 transition-colors">
            Features
          </Link>
          <Link href="/home#pricing" className="text-slate-400 light:text-gray-600 hover:text-white light:hover:text-gray-900 transition-colors">
            Pricing
          </Link>
          <Link href="/home#demos" className="text-slate-400 light:text-gray-600 hover:text-white light:hover:text-gray-900 transition-colors">
            Live Demos
          </Link>
        </div>

        <div className="contents md:flex md:min-w-0 md:flex-shrink-0 md:items-center md:gap-3">
          <button
            onClick={toggleTheme}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-transparent text-slate-400 transition-colors hover:bg-white/5 light:border-gray-300 light:text-gray-600 light:hover:bg-gray-100 md:h-10 md:w-10"
            aria-label="Toggle main theme"
            title="Toggle main theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4 sm:h-5 sm:w-5" /> : <Moon className="h-4 w-4 sm:h-5 sm:w-5" />}
          </button>

          <div className="order-last grid w-full grid-cols-2 gap-2 md:order-none md:flex md:w-auto md:items-center md:gap-3">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-xl border border-slate-700 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10 light:border-gray-300 light:bg-white light:text-gray-700 light:hover:bg-gray-100 md:hidden"
              aria-label="Back to home"
            >
              Home
            </Link>

            <Link
              href="/register"
              className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-violet-500 light:bg-violet-600 light:hover:bg-violet-700 md:min-h-0"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Main content (two columns) */}
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Left panel - hidden on mobile */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-14 relative overflow-hidden bg-linear-to-br from-[#0d1020] to-[#0a0f1a] light:from-gray-50 light:to-white border-r border-white/5 light:border-gray-200">
          <div className="absolute top-0 left-0 w-full h-full -z-10">
            <div className="absolute top-20 left-20 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
            <div className="absolute bottom-20 right-10 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl" />
          </div>
          <div className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-4xl font-black text-white light:text-gray-900 leading-tight">
                Find weh yuh need.<br /> Book it.<br />
                <span className="bg-linear-to-r from-violet-400 to-indigo-400 light:from-violet-600 light:to-indigo-600 bg-clip-text text-transparent">Order it.</span>
              </h2>
              <p className="text-slate-400 light:text-gray-700 leading-relaxed max-w-sm font-medium">
                Thousands of local businesses use YuhBusiness to accept bookings and orders online — without building a website.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {["💅 Nail Salons", "💈 Barbershops", "🍕 Restaurants", "🥐 Bakeries", "🧘 Yoga Studios", "☕ Cafes"].map(e => (
                <div key={e} className="flex items-center gap-2 bg-white/5 light:bg-gray-200 border border-white/5 light:border-gray-300 rounded-xl px-3 py-2.5 text-sm text-slate-300 light:text-gray-800 font-medium">
                  {e}
                </div>
              ))}
            </div>
          </div>
          <p className="text-slate-600 light:text-gray-600 text-sm font-medium">© 2025 YuhBusiness Platform</p>
        </div>

        {/* Right form */}
        <div className="flex flex-1 items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-sm space-y-7">
            {/* Mobile logo */}
            <div className="flex lg:hidden items-center gap-3 justify-center mb-6">
              <div className="w-9 h-9 bg-violet-600/20 border border-violet-500/30 rounded-xl flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-violet-400" />
              </div>
              <span className="font-black text-xl text-white light:text-gray-900">YuhBusiness</span>
            </div>

            <div>
              <h1 className="text-2xl font-black text-white light:text-gray-900">Welcome bak</h1>
              <p className="text-slate-500 light:text-gray-700 text-sm mt-1 font-medium">Sign in to your business dashboard</p>
            </div>

            <div className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-900/20 light:bg-red-50 border border-red-500/30 light:border-red-200 rounded-xl text-red-400 light:text-red-600 text-sm font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}
              {notice && (
                <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-3 text-sm font-medium text-violet-200 light:border-violet-200 light:bg-violet-50 light:text-violet-700">
                  {notice}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-300 light:text-gray-800">Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  disabled={isAuthLoading || loading}
                  onKeyDown={e => e.key === "Enter" && !isAuthLoading && !loading && handleLogin()}
                  placeholder="you@business.com"
                  className="w-full px-4 py-2.5 text-sm border border-slate-600 light:border-gray-400 rounded-xl bg-slate-800/50 light:bg-gray-50 text-white light:text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition placeholder:text-slate-600 light:placeholder:text-gray-500" />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-300 light:text-gray-800">Password</label>
                <div className="relative">
                  <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                    disabled={isAuthLoading || loading}
                    onKeyDown={e => e.key === "Enter" && !isAuthLoading && !loading && handleLogin()}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 pr-10 text-sm border border-slate-600 light:border-gray-400 rounded-xl bg-slate-800/50 light:bg-gray-50 text-white light:text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition placeholder:text-slate-600 light:placeholder:text-gray-500" />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 light:text-gray-600 hover:text-slate-300 light:hover:text-gray-800 transition-colors">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
                <label className="flex items-center gap-2 text-slate-400 light:text-gray-700 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                    className="w-4 h-4 accent-violet-500 rounded"
                  /> Remember me
                </label>
                <Link href="/forgot-password" className="text-violet-400 light:text-violet-600 hover:text-violet-300 light:hover:text-violet-700 font-semibold transition-colors">Forgot password?</Link>
              </div>

              <button onClick={handleLogin} disabled={loading || isAuthLoading}
                className="w-full py-3 bg-violet-600 hover:bg-violet-500 light:bg-violet-600 light:hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-violet-900/30 light:shadow-violet-600/30">
                {loading || isAuthLoading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {loading ? "Signing in..." : "Preparing sign in..."}</> : "Sign een"}
              </button>
            </div>

            <p className="text-center text-sm text-slate-500 light:text-gray-700 font-medium">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="text-violet-400 light:text-violet-600 font-bold hover:text-violet-300 light:hover:text-violet-700 transition-colors">Mek one free</Link>
            </p>

          </div>
        </div>
      </div>
    </div>
  );
}
