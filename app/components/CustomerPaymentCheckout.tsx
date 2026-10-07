"use client";

import { useId, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  CreditCard,
  Info,
  LockKeyhole,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Tag,
  WalletCards,
  X,
} from "lucide-react";
import { formatCurrency } from "@/app/lib/utils";
import { PAYMENT_COMING_SOON_MESSAGE } from "@/app/components/PaymentMethodSetup";

interface CheckoutItem {
  id: string;
  name: string;
  image: string;
  quantity: number;
  lineTotal: number;
  detail?: string;
}

interface CustomerPaymentCheckoutProps {
  items: CheckoutItem[];
  subtotal: number;
  tax: number;
  deliveryFee: number;
  discount: number;
  promotionDiscount: number;
  promotionLabel?: string;
  total: number;
  promotionCode: string;
  promotionMaxLength: number;
  applyingPromotion: boolean;
  promotionApplied?: string;
  error?: string;
  onPromotionCodeChange: (value: string) => void;
  onApplyPromotion: () => void;
  onBack: () => void;
  onClose: () => void;
}

export function CustomerPaymentCheckout({
  items,
  subtotal,
  tax,
  deliveryFee,
  discount,
  promotionDiscount,
  promotionLabel,
  total,
  promotionCode,
  promotionMaxLength,
  applyingPromotion,
  promotionApplied,
  error,
  onPromotionCodeChange,
  onApplyPromotion,
  onBack,
  onClose,
}: CustomerPaymentCheckoutProps) {
  const fieldId = useId();
  const [selectedMethod, setSelectedMethod] = useState<"digiwallet" | "card">(
    "digiwallet",
  );
  const [noticeOpen, setNoticeOpen] = useState(false);

  return (
    <div className="relative min-w-0 bg-[#07111f] px-4 pb-5 pt-6 text-white light:bg-white light:text-slate-950 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close checkout"
        className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white light:hover:bg-slate-100 light:hover:text-slate-900"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="mb-5 grid gap-6 pr-10 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)] lg:items-end">
        <div>
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
            Checkout
          </h2>
          <p className="mt-1 text-sm text-slate-300 light:text-slate-600">
            Complete your purchase securely.
          </p>
        </div>
        <div className="grid grid-cols-4 gap-0" aria-label="Checkout progress">
          {["Cart", "Checkout", "Review", "Complete"].map((step, index) => (
            <div key={step} className="relative text-center">
              {index > 0 && (
                <span
                  className={`absolute right-1/2 top-3.5 h-0.5 w-full ${index <= 1 ? "bg-violet-500" : "bg-[#30415d] light:bg-slate-300"}`}
                />
              )}
              <span
                className={`relative z-10 mx-auto flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-black ${index <= 1 ? "border-violet-400 bg-violet-600 text-white" : "border-[#48607e] bg-[#0b1728] text-slate-400 light:bg-white"}`}
              >
                {index + 1}
              </span>
              <span
                className={`mt-1.5 block text-[9px] font-semibold sm:text-[10px] ${index === 1 ? "text-white light:text-slate-950" : "text-slate-400 light:text-slate-600"}`}
              >
                {step}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)] lg:items-start">
        <section className="overflow-hidden rounded-2xl border border-[#263651] bg-[#0b1728]/95 light:border-slate-200 light:bg-white">
          <div className="flex items-center gap-3 border-b border-[#22324b] px-4 py-4 light:border-slate-200">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-violet-700 shadow-lg shadow-violet-950/30">
              <WalletCards className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-sm font-black">Payment Method</h3>
              <p className="mt-0.5 text-[11px] text-slate-400 light:text-slate-600">
                Choose how you want to pay.
              </p>
            </div>
          </div>

          <div className="space-y-4 p-4">
            <div className="grid grid-cols-2 gap-2" role="radiogroup">
              <PaymentChoice
                active={selectedMethod === "digiwallet"}
                onClick={() => setSelectedMethod("digiwallet")}
                icon={<Smartphone className="h-5 w-5" />}
                label="DigiWallet"
              />
              <PaymentChoice
                active={selectedMethod === "card"}
                onClick={() => setSelectedMethod("card")}
                icon={<CreditCard className="h-5 w-5" />}
                label="Credit / Debit Card"
              />
            </div>

            {selectedMethod === "digiwallet" ? (
              <div className="rounded-xl border border-violet-500/20 bg-linear-to-br from-violet-500/15 to-indigo-500/10 p-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600">
                    <Smartphone className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-black text-violet-300 light:text-violet-700">
                      DigiWallet
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-300 light:text-slate-600">
                      Pay securely using your DigiWallet account.
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2 rounded-lg border border-violet-500/35 bg-violet-500/10 p-3 text-[10px] leading-4 text-slate-300 light:text-slate-700">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-violet-300 light:text-violet-600" />
                  <p>
                    You will be redirected to DigiWallet to complete your
                    payment. Make sure you have your DigiWallet app ready.
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-[#293a56] bg-[#101d31] p-3 light:border-slate-200 light:bg-slate-50">
                <div className="mb-3 flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#405376] bg-[#14233b] light:border-slate-300 light:bg-white light:text-slate-700">
                    <CreditCard className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-black">Credit / Debit Card</p>
                    <p className="mt-0.5 text-[10px] text-slate-400 light:text-slate-600">
                      Pay with Visa, Mastercard, or other supported cards.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <PaymentInput
                    id={`${fieldId}-card-number`}
                    label="Card Number"
                    placeholder="1234 5678 9012 3456"
                    className="sm:col-span-2"
                  />
                  <PaymentInput
                    id={`${fieldId}-expiry`}
                    label="Expiry Date"
                    placeholder="MM / YY"
                  />
                  <PaymentInput
                    id={`${fieldId}-cvv`}
                    label="CVV"
                    placeholder="123"
                  />
                  <PaymentInput
                    id={`${fieldId}-card-name`}
                    label="Name on Card"
                    placeholder="Name as shown on card"
                    className="sm:col-span-2"
                  />
                  <label className="flex items-center gap-2 text-[10px] text-slate-300 light:text-slate-700 sm:col-span-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-500 accent-violet-600"
                    />
                    Save this card for future payments
                  </label>
                  <div className="flex items-center gap-2 rounded-lg border border-violet-500/35 bg-violet-500/10 p-2.5 text-[10px] text-slate-300 light:text-slate-700 sm:col-span-2">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-violet-300 light:text-violet-600" />
                    Your payment information will be encrypted and secure.
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#263651] bg-[#0b1728]/95 light:border-slate-200 light:bg-white">
          <div className="flex items-center justify-between border-b border-[#22324b] px-4 py-4 light:border-slate-200">
            <div className="flex items-center gap-3">
              <ShoppingCart className="h-5 w-5 text-violet-400" />
              <h3 className="text-sm font-black">Order Summary</h3>
            </div>
            <button
              type="button"
              onClick={onBack}
              className="text-[10px] font-semibold text-violet-300 underline hover:text-violet-200 light:text-violet-700"
            >
              Edit Cart
            </button>
          </div>

          <div className="p-4">
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-[#172238] light:bg-slate-100">
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      sizes="44px"
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{item.name}</p>
                    {item.detail && (
                      <p className="truncate text-[9px] text-slate-500">
                        {item.detail}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    x{item.quantity}
                  </span>
                  <span className="w-16 text-right text-xs font-semibold">
                    {formatCurrency(item.lineTotal)}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-2 border-t border-[#293a54] pt-4 text-[11px] light:border-slate-200">
              <SummaryRow label="Subtotal" value={subtotal} />
              <SummaryRow label="Tax" value={tax} />
              {deliveryFee > 0 && (
                <SummaryRow label="Delivery fee" value={deliveryFee} />
              )}
              {discount > 0 && (
                <SummaryRow label="Discount" value={-discount} discount />
              )}
              {promotionDiscount > 0 && (
                <SummaryRow
                  label={`Promo${promotionLabel ? ` (${promotionLabel})` : ""}`}
                  value={-promotionDiscount}
                  discount
                />
              )}
            </div>

            <div className="mt-4 flex items-center justify-between rounded-xl border border-violet-500/25 bg-violet-500/10 px-4 py-3">
              <span className="text-lg font-black text-violet-300 light:text-violet-700">
                Total
              </span>
              <span className="text-xl font-black text-violet-300 light:text-violet-700">
                {formatCurrency(total)}
              </span>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center gap-2">
                <Tag className="h-4 w-4 text-violet-400" />
                <p className="text-xs font-black">
                  Promo Code <span className="font-normal">(Optional)</span>
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  value={promotionCode}
                  maxLength={promotionMaxLength}
                  onChange={(event) =>
                    onPromotionCodeChange(event.target.value)
                  }
                  placeholder="Enter promo code"
                  className="min-w-0 flex-1 rounded-lg border border-[#40516e] bg-[#142238] px-3 py-2.5 text-xs text-white outline-none placeholder:text-slate-500 focus:border-violet-400 light:border-slate-300 light:bg-white light:text-slate-900"
                />
                <button
                  type="button"
                  disabled={applyingPromotion}
                  onClick={onApplyPromotion}
                  className="rounded-lg bg-linear-to-r from-violet-600 to-purple-600 px-5 text-xs font-black text-white transition hover:brightness-110 disabled:opacity-50"
                >
                  {applyingPromotion ? "Applying..." : "Apply"}
                </button>
              </div>
              {promotionApplied && (
                <p className="mt-1.5 text-[10px] text-emerald-400">
                  {promotionApplied} applied
                </p>
              )}
              {error && (
                <p className="mt-1.5 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-[10px] text-red-300 light:text-red-600">
                  {error}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setNoticeOpen(true)}
              className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-violet-600 via-violet-500 to-purple-600 px-4 py-3 text-sm font-black text-white shadow-[0_12px_30px_rgba(109,40,217,0.3)] transition hover:brightness-110"
            >
              <LockKeyhole className="h-4 w-4" /> Continue to Payment
            </button>
            <p className="mt-3 text-center text-[9px] leading-4 text-slate-400 light:text-slate-600">
              By completing your purchase, you agree to our{" "}
              <Link
                href="/terms"
                target="_blank"
                className="text-violet-300 underline light:text-violet-700"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                target="_blank"
                className="text-violet-300 underline light:text-violet-700"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </section>
      </div>

      {noticeOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close payment notice"
            onClick={() => setNoticeOpen(false)}
            className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`${fieldId}-notice-title`}
            className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-slate-700 bg-slate-800 shadow-2xl light:border-slate-200 light:bg-white"
          >
            <div className="border-b border-slate-700 px-5 py-4 light:border-slate-200">
              <h3 id={`${fieldId}-notice-title`} className="text-sm font-black">
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
    </div>
  );
}

function PaymentChoice({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[10px] font-bold transition sm:text-xs ${active ? "border-violet-400 bg-violet-500/15 text-white shadow-[0_0_0_2px_rgba(139,92,246,0.16),0_0_20px_rgba(124,58,237,0.16)] light:text-violet-800" : "border-[#31425f] text-slate-300 hover:border-violet-400/70 light:border-slate-300 light:text-slate-700"}`}
    >
      {icon} {label}
    </button>
  );
}

function PaymentInput({
  id,
  label,
  placeholder,
  className = "",
}: {
  id: string;
  label: string;
  placeholder: string;
  className?: string;
}) {
  return (
    <label htmlFor={id} className={className}>
      <span className="mb-1.5 block text-[10px] font-semibold text-slate-200 light:text-slate-700">
        {label}
      </span>
      <input
        id={id}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-[#40516e] bg-[#142238] px-3 text-xs text-white outline-none placeholder:text-slate-500 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20 light:border-slate-300 light:bg-white light:text-slate-900"
      />
    </label>
  );
}

function SummaryRow({
  label,
  value,
  discount = false,
}: {
  label: string;
  value: number;
  discount?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-400 light:text-slate-600">{label}</span>
      <span
        className={
          discount ? "font-semibold text-emerald-400" : "font-semibold"
        }
      >
        {value < 0 ? "-" : ""}
        {formatCurrency(Math.abs(value))}
      </span>
    </div>
  );
}
