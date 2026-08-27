"use client";

import Link from "next/link";
import { ArrowRight, Check, CreditCard, LogOut, ShieldCheck, Sparkles } from "lucide-react";
import type { Tenant, User } from "@/app/types";

const plans = [
  {
    id: "beginner",
    name: "Beginner",
    price: 9,
    description: "The essentials for getting your business online.",
    checkoutUrl: process.env.NEXT_PUBLIC_BEGINNER_CHECKOUT_URL,
    features: ["Branded storefront", "Up to 50 monthly orders or bookings"],
  },
  {
    id: "pro",
    name: "Pro",
    price: 12,
    description: "Growth tools, analytics, inventory, and booking controls.",
    checkoutUrl: process.env.NEXT_PUBLIC_PRO_CHECKOUT_URL,
    features: ["Up to 250 monthly activities", "Analytics and advanced controls"],
    popular: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 16,
    description: "Unlimited activity and priority platform support.",
    checkoutUrl: process.env.NEXT_PUBLIC_ENTERPRISE_CHECKOUT_URL,
    features: ["Unlimited orders or appointments", "Priority onboarding and support"],
  },
];

export function SubscriptionRequired({
  tenant,
  user,
  onLogout,
}: {
  tenant: Tenant;
  user: User;
  onLogout: () => Promise<void>;
}) {
  const hasCheckout = plans.some((plan) => Boolean(plan.checkoutUrl));

  return (
    <div className="min-h-screen bg-[#070b14] px-4 py-8 text-white light:bg-[#f6f8fc] light:text-slate-900 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between gap-4">
          <Link href="/home" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-700 text-white"><Sparkles className="h-4 w-4" /></span>
            <span className="font-black">LocalSpace</span>
          </Link>
          <button onClick={() => void onLogout()} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:border-slate-500 hover:text-white light:border-slate-300 light:text-slate-600 light:hover:text-slate-900">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </header>

        <section className="mx-auto max-w-2xl py-14 text-center sm:py-20">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-400"><CreditCard className="h-7 w-7" /></div>
          <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-violet-400">14-day trial complete</p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">Keep {tenant.name} growing</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-400 light:text-slate-600">
            Your free trial has ended, so dashboard access is paused. Your business data remains safely stored. Choose a monthly plan to restore access.
          </p>
          <p className="mt-3 text-xs text-slate-500">Signed in as {user.email}</p>
        </section>

        <div className="grid gap-5 md:grid-cols-3">
          {plans.map((plan) => (
            <article key={plan.id} className={`relative flex flex-col rounded-3xl border bg-slate-900/70 p-6 light:bg-white ${plan.popular ? "border-violet-500 shadow-xl shadow-violet-950/20 light:border-violet-300 light:shadow-violet-100" : "border-slate-700 light:border-slate-200"}`}>
              {plan.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-violet-600 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white">Best value</span>}
              <h2 className="text-lg font-black">{plan.name}</h2>
              <p className="mt-2 min-h-10 text-xs leading-5 text-slate-400 light:text-slate-600">{plan.description}</p>
              <p className="mt-5"><span className="text-4xl font-black">${plan.price}</span><span className="text-xs text-slate-500"> USD / month</span></p>
              <ul className="my-6 space-y-3 text-xs text-slate-300 light:text-slate-700">
                {plan.features.map((feature) => <li key={feature} className="flex items-start gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />{feature}</li>)}
              </ul>
              {plan.checkoutUrl ? (
                <a href={plan.checkoutUrl} className={`mt-auto inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-bold text-white ${plan.popular ? "bg-violet-600 hover:bg-violet-500" : "bg-slate-700 hover:bg-slate-600"}`}>
                  Pay securely <ArrowRight className="h-4 w-4" />
                </a>
              ) : (
                <Link href="/home#pricing" className={`mt-auto inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-bold text-white ${plan.popular ? "bg-violet-600 hover:bg-violet-500" : "bg-slate-700 hover:bg-slate-600"}`}>
                  Choose {plan.name} <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </article>
          ))}
        </div>

        <div className="mx-auto mt-8 flex max-w-2xl items-start gap-3 rounded-2xl border border-slate-700 bg-slate-900/50 p-4 text-xs leading-5 text-slate-400 light:border-slate-200 light:bg-white light:text-slate-600">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <p>{hasCheckout ? "Secure checkout opens through the configured payment provider. Access is restored after the payment is confirmed." : "Online checkout links have not been configured yet. Review the plans, then contact the platform administrator to arrange payment and restore access."}</p>
        </div>
      </div>
    </div>
  );
}

