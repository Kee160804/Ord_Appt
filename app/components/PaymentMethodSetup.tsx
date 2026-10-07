"use client";

import { useId, useState } from "react";
import {
  CreditCard,
  Info,
  LockKeyhole,
  ShieldCheck,
  Smartphone,
  WalletCards,
} from "lucide-react";
import { formatCurrency } from "@/app/lib/utils";

export const PAYMENT_COMING_SOON_MESSAGE =
  "Payment integration coming soon for online payment";

type OnlinePaymentMethod = "digiwallet" | "card";

interface PaymentMethodSetupProps {
  amount: number;
  continueLabel?: string;
  description?: string;
}

export function PaymentMethodSetup({
  amount,
  continueLabel = "Continue to Payment",
  description = "Choose how you want to pay.",
}: PaymentMethodSetupProps) {
  const fieldId = useId();
  const [method, setMethod] = useState<OnlinePaymentMethod>("digiwallet");
  const [noticeOpen, setNoticeOpen] = useState(false);

  return (
    <section
      data-testid="online-payment-setup"
      className="overflow-hidden rounded-2xl border border-[#263651] bg-[#0b1728]/90 shadow-[0_18px_55px_rgba(2,6,23,0.22)] light:border-slate-200 light:bg-white"
    >
      <div className="flex items-center gap-3 border-b border-[#22324b] px-4 py-4 light:border-slate-200 sm:px-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-violet-700 text-white shadow-lg shadow-violet-950/30">
          <WalletCards className="h-5 w-5" />
        </span>
        <div>
          <h3 className="text-sm font-black text-white light:text-slate-950">
            Payment Method
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-400 light:text-slate-600">
            {description}
          </p>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div
          className="grid grid-cols-2 gap-2"
          role="radiogroup"
          aria-label="Online payment method"
        >
          <button
            type="button"
            role="radio"
            aria-checked={method === "digiwallet"}
            onClick={() => setMethod("digiwallet")}
            className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition ${
              method === "digiwallet"
                ? "border-violet-400 bg-violet-500/15 text-white shadow-[0_0_0_2px_rgba(139,92,246,0.18),0_0_24px_rgba(124,58,237,0.18)] light:text-violet-800"
                : "border-[#31425f] text-slate-300 hover:border-violet-400/70 light:border-slate-300 light:text-slate-700"
            }`}
          >
            <Smartphone className="h-5 w-5" /> DigiWallet
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={method === "card"}
            onClick={() => setMethod("card")}
            className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition ${
              method === "card"
                ? "border-violet-400 bg-violet-500/15 text-white shadow-[0_0_0_2px_rgba(139,92,246,0.18),0_0_24px_rgba(124,58,237,0.18)] light:text-violet-800"
                : "border-[#31425f] text-slate-300 hover:border-violet-400/70 light:border-slate-300 light:text-slate-700"
            }`}
          >
            <CreditCard className="h-5 w-5" /> Credit / Debit Card
          </button>
        </div>

        {method === "digiwallet" ? (
          <div className="rounded-xl border border-violet-500/25 bg-linear-to-br from-violet-500/15 to-indigo-500/10 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white">
                <Smartphone className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-black text-violet-300 light:text-violet-700">
                  DigiWallet
                </p>
                <p className="mt-1 text-[11px] leading-5 text-slate-300 light:text-slate-600">
                  Pay securely using your DigiWallet account.
                </p>
              </div>
            </div>
            <div className="mt-4 flex gap-3 rounded-lg border border-violet-500/35 bg-violet-500/10 p-3 text-[11px] leading-5 text-slate-300 light:text-slate-700">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-violet-300 light:text-violet-600" />
              <p>
                You will be redirected to DigiWallet to complete your payment
                once the bank integration is available.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-[#293a56] bg-[#101d31] p-4 light:border-slate-200 light:bg-slate-50">
            <div className="mb-4 flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#405376] bg-[#14233b] text-white light:border-slate-300 light:bg-white light:text-slate-700">
                <CreditCard className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-black text-white light:text-slate-900">
                  Credit / Debit Card
                </p>
                <p className="mt-1 text-[11px] text-slate-400 light:text-slate-600">
                  Visa, Mastercard, and other supported cards.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2" htmlFor={`${fieldId}-number`}>
                <span className="mb-1.5 block text-[11px] font-semibold text-slate-200 light:text-slate-700">
                  Card Number
                </span>
                <span className="relative block">
                  <input
                    id={`${fieldId}-number`}
                    inputMode="numeric"
                    autoComplete="cc-number"
                    placeholder="1234 5678 9012 3456"
                    className="h-11 w-full rounded-lg border border-[#40516e] bg-[#142238] px-3 pr-10 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20 light:border-slate-300 light:bg-white light:text-slate-900"
                  />
                  <CreditCard className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </span>
              </label>
              <label htmlFor={`${fieldId}-expiry`}>
                <span className="mb-1.5 block text-[11px] font-semibold text-slate-200 light:text-slate-700">
                  Expiry Date
                </span>
                <input
                  id={`${fieldId}-expiry`}
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  placeholder="MM / YY"
                  className="h-11 w-full rounded-lg border border-[#40516e] bg-[#142238] px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20 light:border-slate-300 light:bg-white light:text-slate-900"
                />
              </label>
              <label htmlFor={`${fieldId}-cvc`}>
                <span className="mb-1.5 block text-[11px] font-semibold text-slate-200 light:text-slate-700">
                  CVV
                </span>
                <input
                  id={`${fieldId}-cvc`}
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  placeholder="123"
                  className="h-11 w-full rounded-lg border border-[#40516e] bg-[#142238] px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20 light:border-slate-300 light:bg-white light:text-slate-900"
                />
              </label>
              <label className="sm:col-span-2" htmlFor={`${fieldId}-name`}>
                <span className="mb-1.5 block text-[11px] font-semibold text-slate-200 light:text-slate-700">
                  Name on Card
                </span>
                <input
                  id={`${fieldId}-name`}
                  autoComplete="cc-name"
                  placeholder="Name as shown on card"
                  className="h-11 w-full rounded-lg border border-[#40516e] bg-[#142238] px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20 light:border-slate-300 light:bg-white light:text-slate-900"
                />
              </label>
              <p className="sm:col-span-2 text-[10px] text-amber-300 light:text-amber-700">
                Payment fields are a preview only. Do not enter real payment
                details yet.
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between rounded-xl border border-violet-500/25 bg-violet-500/10 px-4 py-3">
          <span className="text-xs font-semibold text-slate-300 light:text-slate-700">
            Total due
          </span>
          <span className="text-lg font-black text-violet-300 light:text-violet-700">
            {formatCurrency(amount)}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setNoticeOpen(true)}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-violet-600 via-violet-500 to-purple-600 px-4 py-3 text-sm font-black text-white shadow-[0_12px_30px_rgba(109,40,217,0.3)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-400/30"
        >
          <LockKeyhole className="h-4 w-4" /> {continueLabel}
        </button>

        <div className="flex items-center justify-center gap-2 text-center text-[10px] text-slate-400 light:text-slate-600">
          <ShieldCheck className="h-3.5 w-3.5 text-violet-400" />
          Your payment information will be encrypted and secure.
        </div>
      </div>

      {noticeOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close payment notice"
            onClick={() => setNoticeOpen(false)}
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`${fieldId}-notice-title`}
            className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-slate-700 bg-slate-800 shadow-2xl light:border-slate-200 light:bg-white"
          >
            <div className="border-b border-slate-700 px-5 py-4 light:border-slate-200">
              <h3
                id={`${fieldId}-notice-title`}
                className="text-sm font-black text-white light:text-slate-900"
              >
                Online payments
              </h3>
            </div>
            <div className="flex items-start gap-3 p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300 light:text-violet-700">
                <Info className="h-5 w-5" />
              </span>
              <p className="pt-2 text-sm leading-6 text-slate-200 light:text-slate-700">
                {PAYMENT_COMING_SOON_MESSAGE}
              </p>
            </div>
            <div className="border-t border-slate-700 p-4 light:border-slate-200">
              <button
                type="button"
                autoFocus
                onClick={() => setNoticeOpen(false)}
                className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-500"
              >
                Okay
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
