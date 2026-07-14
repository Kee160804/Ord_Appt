"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Eye, EyeOff, AlertCircle, Shield, Sun, Moon } from "lucide-react";
import { useAuth } from "@/app/contexts/auth";
import { useTheme } from "@/app/contexts/theme";
import { demoAccounts } from "../data/mock";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { theme, toggleTheme, demoTheme, toggleDemoTheme } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email) { setError("Please enter your email."); return; }
    setError("");
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (!result.success) { setError(result.error ?? "Login failed."); return; }
    const account = demoAccounts.find(a => a.email.toLowerCase() === email.toLowerCase());
    if (account?.role === "superadmin") router.push("/admin");
    else router.push("/dashboard");
  };

  const quickLogin = async (acc: typeof demoAccounts[0]) => {
    setEmail(acc.email);
    setError("");
    setLoading(true);
    const result = await login(acc.email, acc.password);
    setLoading(false);
    if (!result.success) { setError(result.error ?? "Login failed."); return; }
    if (acc.role === "superadmin") router.push("/admin");
    else router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-[#070b14] light:bg-white text-white light:text-gray-900">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 md:px-12 py-5 border-b border-white/5 light:border-gray-200 sticky top-0 z-50 bg-[#070b14]/90 light:bg-white/90 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-linear-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-900/40 light:shadow-violet-500/30">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-black text-white light:text-gray-900 text-lg tracking-tight">LocalSpace</span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium">
          {/* Home link - active */}
          <Link
            href="/"
            className="text-slate-400 light:text-gray-600 hover:text-white light:hover:text-gray-900 transition-colors"
          >
            Home
          </Link>

          {/* Disabled links */}
          <span className="text-slate-600 light:text-gray-400 cursor-not-allowed opacity-50 select-none pointer-events-none">
            Features
          </span>
          <span className="text-slate-600 light:text-gray-400 cursor-not-allowed opacity-50 select-none pointer-events-none">
            Pricing
          </span>
          <span className="text-slate-600 light:text-gray-400 cursor-not-allowed opacity-50 select-none pointer-events-none">
            Live Demos
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-400 light:text-gray-600 hover:bg-white/5 light:hover:bg-gray-100 transition-colors"
            aria-label="Toggle main theme"
            title="Toggle main theme"
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <Link
            href="/login"
            className="text-sm font-semibold text-slate-400 light:text-gray-600 hover:text-white light:hover:text-gray-900 px-4 py-2 rounded-xl hover:bg-white/5 light:hover:bg-gray-100 transition-colors"
          >
            Sign In
          </Link>

          {/* Disabled Get Started button */}
          <span className="text-sm font-bold text-white/50 light:text-gray-400 bg-violet-600/50 light:bg-violet-600/30 px-4 py-2 rounded-xl cursor-not-allowed select-none pointer-events-none shadow-sm">
            Get Started Free
          </span>
        </div>
      </nav>

      {/* Main content (two columns) */}
      <div className="flex flex-col lg:flex-row min-h-[calc(100vh-73px)]">
        {/* Left panel - hidden on mobile */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-14 relative overflow-hidden bg-linear-to-br from-[#0d1020] to-[#0a0f1a] light:from-gray-50 light:to-white border-r border-white/5 light:border-gray-200">
          <div className="absolute top-0 left-0 w-full h-full -z-10">
            <div className="absolute top-20 left-20 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
            <div className="absolute bottom-20 right-10 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl" />
          </div>
          <div className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-4xl font-black text-white light:text-gray-900 leading-tight">
                Your business.<br />Your storefront.<br />
                <span className="bg-linear-to-r from-violet-400 to-indigo-400 light:from-violet-600 light:to-indigo-600 bg-clip-text text-transparent">Your way.</span>
              </h2>
              <p className="text-slate-400 light:text-gray-700 leading-relaxed max-w-sm font-medium">
                Thousands of local businesses use LocalSpace to accept bookings and orders online — without building a website.
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
          <p className="text-slate-600 light:text-gray-600 text-sm font-medium">© 2025 LocalSpace Platform</p>
        </div>

        {/* Right form */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-sm space-y-7">
            {/* Mobile logo */}
            <div className="flex lg:hidden items-center gap-3 justify-center mb-6">
              <div className="w-9 h-9 bg-violet-600/20 border border-violet-500/30 rounded-xl flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-violet-400" />
              </div>
              <span className="font-black text-xl text-white light:text-gray-900">LocalSpace</span>
            </div>

            <div>
              <h1 className="text-2xl font-black text-white light:text-gray-900">Welcome back</h1>
              <p className="text-slate-500 light:text-gray-700 text-sm mt-1 font-medium">Sign in to your business dashboard</p>
            </div>

            <div className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-900/20 light:bg-red-50 border border-red-500/30 light:border-red-200 rounded-xl text-red-400 light:text-red-600 text-sm font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-300 light:text-gray-800">Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLogin()}
                  placeholder="you@business.com"
                  className="w-full px-4 py-2.5 text-sm border border-slate-600 light:border-gray-400 rounded-xl bg-slate-800/50 light:bg-gray-50 text-white light:text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition placeholder:text-slate-600 light:placeholder:text-gray-500" />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-300 light:text-gray-800">Password</label>
                <div className="relative">
                  <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleLogin()}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 pr-10 text-sm border border-slate-600 light:border-gray-400 rounded-xl bg-slate-800/50 light:bg-gray-50 text-white light:text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition placeholder:text-slate-600 light:placeholder:text-gray-500" />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 light:text-gray-600 hover:text-slate-300 light:hover:text-gray-800 transition-colors">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-slate-400 light:text-gray-700 cursor-pointer font-medium">
                  <input type="checkbox" defaultChecked className="w-4 h-4 accent-violet-500 rounded" /> Remember me
                </label>
                <button className="text-violet-400 light:text-violet-600 hover:text-violet-300 light:hover:text-violet-700 font-semibold transition-colors">Forgot password?</button>
              </div>

              <button onClick={handleLogin} disabled={loading}
                className="w-full py-3 bg-violet-600 hover:bg-violet-500 light:bg-violet-600 light:hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-violet-900/30 light:shadow-violet-600/30">
                {loading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Signing in...</> : "Sign In"}
              </button>
            </div>

            <p className="text-center text-sm text-slate-500 light:text-gray-700 font-medium">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="text-violet-400 light:text-violet-600 font-bold hover:text-violet-300 light:hover:text-violet-700 transition-colors">Create one free</Link>
            </p>

            {/* Live Demo Accounts Section */}
            <div
              className={`p-5 rounded-2xl border transition-all ${
                demoTheme === "dark"
                  ? "bg-slate-800/50 border-slate-700/50"
                  : "bg-linear-to-br from-gray-100 to-gray-50 border-gray-300"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <p className={`text-xs font-bold uppercase tracking-widest ${
                    demoTheme === "dark"
                      ? "text-slate-500"
                      : "text-gray-600"
                  }`}>
                    🎬 Live Demo Access
                  </p>
                </div>
                <button
                  onClick={toggleDemoTheme}
                  className={`p-1.5 rounded-lg transition-colors ${
                    demoTheme === "dark"
                      ? "text-slate-600 hover:bg-slate-700/50"
                      : "text-gray-600 hover:bg-gray-200"
                  }`}
                  aria-label="Toggle demo theme"
                  title="Toggle demo theme"
                >
                  {demoTheme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
              </div>
              <div className="space-y-1.5">
                {demoAccounts.map(acc => (
                  <button key={acc.email} onClick={() => quickLogin(acc)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left group ${
                      demoTheme === "dark"
                        ? "hover:bg-slate-700/50"
                        : "hover:bg-white border border-gray-200"
                    }`}
                  >
                    {acc.role === "superadmin"
                      ? <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${
                          demoTheme === "dark"
                            ? "bg-violet-600/20 border-violet-500/30"
                            : "bg-violet-100 border-violet-300"
                        }`}>
                          <Shield className={`w-3.5 h-3.5 ${
                            demoTheme === "dark"
                              ? "text-violet-400"
                              : "text-violet-600"
                          }`} />
                        </div>
                      : <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 border ${
                          acc.tenantId === "apt-001"
                            ? demoTheme === "dark"
                              ? "bg-purple-600/20 border-purple-500/30 text-purple-400"
                              : "bg-purple-100 border-purple-300 text-purple-700"
                            : acc.tenantId === "apt-002"
                            ? demoTheme === "dark"
                              ? "bg-green-600/20 border-green-500/30 text-green-400"
                              : "bg-green-100 border-green-300 text-green-700"
                            : acc.tenantId === "ord-001"
                            ? demoTheme === "dark"
                              ? "bg-orange-600/20 border-orange-500/30 text-orange-400"
                              : "bg-orange-100 border-orange-300 text-orange-700"
                            : demoTheme === "dark"
                            ? "bg-pink-600/20 border-pink-500/30 text-pink-400"
                            : "bg-pink-100 border-pink-300 text-pink-700"
                        }`}>
                          {acc.email[0].toUpperCase()}
                        </div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold truncate ${
                        demoTheme === "dark"
                          ? "text-slate-300"
                          : "text-gray-900"
                      }`}>{acc.label}</p>
                      <p className={`text-[10px] truncate ${
                        demoTheme === "dark"
                          ? "text-slate-600"
                          : "text-gray-600"
                      }`}>{acc.email}</p>
                    </div>
                    <span className={`text-[10px] font-medium transition-colors group-hover:text-violet-400 ${
                      demoTheme === "dark"
                        ? "text-slate-600 group-hover:text-violet-400"
                        : "text-gray-600 group-hover:text-violet-600"
                    }`}>Click to login</span>
                  </button>
                ))}
              </div>
              <p className={`text-[11px] mt-3 pt-3 border-t ${
                demoTheme === "dark"
                  ? "text-slate-600 border-slate-700/50"
                  : "text-gray-600 border-gray-200"
              }`}>
                Try any demo account to explore the platform
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}