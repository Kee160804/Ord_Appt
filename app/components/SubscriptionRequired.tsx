"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CreditCard,
  LogOut,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  PLAN_DEFINITIONS,
  PLAN_ORDER,
  calculateSubscriptionAmounts,
} from "@/app/lib/plans";
import { startSubscriptionCheckout } from "@/app/services/billingService";
import type { PlanType } from "@/app/types";
import type { Tenant, User } from "@/app/types";
import { BusinessSwitcher } from "@/app/components/BusinessSwitcher";

const plans = PLAN_ORDER.map((planId) => ({
  ...PLAN_DEFINITIONS[planId],
  features: PLAN_DEFINITIONS[planId].shortFeatures,
  popular: planId === "pro",
}));

export function SubscriptionRequired({
  tenant,
  user,
  onLogout,
}: {
  tenant: Tenant;
  user: User;
  onLogout: () => Promise<void>;
}) {
  const [processingPlan, setProcessingPlan] = useState<PlanType | null>(null);
  const [seatSelections, setSeatSelections] = useState<
    Record<PlanType, number>
  >(
    () =>
      Object.fromEntries(
        PLAN_ORDER.map((planId) => {
          const definition = PLAN_DEFINITIONS[planId];
          const maximumPaidSeats =
            definition.maxStaffSeats - definition.includedStaffSeats;
          return [
            planId,
            Math.min(tenant.subscriptionPaidStaffSeats ?? 0, maximumPaidSeats),
          ];
        }),
      ) as Record<PlanType, number>,
  );
  const [error, setError] = useState("");
  const isOwner = user.role === "owner";

  const checkout = async (plan: PlanType) => {
    setProcessingPlan(plan);
    setError("");
    try {
      const result = await startSubscriptionCheckout(
        tenant.id,
        plan,
        seatSelections[plan],
      );
      if (result.status === "pending" && result.redirectUrl) {
        window.location.assign(result.redirectUrl);
        return;
      }
      window.location.reload();
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Unable to start subscription checkout.",
      );
      setProcessingPlan(null);
    }
  };

  return (
    <div className="pwa-page-roomy min-h-dvh bg-[#070b14] px-4 py-8 text-white light:bg-[#f6f8fc] light:text-slate-900 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/home" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-indigo-700 text-white">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="font-black">YuhBusiness</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-48 rounded-xl border border-slate-700 bg-slate-900 px-2 py-1 light:border-slate-300">
              <BusinessSwitcher tenant={tenant} />
            </div>
            <button
              onClick={() => void onLogout()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:border-slate-500 hover:text-white light:border-slate-300 light:text-slate-600 light:hover:text-slate-900"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </header>

        <section className="mx-auto max-w-2xl py-14 text-center sm:py-20">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-400">
            <CreditCard className="h-7 w-7" />
          </div>
          <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-violet-400">
            14-day trial complete
          </p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">
            Keep {tenant.name} growing
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-400 light:text-slate-600">
            Your free trial has ended, so dashboard access is paused. Your
            business data remains safely stored. Choose a monthly plan to
            restore access.
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Signed in as {user.email}
          </p>
        </section>

        <div className="grid gap-5 md:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.id}
              className={`relative flex flex-col rounded-3xl border bg-slate-900/70 p-6 light:bg-white ${plan.popular ? "border-violet-500 shadow-xl shadow-violet-950/20 light:border-violet-300 light:shadow-violet-100" : "border-slate-700 light:border-slate-200"}`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-violet-600 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white">
                  Best value
                </span>
              )}
              <h2 className="text-lg font-black">{plan.name}</h2>
              <p className="mt-2 min-h-10 text-xs leading-5 text-slate-400 light:text-slate-600">
                {plan.description}
              </p>
              <p className="mt-5">
                <span className="text-4xl font-black">${plan.price}</span>
                <span className="text-xs text-slate-500">
                  {" "}
                  BZD / month per business
                </span>
              </p>
              <ul className="my-6 space-y-3 text-xs text-slate-300 light:text-slate-700">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    {feature}
                  </li>
                ))}
              </ul>
              {plan.maxStaffSeats - plan.includedStaffSeats > 0 && (
                <label className="mb-4 block text-xs font-semibold">
                  Additional staff seats ($2 BZD each)
                  <select
                    value={seatSelections[plan.id]}
                    disabled={!isOwner || processingPlan !== null}
                    onChange={(event) =>
                      setSeatSelections((current) => ({
                        ...current,
                        [plan.id]: Number(event.target.value),
                      }))
                    }
                    className="mt-1.5 h-10 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 text-xs text-white light:border-slate-300 light:bg-white light:text-slate-900"
                  >
                    {Array.from(
                      {
                        length:
                          plan.maxStaffSeats - plan.includedStaffSeats + 1,
                      },
                      (_, count) => (
                        <option key={count} value={count}>
                          {count} paid seat{count === 1 ? "" : "s"}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              )}
              <button
                type="button"
                disabled={!isOwner || processingPlan !== null}
                onClick={() => void checkout(plan.id)}
                className={`mt-auto inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 ${plan.popular ? "bg-violet-600 hover:bg-violet-500" : "bg-slate-700 hover:bg-slate-600"}`}
              >
                {processingPlan === plan.id
                  ? "Opening checkout..."
                  : `Choose ${plan.name} · $${calculateSubscriptionAmounts(plan.id, seatSelections[plan.id]).recurringTotal} BZD/mo`}{" "}
                <ArrowRight className="h-4 w-4" />
              </button>
            </article>
          ))}
        </div>

        {error && (
          <p className="mx-auto mt-6 max-w-2xl rounded-xl bg-rose-500/10 p-3 text-center text-sm text-rose-300 light:text-rose-700">
            {error}
          </p>
        )}

        <div className="mx-auto mt-8 flex max-w-2xl items-start gap-3 rounded-2xl border border-slate-700 bg-slate-900/50 p-4 text-xs leading-5 text-slate-400 light:border-slate-200 light:bg-white light:text-slate-600">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <p>
            {isOwner
              ? "Secure checkout opens through the configured payment provider. Access is restored only after payment is confirmed."
              : "Only the business owner can purchase or change a subscription. Ask the owner to sign in and complete checkout."}
          </p>
        </div>
      </div>
    </div>
  );
}
