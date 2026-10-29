"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Check,
  CreditCard,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { Modal } from "@/app/components/Modal";
import {
  PLAN_DEFINITIONS,
  calculateSubscriptionAmounts,
} from "@/app/lib/plans";
import { cn, formatCurrency } from "@/app/lib/utils";
import { startSubscriptionCheckout } from "@/app/services/billingService";
import type { PlanType } from "@/app/types";

type PaymentMethod = "digiwallet" | "card";

export function SubscriptionCheckoutPreview({
  open,
  tenantId,
  plan,
  paidStaffSeats,
  onClose,
}: {
  open: boolean;
  tenantId: string;
  plan: PlanType;
  paidStaffSeats: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [requestId, setRequestId] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("digiwallet");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const definition = PLAN_DEFINITIONS[plan];
  const amounts = calculateSubscriptionAmounts(plan, paidStaffSeats);

  useEffect(() => {
    if (!open) return;
    setRequestId(crypto.randomUUID());
    setPaymentMethod("digiwallet");
    setSubmitting(false);
    setError("");
  }, [open, tenantId, plan, paidStaffSeats]);

  const close = () => {
    if (submitting) return;
    setError("");
    onClose();
  };

  const continueToBank = async () => {
    if (!requestId || submitting) return;
    setSubmitting(true);
    setError("");

    try {
      const result = await startSubscriptionCheckout(
        tenantId,
        plan,
        paidStaffSeats,
        requestId,
      );

      if (result.status === "completed") {
        router.push("/dashboard/settings?tab=payments");
        return;
      }

      if (!result.redirectUrl) {
        throw new Error("Belize Bank did not return a payment page.");
      }

      window.location.assign(result.redirectUrl);
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Unable to start the secure payment.",
      );
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Secure subscription checkout"
      maxWidth="max-w-2xl"
      contentClassName="bg-[#090d19] px-4 py-4 text-white light:bg-[#090d19] light:text-white sm:px-5 sm:py-5"
    >
      <div className="space-y-4">
        <OrderSummary
          planName={definition.name}
          paidStaffSeats={paidStaffSeats}
          baseAmount={amounts.baseAmount}
          seatAmount={amounts.seatAmount}
          total={amounts.recurringTotal}
        />

        <section>
          <h3 className="mb-2 text-xs font-black">Payment method</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <PaymentMethodButton
              active={paymentMethod === "digiwallet"}
              icon={Smartphone}
              title="DigiWallet"
              description="Pay using your DigiWallet account"
              onClick={() => setPaymentMethod("digiwallet")}
            />
            <PaymentMethodButton
              active={paymentMethod === "card"}
              icon={CreditCard}
              title="Credit / Debit Card"
              description="Continue securely with Belize Bank"
              onClick={() => setPaymentMethod("card")}
            />
          </div>
        </section>

        {paymentMethod === "digiwallet" ? (
          <div className="flex items-start gap-3 rounded-xl border border-violet-500/30 bg-violet-500/10 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-orange-500 to-red-500 text-[9px] font-black">
              Digi
            </span>
            <div>
              <p className="text-sm font-black">DigiWallet</p>
              <p className="mt-1 text-xs font-semibold text-violet-200">
                Feature Coming Soon
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-xs leading-5 text-slate-300">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
            <p>
              Continue to Belize Bank&apos;s secure hosted page to enter your
              card details and complete any 3-D Secure verification.
            </p>
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-semibold text-red-200"
          >
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={paymentMethod === "digiwallet" || !requestId || submitting}
          onClick={() => void continueToBank()}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-black text-white shadow-lg shadow-violet-950/30 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none"
        >
          {submitting ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" /> Connecting to
              Belize Bank...
            </>
          ) : (
            <>
              <LockKeyhole className="h-4 w-4" />
              {paymentMethod === "digiwallet"
                ? "Feature Coming Soon"
                : "Continue to Belize Bank"}
              {paymentMethod === "card" && <ArrowRight className="h-4 w-4" />}
            </>
          )}
        </button>
      </div>
    </Modal>
  );
}

function OrderSummary({
  planName,
  paidStaffSeats,
  baseAmount,
  seatAmount,
  total,
}: {
  planName: string;
  paidStaffSeats: number;
  baseAmount: number;
  seatAmount: number;
  total: number;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-violet-500/30 bg-[#10182a]">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600">
            <Building2 className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-black">{planName}</p>
            <p className="text-[11px] text-slate-400">
              Monthly YuhBusiness subscription
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">
            Total due
          </p>
          <p className="text-xl font-black text-violet-300">
            {formatCurrency(total)}
          </p>
        </div>
      </div>

      <div className="space-y-2 px-4 py-3 text-xs text-slate-300">
        <div className="flex justify-between gap-4">
          <span>{planName} plan</span>
          <strong>{formatCurrency(baseAmount)}</strong>
        </div>
        {paidStaffSeats > 0 && (
          <div className="flex justify-between gap-4">
            <span>Additional staff seats x {paidStaffSeats}</span>
            <strong>{formatCurrency(seatAmount)}</strong>
          </div>
        )}
        <div className="flex justify-between gap-4 border-t border-white/10 pt-2 font-black text-white">
          <span>Amount charged today</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>
    </section>
  );
}

function PaymentMethodButton({
  active,
  icon: Icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: typeof CreditCard;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-16 items-center gap-3 rounded-xl border p-3 text-left transition",
        active
          ? "border-violet-400 bg-violet-500/15 ring-1 ring-violet-400"
          : "border-slate-700 bg-[#0b1525] hover:border-slate-500",
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block text-xs">{title}</strong>
        <span className="mt-0.5 block text-[10px] text-slate-400">
          {description}
        </span>
      </span>
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
          active ? "border-violet-400 bg-violet-600" : "border-slate-600",
        )}
      >
        {active && <Check className="h-3 w-3" />}
      </span>
    </button>
  );
}
