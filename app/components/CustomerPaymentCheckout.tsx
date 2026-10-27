"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Banknote,
  CalendarDays,
  Check,
  Copy,
  Landmark,
  MapPin,
  PackageSearch,
  ShoppingCart,
  Store,
  Truck,
  UtensilsCrossed,
  WalletCards,
  X,
} from "lucide-react";
import { formatCurrency } from "@/app/lib/utils";
import type {
  CheckoutOrderType,
  CheckoutPaymentOption,
  CustomerCheckoutMethod,
} from "@/app/lib/customer-checkout";

interface CheckoutItem {
  id: string;
  name: string;
  image: string;
  quantity: number;
  lineTotal: number;
  detail?: string;
}

export interface CheckoutConfirmation {
  orderNumber: string;
  total: number;
  customerEmail: string;
  emailQueued: boolean;
  createdAt: string;
}

interface CustomerPaymentCheckoutProps {
  businessName: string;
  stage: "details" | "complete";
  children: ReactNode;
  fulfillmentFields: ReactNode;
  availableOrderTypes: CheckoutOrderType[];
  orderType: CheckoutOrderType;
  onOrderTypeChange: (value: CheckoutOrderType) => void;
  paymentOptions: CheckoutPaymentOption[];
  paymentMethod: CustomerCheckoutMethod;
  onPaymentMethodChange: (value: CustomerCheckoutMethod) => void;
  configurationLoading: boolean;
  configurationError: string;
  onReloadConfiguration: () => void;
  placingOrder: boolean;
  unavailable: boolean;
  confirmation: CheckoutConfirmation | null;
  onPlaceOrder: () => void;
  onTrackOrder: (reference: string) => void;
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

const primaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#7c00ff] to-[#8b2cff] px-4 py-3 text-sm font-black text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50";
const panel =
  "overflow-hidden rounded-xl border border-[#263955] bg-[#0a1a2d] light:border-slate-200 light:bg-white";

const ORDER_TYPE_DETAILS: Record<
  CheckoutOrderType,
  { label: string; description: string; icon: typeof Truck }
> = {
  delivery: {
    label: "Delivery",
    description: "Get it delivered to your address",
    icon: Truck,
  },
  pickup: {
    label: "Pickup",
    description: "Collect from the business location",
    icon: Store,
  },
  dine_in: {
    label: "Dine In",
    description: "Order for your table",
    icon: UtensilsCrossed,
  },
};

function paymentDescription(
  method: CustomerCheckoutMethod,
  configured: string,
) {
  if (method === "bank_transfer")
    return "Pay directly to the business bank account and upload your receipt.";
  if (method === "cash_on_delivery")
    return "Pay the business when your order is delivered.";
  if (method === "payment_on_pickup")
    return "Pay the business when you collect your order.";
  if (method === "external_link")
    return "Open the business payment provider from Track Order.";
  return configured || "Arrange payment directly with the business.";
}

function PaymentIcon({ method }: { method: CustomerCheckoutMethod }) {
  if (method === "bank_transfer") return <Landmark className="h-5 w-5" />;
  if (method === "cash_on_delivery") return <Banknote className="h-5 w-5" />;
  return <WalletCards className="h-5 w-5" />;
}

function CheckoutProgress() {
  return (
    <ol
      className="grid min-w-0 flex-1 grid-cols-4"
      aria-label="Checkout progress"
    >
      {["Cart", "Checkout", "Review", "Complete"].map((step, index) => {
        const complete = index === 0;
        const active = index === 1;
        return (
          <li
            key={step}
            aria-current={active ? "step" : undefined}
            className="relative text-center"
          >
            {index > 0 && (
              <span
                aria-hidden="true"
                className={`absolute right-1/2 top-3 h-px w-full ${index <= 1 ? "bg-[#8b2cff]" : "bg-[#34506f]"}`}
              />
            )}
            <span
              className={`relative mx-auto flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-black ${complete || active ? "border-purple-400 bg-[#7c00ff] text-white" : "border-[#48617f] bg-[#0a1a2d] text-slate-400 light:bg-white"}`}
            >
              {complete ? <Check className="h-3 w-3" /> : index + 1}
            </span>
            <span
              className={`mt-1.5 block text-[10px] ${active ? "font-bold text-white light:text-slate-950" : "text-slate-400"}`}
            >
              {step}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function CustomerPaymentCheckout(p: CustomerPaymentCheckoutProps) {
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");

  useEffect(() => {
    heading.current?.focus();
  }, [p.stage]);

  const disabled =
    p.placingOrder ||
    p.applyingPromotion ||
    p.configurationLoading ||
    !!p.configurationError ||
    p.unavailable;

  if (p.stage === "complete" && p.confirmation) {
    return (
      <div className="relative bg-[#07111f] p-4 text-white light:bg-slate-50 light:text-slate-950 sm:p-7">
        <button
          type="button"
          disabled={p.placingOrder}
          onClick={p.onClose}
          aria-label="Close order confirmation"
          className="absolute right-3 top-3 rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
        <section className="mx-auto max-w-lg text-center">
          <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full border-4 border-purple-400 bg-[#7c00ff] shadow-[0_0_36px_rgba(124,0,255,0.35)]">
            <Check className="h-10 w-10 stroke-[3]" />
          </div>
          <h2
            ref={heading}
            tabIndex={-1}
            className="mt-5 text-2xl font-black outline-none"
          >
            Order Placed Successfully!
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-300 light:text-slate-600">
            Thank you for your order. We&apos;ve received it and will review the
            details shortly.
          </p>

          <div className="mt-6 flex items-center gap-3 rounded-xl border border-purple-500/30 bg-[#7c00ff]/15 p-4 text-left">
            <span className="rounded-lg bg-[#7c00ff] p-3">
              <PackageSearch className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-300 light:text-slate-600">
                Your Order Reference
              </p>
              <strong className="mt-1 block break-all text-xl">
                {p.confirmation.orderNumber}
              </strong>
            </div>
            <button
              type="button"
              aria-label="Copy order reference"
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-purple-400 px-3 text-xs font-bold text-purple-200 light:text-purple-700"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    p.confirmation!.orderNumber,
                  );
                  setCopied(true);
                  setCopyError("");
                } catch {
                  setCopyError("Select and copy the reference manually.");
                }
              }}
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          {copyError && (
            <p role="status" className="mt-2 text-xs text-amber-300">
              {copyError}
            </p>
          )}

          <div className="mt-3 flex items-center gap-3 border-b border-[#263955] px-3 py-3 text-left text-sm light:border-slate-200">
            <CalendarDays className="h-5 w-5 text-purple-400" />
            <span className="text-slate-400">Order Date</span>
            <strong className="ml-auto text-right">
              {new Intl.DateTimeFormat(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(p.confirmation.createdAt))}
            </strong>
          </div>

          <div className="mt-5 rounded-xl border border-purple-500/30 bg-[#7c00ff]/10 p-4 text-left">
            <div className="flex gap-3">
              <span className="mt-0.5 text-purple-300">ⓘ</span>
              <div>
                <h3 className="font-black">What&apos;s Next?</h3>
                <p className="mt-1 text-sm leading-6 text-slate-300 light:text-slate-600">
                  To make your payment and upload your receipt, go to Track
                  Order and enter your order reference. We also sent this
                  reference to your checkout email.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => p.onTrackOrder(p.confirmation!.orderNumber)}
            className={`${primaryButton} mt-5 w-full`}
          >
            Go to Track Order
            <PackageSearch className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={p.onClose}
            className="mt-3 min-h-11 w-full rounded-lg border border-cyan-500/70 px-4 text-sm font-bold text-white light:text-slate-900"
          >
            Continue Shopping
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="relative min-w-0 bg-[#07111f] p-3 text-white light:bg-slate-50 light:text-slate-950 sm:p-5">
      <button
        type="button"
        disabled={p.placingOrder}
        onClick={p.onClose}
        aria-label="Close checkout"
        className="absolute right-2 top-2 rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-40"
      >
        <X className="h-5 w-5" />
      </button>

      <header className="mb-4 grid gap-4 pr-8 md:grid-cols-[minmax(0,1fr)_minmax(300px,0.85fr)] md:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#7c00ff] text-xl font-black">
            {p.businessName.trim().charAt(0).toUpperCase() || "S"}
          </span>
          <div className="min-w-0">
            <h2
              ref={heading}
              tabIndex={-1}
              className="truncate text-lg font-black outline-none"
            >
              {p.businessName}
            </h2>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Storefront
            </p>
          </div>
        </div>
        <CheckoutProgress />
      </header>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!disabled) p.onPlaceOrder();
        }}
      >
        <fieldset
          disabled={p.placingOrder}
          className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)] lg:items-start"
        >
          <div className="space-y-3">
            <section className={panel}>
              <div className="flex items-center gap-2 border-b border-[#263955] px-4 py-3 light:border-slate-200">
                <span className="text-purple-400">♙</span>
                <h3 className="text-sm font-black">Customer Information</h3>
              </div>
              <div className="p-4">{p.children}</div>
            </section>

            <section className={panel}>
              <div className="flex items-center gap-2 border-b border-[#263955] px-4 py-3 light:border-slate-200">
                <Truck className="h-4 w-4 text-purple-400" />
                <h3 className="text-sm font-black">Delivery Option</h3>
              </div>
              <div className="grid gap-2 p-4 sm:grid-cols-2">
                {p.availableOrderTypes.map((type) => {
                  const details = ORDER_TYPE_DETAILS[type];
                  const Icon = details.icon;
                  const checked = p.orderType === type;
                  return (
                    <label
                      key={type}
                      className={`relative flex min-h-20 cursor-pointer gap-3 rounded-lg border p-3 transition ${checked ? "border-purple-400 bg-[#7c00ff]/15" : "border-[#304765] hover:border-purple-500/60 light:border-slate-300"}`}
                    >
                      <input
                        type="radio"
                        name={`${id}-order-type`}
                        value={type}
                        checked={checked}
                        onChange={() => p.onOrderTypeChange(type)}
                        className="sr-only"
                      />
                      <Icon className="mt-0.5 h-6 w-6 shrink-0 text-purple-300" />
                      <span>
                        <strong className="block text-sm">
                          {details.label}
                        </strong>
                        <span className="mt-1 block text-[11px] leading-4 text-slate-400 light:text-slate-600">
                          {details.description}
                        </span>
                      </span>
                      <span
                        aria-hidden="true"
                        className={`absolute right-3 top-3 h-4 w-4 rounded-full border ${checked ? "border-purple-300 bg-[#7c00ff] ring-2 ring-purple-400/30" : "border-slate-500"}`}
                      />
                    </label>
                  );
                })}
              </div>
            </section>

            <section className={panel}>
              <div className="flex items-center gap-2 border-b border-[#263955] px-4 py-3 light:border-slate-200">
                <MapPin className="h-4 w-4 text-purple-400" />
                <h3 className="text-sm font-black">
                  {p.orderType === "delivery"
                    ? "Delivery Details"
                    : p.orderType === "pickup"
                      ? "Pickup Details"
                      : "Dine-In Details"}
                </h3>
              </div>
              <div className="p-4">{p.fulfillmentFields}</div>
            </section>
          </div>

          <div className="space-y-3">
            <section className={panel}>
              <div className="flex items-center gap-2 border-b border-[#263955] px-4 py-3 light:border-slate-200">
                <Landmark className="h-4 w-4 text-purple-400" />
                <h3 className="text-sm font-black">Payment Method</h3>
              </div>
              <div className="space-y-2 p-4">
                {p.configurationLoading ? (
                  <p role="status" className="text-sm text-slate-400">
                    Loading business payment options…
                  </p>
                ) : p.configurationError ? (
                  <div
                    role="alert"
                    className="text-sm text-rose-300 light:text-rose-700"
                  >
                    {p.configurationError}
                    <button
                      type="button"
                      onClick={p.onReloadConfiguration}
                      className="ml-2 font-bold underline"
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  p.paymentOptions.map((option) => {
                    const checked = p.paymentMethod === option.method;
                    return (
                      <label
                        key={option.method}
                        className={`relative flex min-h-16 cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${checked ? "border-purple-400 bg-[#7c00ff]/15" : "border-[#304765] hover:border-purple-500/60 light:border-slate-300"}`}
                      >
                        <input
                          type="radio"
                          name={`${id}-payment`}
                          value={option.method}
                          checked={checked}
                          onChange={() =>
                            p.onPaymentMethodChange(option.method)
                          }
                          className="sr-only"
                        />
                        <span className="rounded-lg border border-purple-500/30 p-2 text-purple-300">
                          <PaymentIcon method={option.method} />
                        </span>
                        <span className="min-w-0 pr-5">
                          <strong className="block text-sm">
                            {option.label}
                          </strong>
                          <span className="mt-1 block text-[11px] leading-4 text-slate-400 light:text-slate-600">
                            {paymentDescription(
                              option.method,
                              option.instructions,
                            )}
                          </span>
                        </span>
                        <span
                          aria-hidden="true"
                          className={`absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border ${checked ? "border-purple-300 bg-[#7c00ff] ring-2 ring-purple-400/30" : "border-slate-500"}`}
                        />
                      </label>
                    );
                  })
                )}
              </div>
            </section>

            <section className={panel}>
              <div className="flex items-center justify-between border-b border-[#263955] px-4 py-3 light:border-slate-200">
                <h3 className="flex items-center gap-2 text-sm font-black">
                  <ShoppingCart className="h-4 w-4 text-purple-400" />
                  Order Summary
                </h3>
                <button
                  type="button"
                  onClick={p.onBack}
                  className="text-xs font-semibold text-purple-300 underline light:text-purple-700"
                >
                  Edit Cart
                </button>
              </div>
              <div className="p-4">
                <ul className="max-h-52 space-y-3 overflow-y-auto">
                  {p.items.map((item) => (
                    <li key={item.id} className="flex items-center gap-3">
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-white/5">
                        <Image
                          src={item.image || "/fallback-product.png"}
                          alt={item.name}
                          fill
                          sizes="40px"
                          className="object-contain"
                          unoptimized
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold">
                          {item.name}
                        </p>
                        {item.detail && (
                          <p className="mt-0.5 truncate text-[10px] text-slate-400">
                            {item.detail}
                          </p>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        ×{item.quantity}
                      </span>
                      <span className="shrink-0 text-xs font-bold">
                        {formatCurrency(item.lineTotal)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 space-y-2 border-t border-[#263955] pt-3 text-xs light:border-slate-200">
                  {[
                    ["Subtotal", p.subtotal],
                    ["Delivery Fee", p.deliveryFee],
                    ["Tax", p.tax],
                    ...(p.discount > 0 ? [["Discount", -p.discount]] : []),
                    ...(p.promotionDiscount > 0
                      ? [
                          [
                            `Promo ${p.promotionLabel || ""}`,
                            -p.promotionDiscount,
                          ],
                        ]
                      : []),
                  ].map(([label, value]) => (
                    <div
                      key={String(label)}
                      className="flex justify-between gap-3"
                    >
                      <span className="text-slate-400">{label}</span>
                      <span className="font-semibold">
                        {Number(value) < 0 ? "-" : ""}
                        {formatCurrency(Math.abs(Number(value)))}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex justify-between rounded-lg bg-[#7c00ff]/20 px-4 py-3 text-lg font-black text-purple-200 light:text-purple-800">
                  <span>Total</span>
                  <span>{formatCurrency(p.total)}</span>
                </div>

                <details className="mt-3 text-xs">
                  <summary className="cursor-pointer font-bold text-purple-300 light:text-purple-700">
                    Add promo code
                  </summary>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={p.promotionCode}
                      maxLength={p.promotionMaxLength}
                      onChange={(event) =>
                        p.onPromotionCodeChange(event.target.value)
                      }
                      placeholder="Enter promo code"
                      className="min-w-0 flex-1 rounded-lg border border-[#3b526f] bg-[#11233a] px-3 py-2 outline-none focus:border-purple-400 light:border-slate-300 light:bg-white"
                    />
                    <button
                      type="button"
                      disabled={p.applyingPromotion || !p.promotionCode.trim()}
                      onClick={p.onApplyPromotion}
                      className={`${primaryButton} min-h-9 py-2`}
                    >
                      {p.applyingPromotion ? "Applying…" : "Apply"}
                    </button>
                  </div>
                </details>
                {p.promotionApplied && (
                  <p className="mt-2 text-xs text-emerald-400">
                    {p.promotionApplied} applied · You save{" "}
                    {formatCurrency(p.promotionDiscount)}
                  </p>
                )}
              </div>
            </section>
          </div>
        </fieldset>

        {p.error && (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-300 light:text-rose-700"
          >
            {p.error}
          </p>
        )}
        <button
          type="submit"
          disabled={disabled}
          className={`${primaryButton} mt-3 w-full`}
        >
          {p.placingOrder ? "Placing Order…" : "Place Order"}
          {!p.placingOrder && <span aria-hidden="true">→</span>}
        </button>
        <p className="mt-2 text-center text-[9px] leading-4 text-slate-400">
          By placing your order, you agree to our{" "}
          <Link href="/terms" target="_blank" className="underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" target="_blank" className="underline">
            Privacy Policy
          </Link>
          . Payment is made directly to {p.businessName}.
        </p>
      </form>
    </div>
  );
}
