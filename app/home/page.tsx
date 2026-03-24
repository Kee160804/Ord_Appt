"use client";

import Link from "next/link";
import {
  Sparkles,
  Calendar,
  ShoppingBag,
  ArrowRight,
  Check,
  Zap,
  Shield,
  Globe,
  BarChart3,
  Users,
  ChevronRight,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "@/app/contexts/theme";

export default function HomePage() {
  const { theme, toggleTheme } = useTheme();

  const features = [
    { icon: Calendar, title: "Smart Scheduling", desc: "Appointment booking with automatic confirmations, deposits, and reminders." },
    { icon: ShoppingBag, title: "Online Ordering", desc: "Let customers order products and services directly from your business page." },
    { icon: BarChart3, title: "Real-Time Analytics", desc: "Track revenue, bookings, and customer trends all in one dashboard." },
    { icon: Globe, title: "Your Own Storefront", desc: "Each business gets a branded public page — no coding required." },
    { icon: Shield, title: "Secure Payments", desc: "Stripe-powered payments with deposit support and payout tracking." },
    { icon: Users, title: "Team Management", desc: "Add staff, assign roles, and manage your whole team from one place." },
  ];

  const plans = [
    {
      name: "Starter",
      price: "$29",
      period: "/mo",
      color: "border-slate-600 light:border-gray-200",
      badge: null,
      features: ["1 business location", "Up to 50 bookings/mo", "Basic storefront", "Email support"],
    },
    {
      name: "Pro",
      price: "$79",
      period: "/mo",
      color: "border-violet-500 light:border-violet-300",
      badge: "Most Popular",
      features: ["1 business location", "Unlimited bookings", "Custom domain", "Analytics dashboard", "Priority support", "Stripe payouts"],
    },
    {
      name: "Enterprise",
      price: "$199",
      period: "/mo",
      color: "border-slate-600 light:border-gray-200",
      badge: null,
      features: ["Multiple locations", "Unlimited everything", "White-label option", "Dedicated support", "Custom integrations"],
    },
  ];

  const demos = [
    { name: "Luxe Beauty Studio", slug: "luxe-beauty", type: "Appointments", emoji: "💅", color: "#c084fc", city: "Miami, FL" },
    { name: "Iron Edge Barbershop", slug: "iron-edge", type: "Appointments", emoji: "💈", color: "#34d399", city: "Atlanta, GA" },
    { name: "Ember & Oak Kitchen", slug: "ember-oak", type: "Ordering", emoji: "🔥", color: "#fb923c", city: "Austin, TX" },
    { name: "Blossom Bakehouse", slug: "blossom-bakehouse", type: "Ordering", emoji: "🥐", color: "#f472b6", city: "Portland, OR" },
  ];

  return (
    <div className="min-h-screen bg-[#070b14] light:bg-white text-white light:text-gray-900 transition-colors">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 md:px-12 py-5 border-b border-white/5 light:border-gray-200 sticky top-0 z-50 bg-[#070b14]/90 light:bg-white/90 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-900/40 light:shadow-violet-500/30">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-black text-white light:text-gray-900 text-lg tracking-tight">LocalSpace</span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400 light:text-gray-600">
          <Link href="/" className="hover:text-white light:hover:text-gray-900 transition-colors">
            Home
          </Link>
          <a href="#features" className="hover:text-white light:hover:text-gray-900 transition-colors">
            Features
          </a>
          <a href="#pricing" className="hover:text-white light:hover:text-gray-900 transition-colors">
            Pricing
          </a>
          <a href="#demos" className="hover:text-white light:hover:text-gray-900 transition-colors">
            Live Demos
          </a>
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
          <Link
            href="/register"
            className="text-sm font-bold text-white bg-violet-600 hover:bg-violet-500 light:bg-violet-600 light:hover:bg-violet-700 px-4 py-2 rounded-xl transition-colors shadow-sm shadow-violet-900/30 light:shadow-violet-600/30"
          >
            Get Started Free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative max-w-6xl mx-auto px-6 md:px-12 pt-24 pb-20 text-center overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-violet-600/10 light:bg-violet-500/5 rounded-full blur-3xl" />
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-violet-500/10 light:bg-violet-100 border border-violet-500/20 light:border-violet-200 text-violet-300 light:text-violet-700 text-xs font-bold rounded-full mb-8">
          <Zap className="w-3 h-3" /> The all-in-one platform for local businesses
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white light:text-gray-900 leading-[1.05] tracking-tight mb-6">
          Your business.<br />
          <span className="bg-gradient-to-r from-violet-400 to-indigo-400 light:from-violet-600 light:to-indigo-600 bg-clip-text text-transparent">
            Online in minutes.
          </span>
        </h1>

        <p className="text-xl text-slate-400 light:text-gray-600 max-w-2xl mx-auto leading-relaxed mb-10">
          Give your business a professional online presence. Accept bookings, take orders, and manage
          everything from one powerful dashboard.
        </p>

        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-8 py-4 bg-violet-600 hover:bg-violet-500 light:bg-violet-600 light:hover:bg-violet-700 text-white font-bold rounded-2xl transition-colors shadow-lg shadow-violet-900/30 light:shadow-violet-600/30 text-base"
          >
            Start free trial <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-8 py-4 border border-white/10 light:border-gray-300 hover:border-white/20 light:hover:border-gray-400 text-slate-300 light:text-gray-700 hover:text-white light:hover:text-gray-900 font-bold rounded-2xl transition-colors text-base"
          >
            View Demo Dashboard
          </Link>
        </div>

        <p className="text-sm text-slate-600 light:text-gray-500 mt-5">No credit card required · 14-day free trial</p>
      </section>

      {/* Business Types */}
      <section className="max-w-6xl mx-auto px-6 md:px-12 pb-24">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Appointment card */}
          <div className="bg-violet-900/20 light:bg-violet-50 border border-violet-500/20 light:border-violet-200 rounded-3xl p-8 hover:border-violet-500/40 light:hover:border-violet-300 transition-colors">
            <div className="w-12 h-12 bg-violet-500/20 light:bg-violet-100 rounded-2xl flex items-center justify-center mb-5">
              <Calendar className="w-6 h-6 text-violet-400 light:text-violet-600" />
            </div>
            <h3 className="text-xl font-black text-white light:text-gray-900 mb-2">Appointment Businesses</h3>
            <p className="text-slate-400 light:text-gray-600 text-sm mb-5">
              Let clients book your services 24/7. Manage your calendar, deposits, and confirmations effortlessly.
            </p>
            <div className="flex flex-wrap gap-2">
              {["Hair Salons", "Barbershops", "Med Spas", "Yoga Studios", "Consultants", "Personal Trainers"].map((e) => (
                <span
                  key={e}
                  className="text-xs font-semibold px-3 py-1.5 bg-violet-500/10 light:bg-violet-100 border border-violet-500/20 light:border-violet-200 rounded-full text-violet-300 light:text-violet-700"
                >
                  {e}
                </span>
              ))}
            </div>
          </div>

          {/* Ordering card */}
          <div className="bg-orange-900/20 light:bg-orange-50 border border-orange-500/20 light:border-orange-200 rounded-3xl p-8 hover:border-orange-500/40 light:hover:border-orange-300 transition-colors">
            <div className="w-12 h-12 bg-orange-500/20 light:bg-orange-100 rounded-2xl flex items-center justify-center mb-5">
              <ShoppingBag className="w-6 h-6 text-orange-400 light:text-orange-600" />
            </div>
            <h3 className="text-xl font-black text-white light:text-gray-900 mb-2">Ordering Businesses</h3>
            <p className="text-slate-400 light:text-gray-600 text-sm mb-5">
              Take orders online for pickup or delivery. Manage your menu, inventory, and fulfilment all in one place.
            </p>
            <div className="flex flex-wrap gap-2">
              {["Restaurants", "Bakeries", "Cafes", "Food Trucks", "Catering", "Specialty Shops"].map((e) => (
                <span
                  key={e}
                  className="text-xs font-semibold px-3 py-1.5 bg-orange-500/10 light:bg-orange-100 border border-orange-500/20 light:border-orange-200 rounded-full text-orange-300 light:text-orange-700"
                >
                  {e}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-slate-900/40 light:bg-gray-50 border-y border-white/5 light:border-gray-200 py-24">
        <div className="max-w-6xl mx-auto px-6 md:px-12">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-white light:text-gray-900 mb-3">Everything your business needs</h2>
            <p className="text-slate-400 light:text-gray-600 text-lg">All the tools. One platform. Zero setup headaches.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="bg-slate-800/50 light:bg-white border border-slate-700/50 light:border-gray-200 rounded-2xl p-6 hover:border-violet-500/30 light:hover:border-violet-300 hover:bg-slate-800 light:hover:bg-white transition-all group"
                >
                  <div className="w-10 h-10 bg-violet-500/10 light:bg-violet-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-violet-500/20 light:group-hover:bg-violet-200 transition-colors">
                    <Icon className="w-5 h-5 text-violet-400 light:text-violet-600" />
                  </div>
                  <h3 className="font-bold text-white light:text-gray-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-slate-400 light:text-gray-600 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Live Demos */}
      <section id="demos" className="py-24">
        <div className="max-w-6xl mx-auto px-6 md:px-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black text-white light:text-gray-900 mb-3">See it live</h2>
            <p className="text-slate-400 light:text-gray-600">Real business storefronts — built on LocalSpace</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {demos.map((d) => (
              <Link
                key={d.slug}
                href={`/store/${d.slug}`}
                className="bg-slate-800/60 light:bg-white border border-slate-700/50 light:border-gray-200 rounded-2xl p-5 hover:border-slate-500 light:hover:border-gray-300 hover:-translate-y-1 transition-all group text-center space-y-4"
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mx-auto shadow-lg light:shadow-sm"
                  style={{ backgroundColor: d.color + "30", border: `1px solid ${d.color}50` }}
                >
                  {d.emoji}
                </div>
                <div>
                  <p className="font-bold text-white light:text-gray-900 text-sm">{d.name}</p>
                  <p className="text-xs text-slate-500 light:text-gray-500 mt-0.5">{d.city}</p>
                </div>
                <span
                  className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full"
                  style={{ backgroundColor: d.color + "20", color: d.color }}
                >
                  {d.type}
                </span>
                <div className="flex items-center justify-center gap-1 text-xs text-slate-500 light:text-gray-500 group-hover:text-slate-300 light:group-hover:text-gray-700 transition-colors">
                  Visit store <ChevronRight className="w-3 h-3" />
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm text-violet-400 light:text-violet-600 hover:text-violet-300 light:hover:text-violet-700 font-semibold transition-colors"
            >
              Log in to see the owner dashboard <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-slate-900/40 light:bg-gray-50 border-y border-white/5 light:border-gray-200 py-24">
        <div className="max-w-5xl mx-auto px-6 md:px-12">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-white light:text-gray-900 mb-3">Simple, transparent pricing</h2>
            <p className="text-slate-400 light:text-gray-600">Start free. Scale as you grow. Cancel anytime.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 items-start">
            {plans.map((p) => (
              <div
                key={p.name}
                className={`relative bg-slate-800/60 light:bg-white border-2 ${p.color} rounded-3xl p-8 ${p.badge ? "md:-mt-4 md:pb-12" : ""}`}
              >
                {p.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-violet-600 text-white text-xs font-bold rounded-full whitespace-nowrap">
                    {p.badge}
                  </div>
                )}
                <p className="font-bold text-slate-400 light:text-gray-500 text-sm mb-2">{p.name}</p>
                <div className="flex items-end gap-1 mb-6">
                  <span className="text-4xl font-black text-white light:text-gray-900">{p.price}</span>
                  <span className="text-slate-500 light:text-gray-500 text-sm mb-1">{p.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm text-slate-300 light:text-gray-700">
                      <div className="w-4 h-4 bg-emerald-500/20 light:bg-emerald-100 border border-emerald-500/30 light:border-emerald-300 rounded-full flex items-center justify-center flex-shrink-0">
                        <Check className="w-2.5 h-2.5 text-emerald-400 light:text-emerald-600" />
                      </div>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className={`block text-center py-3 rounded-xl font-bold text-sm transition-colors ${
                    p.badge
                      ? "bg-violet-600 hover:bg-violet-500 light:bg-violet-600 light:hover:bg-violet-700 text-white"
                      : "bg-slate-700 light:bg-gray-200 hover:bg-slate-600 light:hover:bg-gray-300 text-white light:text-gray-900"
                  }`}
                >
                  Get started
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-6 md:px-12">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            {[
              { value: "2,400+", label: "Businesses onboarded" },
              { value: "$4.2M", label: "Processed monthly" },
              { value: "98%", label: "Satisfaction rate" },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-4xl font-black text-white light:text-gray-900 mb-2">{s.value}</p>
                <p className="text-slate-400 light:text-gray-600 text-sm">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-violet-900/40 to-indigo-900/40 light:from-violet-100 light:to-indigo-100 border-y border-violet-500/20 light:border-violet-200">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-black text-white light:text-gray-900 mb-4">Ready to grow your business?</h2>
          <p className="text-slate-400 light:text-gray-600 mb-8">Join thousands of local businesses already using LocalSpace.</p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-8 py-4 bg-violet-600 hover:bg-violet-500 light:bg-violet-600 light:hover:bg-violet-700 text-white font-bold rounded-2xl transition-colors shadow-lg shadow-violet-900/30 light:shadow-violet-600/30"
          >
            Create your free account <ArrowRight className="w-5 h-5" />
          </Link>
          <div className="flex items-center justify-center gap-6 mt-8 text-sm text-slate-500 light:text-gray-600">
            {["No credit card", "14-day free trial", "Cancel anytime"].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500 light:text-emerald-600" /> {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 light:border-gray-200 py-10 px-6 md:px-12">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-black text-white light:text-gray-900">LocalSpace</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-500 light:text-gray-600">
            <Link href="/login" className="hover:text-slate-300 light:hover:text-gray-900 transition-colors">
              Sign In
            </Link>
            <Link href="/register" className="hover:text-slate-300 light:hover:text-gray-900 transition-colors">
              Register
            </Link>
            <Link href="/dashboard" className="hover:text-slate-300 light:hover:text-gray-900 transition-colors">
              Dashboard
            </Link>
            <Link href="/admin" className="hover:text-slate-300 light:hover:text-gray-900 transition-colors">
              Admin
            </Link>
            <span>© 2025 LocalSpace Platform</span>
          </div>
        </div>
      </footer>
    </div>
  );
}