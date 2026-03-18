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
  const { theme, toggleTheme } = useTheme();
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
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-900/40 light:shadow-violet-500/30">
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
            aria-label="Toggle theme"
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
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-14 relative overflow-hidden bg-gradient-to-br from-[#0d1020] to-[#0a0f1a] light:from-gray-100 light:to-gray-50 border-r border-white/5 light:border-gray-200">
          <div className="absolute top-0 left-0 w-full h-full -z-10">
            <div className="absolute top-20 left-20 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
            <div className="absolute bottom-20 right-10 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl" />
          </div>
          <div className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-4xl font-black text-white light:text-gray-900 leading-tight">
                Your business.<br />Your storefront.<br />
                <span className="bg-gradient-to-r from-violet-400 to-indigo-400 light:from-violet-600 light:to-indigo-600 bg-clip-text text-transparent">Your way.</span>
              </h2>
              <p className="text-slate-400 light:text-gray-600 leading-relaxed max-w-sm">
                Thousands of local businesses use LocalSpace to accept bookings and orders online — without building a website.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {["💅 Nail Salons", "💈 Barbershops", "🍕 Restaurants", "🥐 Bakeries", "🧘 Yoga Studios", "☕ Cafes"].map(e => (
                <div key={e} className="flex items-center gap-2 bg-white/5 light:bg-gray-100 border border-white/5 light:border-gray-200 rounded-xl px-3 py-2.5 text-sm text-slate-300 light:text-gray-700">
                  {e}
                </div>
              ))}
            </div>
          </div>
          <p className="text-slate-600 light:text-gray-500 text-sm">© 2025 LocalSpace Platform</p>
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
              <p className="text-slate-500 light:text-gray-600 text-sm mt-1">Sign in to your business dashboard</p>
            </div>

            <div className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-900/20 light:bg-red-50 border border-red-500/30 light:border-red-200 rounded-xl text-red-400 light:text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300 light:text-gray-700">Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLogin()}
                  placeholder="you@business.com"
                  className="w-full px-4 py-2.5 text-sm border border-slate-600 light:border-gray-300 rounded-xl bg-slate-800/50 light:bg-white text-white light:text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition placeholder:text-slate-600 light:placeholder:text-gray-400" />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300 light:text-gray-700">Password</label>
                <div className="relative">
                  <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleLogin()}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 pr-10 text-sm border border-slate-600 light:border-gray-300 rounded-xl bg-slate-800/50 light:bg-white text-white light:text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition placeholder:text-slate-600 light:placeholder:text-gray-400" />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 light:text-gray-500 hover:text-slate-300 light:hover:text-gray-700 transition-colors">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-slate-400 light:text-gray-600 cursor-pointer">
                  <input type="checkbox" defaultChecked className="w-4 h-4 accent-violet-500 rounded" /> Remember me
                </label>
                <button className="text-violet-400 light:text-violet-600 hover:text-violet-300 light:hover:text-violet-700 font-semibold transition-colors">Forgot password?</button>
              </div>

              <button onClick={handleLogin} disabled={loading}
                className="w-full py-3 bg-violet-600 hover:bg-violet-500 light:bg-violet-600 light:hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-violet-900/30 light:shadow-violet-600/30">
                {loading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Signing in...</> : "Sign In"}
              </button>
            </div>

            <p className="text-center text-sm text-slate-500 light:text-gray-600">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="text-violet-400 light:text-violet-600 font-bold hover:text-violet-300 light:hover:text-violet-700 transition-colors">Create one free</Link>
            </p>

            {/* Demo accounts */}
            <div className="p-4 bg-slate-800/50 light:bg-gray-100 rounded-2xl border border-slate-700/50 light:border-gray-200 space-y-3">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-slate-500 light:text-gray-500 uppercase tracking-widest">Quick Demo Access</p>
              </div>
              <div className="space-y-1.5">
                {demoAccounts.map(acc => (
                  <button key={acc.email} onClick={() => quickLogin(acc)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-700/50 light:hover:bg-gray-200 transition-colors text-left group">
                    {acc.role === "superadmin"
                      ? <div className="w-7 h-7 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0"><Shield className="w-3.5 h-3.5 text-violet-400 light:text-violet-600" /></div>
                      : <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                          style={{ backgroundColor: acc.tenantId === "apt-001" ? "#c084fc30" : acc.tenantId === "apt-002" ? "#34d39930" : acc.tenantId === "ord-001" ? "#fb923c30" : "#f472b630", border: `1px solid ${acc.tenantId === "apt-001" ? "#c084fc50" : acc.tenantId === "apt-002" ? "#34d39950" : acc.tenantId === "ord-001" ? "#fb923c50" : "#f472b650"}` }}>
                          {acc.email[0].toUpperCase()}
                        </div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-300 light:text-gray-700 truncate">{acc.label}</p>
                      <p className="text-[10px] text-slate-600 light:text-gray-500 truncate">{acc.email}</p>
                    </div>
                    <span className="text-[10px] text-slate-600 light:text-gray-500 group-hover:text-violet-400 light:group-hover:text-violet-600 font-medium transition-colors">Click to login</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}