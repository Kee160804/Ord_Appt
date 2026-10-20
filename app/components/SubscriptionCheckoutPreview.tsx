"use client";

import { useState } from "react";
import {
  Check,
  CircleHelp,
  CreditCard,
  LockKeyhole,
  Smartphone,
} from "lucide-react";
import { Modal } from "@/app/components/Modal";
import {
  PLAN_DEFINITIONS,
  calculateSubscriptionAmounts,
} from "@/app/lib/plans";
import { cn, formatCurrency } from "@/app/lib/utils";
import type { PlanType } from "@/app/types";

function checkoutId(tenantId: string, plan: PlanType, paidStaffSeats: number) {
  const source = `${tenantId}:${plan}:${paidStaffSeats}`;
  let hash = 2_166_136_261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return String(hash >>> 0).padStart(12, "0");
}

type CardBrand = "visa" | "mastercard" | "amex" | "discover" | "generic";

const CARD_BRAND_LABELS: Record<CardBrand, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  discover: "Discover",
  generic: "Credit / Debit",
};

function cardBrand(cardNumber: string): CardBrand {
  const digits = cardNumber.replace(/\D/g, "");
  if (/^4/.test(digits)) return "visa";
  if (/^3[47]/.test(digits)) return "amex";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "mastercard";
  if (/^(6011|65|64[4-9])/.test(digits)) return "discover";
  return "generic";
}

function formatCardNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2
    ? `${digits.slice(0, 2)}/${digits.slice(2)}`
    : digits;
}

function PaymentBrandLogo({ brand }: { brand: Exclude<CardBrand, "generic"> }) {
  const label = CARD_BRAND_LABELS[brand];

  if (brand === "mastercard") {
    return (
      <svg
        viewBox="0 0 64 32"
        role="img"
        aria-label={label}
        className="h-full w-full"
      >
        <circle cx="25" cy="16" r="11" fill="#eb001b" />
        <circle cx="39" cy="16" r="11" fill="#f79e1b" />
        <path
          d="M32 7.6a11 11 0 0 1 0 16.8 11 11 0 0 1 0-16.8Z"
          fill="#ff5f00"
        />
      </svg>
    );
  }

  if (brand === "amex") {
    return (
      <svg
        viewBox="0 0 64 32"
        role="img"
        aria-label={label}
        className="h-full w-full"
      >
        <rect x="2" y="3" width="60" height="26" rx="3" fill="#169bd7" />
        <text
          x="32"
          y="14"
          textAnchor="middle"
          fill="white"
          fontSize="7"
          fontWeight="900"
        >
          AMERICAN
        </text>
        <text
          x="32"
          y="22"
          textAnchor="middle"
          fill="white"
          fontSize="7"
          fontWeight="900"
        >
          EXPRESS
        </text>
      </svg>
    );
  }

  if (brand === "discover") {
    return (
      <svg
        viewBox="0 0 64 32"
        role="img"
        aria-label={label}
        className="h-full w-full"
      >
        <text x="4" y="18" fill="#111827" fontSize="9" fontWeight="900">
          DISC
        </text>
        <circle cx="37" cy="15" r="6" fill="#f58220" />
        <text x="42" y="18" fill="#111827" fontSize="8" fontWeight="900">
          VER
        </text>
        <path d="M18 25c16 4 29 1 41-7-9 10-24 13-41 7Z" fill="#f58220" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 64 32"
      role="img"
      aria-label={label}
      className="h-full w-full"
    >
      <text
        x="32"
        y="21"
        textAnchor="middle"
        fill="#1434cb"
        fontSize="19"
        fontStyle="italic"
        fontWeight="900"
      >
        VISA
      </text>
      <path d="M13 24h39" stroke="#f7b600" strokeWidth="2" />
    </svg>
  );
}

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
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "card">(
    "wallet",
  );
  const [unavailable, setUnavailable] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [cardholderName, setCardholderName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [securityCode, setSecurityCode] = useState("");
  const [isSecurityCodeFocused, setIsSecurityCodeFocused] = useState(false);
  const [saveCard, setSaveCard] = useState(true);
  const definition = PLAN_DEFINITIONS[plan];
  const amounts = calculateSubscriptionAmounts(plan, paidStaffSeats);

  const close = () => {
    setPaymentMethod("wallet");
    setUnavailable(false);
    setCardNumber("");
    setCardholderName("");
    setExpiry("");
    setSecurityCode("");
    setIsSecurityCodeFocused(false);
    setSaveCard(true);
    onClose();
  };

  const choosePaymentMethod = (method: "wallet" | "card") => {
    setPaymentMethod(method);
    setUnavailable(false);
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Checkout"
      maxWidth="max-w-2xl"
      scrollable={false}
      contentClassName="bg-[#090d19] px-3 py-2.5 text-white light:bg-[#090d19] light:text-white sm:px-4 sm:py-3"
    >
      <div className="space-y-2">
        <div>
          <h3 className="text-lg font-black">Order Summary</h3>
          <p className="text-[10px] text-zinc-400">
            Checkout ID: #{checkoutId(tenantId, plan, paidStaffSeats)}
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border-l-4 border-violet-500 bg-[#11192b]">
          <div className="flex items-center justify-between gap-4 px-3 py-2">
            <div>
              <p className="font-black">{definition.name}</p>
              <p className="mt-0.5 inline-flex rounded bg-zinc-700 px-2 py-0.5 text-[9px] font-black uppercase text-zinc-200">
                Qty 1
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-zinc-400">
                Total
              </p>
              <p className="text-lg font-black text-violet-400">
                {formatCurrency(amounts.recurringTotal)}
              </p>
            </div>
          </div>
          {paidStaffSeats > 0 && (
            <div className="flex items-center justify-between border-t border-zinc-700 px-4 py-2 text-xs text-zinc-300">
              <span>Additional staff seats × {paidStaffSeats}</span>
              <strong>{formatCurrency(amounts.seatAmount)}</strong>
            </div>
          )}
        </div>

        {paymentMethod === "card" && (
          <CardPreview
            cardNumber={cardNumber}
            cardholderName={cardholderName}
            expiry={expiry}
            securityCode={securityCode}
            flipped={isSecurityCodeFocused}
          />
        )}

        <div>
          <h3 className="mb-1 text-xs font-black">Payment Method</h3>
          <div className="grid grid-cols-2 gap-2">
            <PaymentMethodButton
              active={paymentMethod === "wallet"}
              icon={Smartphone}
              title="DigiWallet"
              description="Pay securely with DigiWallet"
              badge="DW"
              onClick={() => choosePaymentMethod("wallet")}
            />
            <PaymentMethodButton
              active={paymentMethod === "card"}
              icon={CreditCard}
              title="Credit / Debit Card"
              description="Visa, Mastercard and more"
              badge={
                <span className="flex items-center gap-0.5">
                  <span className="h-4 w-7">
                    <PaymentBrandLogo brand="visa" />
                  </span>
                  <span className="h-4 w-7">
                    <PaymentBrandLogo brand="mastercard" />
                  </span>
                </span>
              }
              onClick={() => choosePaymentMethod("card")}
            />
          </div>
        </div>

        {paymentMethod === "wallet" ? (
          <div
            role="status"
            className="flex items-center gap-3 rounded-xl border border-violet-500/30 bg-violet-500/10 p-3"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-orange-500 to-red-500 text-[8px] font-black">
              Digi
            </span>
            <div>
              <p className="text-xs font-black">DigiWallet</p>
              <p className="mt-0.5 text-[10px] leading-4 text-violet-200">
                DigiWallet payments are coming soon and are not available yet.
              </p>
            </div>
          </div>
        ) : (
          <CardDetails
            cardNumber={cardNumber}
            cardholderName={cardholderName}
            expiry={expiry}
            securityCode={securityCode}
            saveCard={saveCard}
            onCardNumberChange={setCardNumber}
            onCardholderNameChange={setCardholderName}
            onExpiryChange={setExpiry}
            onSecurityCodeChange={setSecurityCode}
            onSecurityCodeFocus={setIsSecurityCodeFocused}
            onSaveCardChange={setSaveCard}
          />
        )}

        <div className="flex items-center justify-between gap-3 border-t border-violet-500/15 pt-2">
          <div>
            {unavailable ? (
              <p
                role="status"
                className="max-w-sm text-xs font-semibold leading-4 text-violet-200"
              >
                This feature is coming soon and is not available yet. No payment
                was taken and your subscription was not changed.
              </p>
            ) : (
              <>
                <p className="text-[10px] text-zinc-500">Total</p>
                <p className="text-lg font-black">
                  {formatCurrency(amounts.recurringTotal)}
                </p>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => setUnavailable(true)}
            className="inline-flex min-h-10 min-w-32 shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-black text-white shadow-lg shadow-violet-950/30 transition hover:bg-violet-500"
          >
            <LockKeyhole className="h-4 w-4" /> Continue
          </button>
        </div>
      </div>
    </Modal>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof CreditCard;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-violet-600 to-indigo-500 shadow-lg shadow-violet-950/30">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <h3 className="text-sm font-black">{title}</h3>
        <p className="truncate text-[9px] text-slate-400">{description}</p>
      </div>
    </div>
  );
}

function PaymentMethodButton({
  active,
  icon: Icon,
  title,
  description,
  badge,
  onClick,
}: {
  active: boolean;
  icon: typeof CreditCard;
  title: string;
  description: string;
  badge: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex min-h-14 items-center gap-2 rounded-xl border p-2 text-left transition",
        active
          ? "border-violet-500 bg-violet-500/15 shadow-lg shadow-violet-950/20 ring-1 ring-violet-500"
          : "border-slate-600 bg-[#0b1729] hover:border-slate-500",
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800">
        <Icon className="h-4 w-4 text-slate-200" />
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block truncate text-[10px] sm:text-xs">
          {title}
        </strong>
        <span className="mt-0.5 hidden truncate text-[8px] text-slate-400 sm:block">
          {description}
        </span>
      </span>
      <span className="hidden rounded bg-white px-1 py-0.5 xl:block">
        {badge}
      </span>
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
          active
            ? "border-violet-500 bg-violet-600"
            : "border-slate-600 bg-transparent",
        )}
      >
        {active && <Check className="h-2.5 w-2.5" />}
      </span>
    </button>
  );
}

function CardDetails({
  cardNumber,
  cardholderName,
  expiry,
  securityCode,
  saveCard,
  onCardNumberChange,
  onCardholderNameChange,
  onExpiryChange,
  onSecurityCodeChange,
  onSecurityCodeFocus,
  onSaveCardChange,
}: {
  cardNumber: string;
  cardholderName: string;
  expiry: string;
  securityCode: string;
  saveCard: boolean;
  onCardNumberChange: (value: string) => void;
  onCardholderNameChange: (value: string) => void;
  onExpiryChange: (value: string) => void;
  onSecurityCodeChange: (value: string) => void;
  onSecurityCodeFocus: (focused: boolean) => void;
  onSaveCardChange: (value: boolean) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-[#091426]/80 p-2.5">
      <div className="flex items-center justify-between gap-3">
        <SectionHeading
          icon={CreditCard}
          title="Card Details"
          description="Enter your card information securely"
        />
        <div
          className="hidden items-center gap-1 sm:flex"
          aria-label="Accepted card networks"
        >
          {(["visa", "mastercard", "amex", "discover"] as const).map(
            (brand) => (
              <span
                key={brand}
                className="flex h-7 w-11 items-center justify-center overflow-hidden rounded border border-slate-200 bg-white px-0.5 shadow-sm"
              >
                <PaymentBrandLogo brand={brand} />
              </span>
            ),
          )}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-6 gap-2">
        <CheckoutInput
          id="subscription-card-number"
          label="Card Number"
          value={cardNumber}
          placeholder="1234 5678 9012 3456"
          autoComplete="cc-number"
          className="col-span-6"
          onChange={(value) => onCardNumberChange(formatCardNumber(value))}
          suffix={<CreditCard className="h-4 w-4" />}
        />
        <CheckoutInput
          id="subscription-card-name"
          label="Name on Card"
          value={cardholderName}
          placeholder="NAME SURNAME"
          autoComplete="cc-name"
          className="col-span-6 sm:col-span-3"
          onChange={(value) => onCardholderNameChange(value.toUpperCase())}
        />
        <CheckoutInput
          id="subscription-card-expiry"
          label="Expiry Date"
          value={expiry}
          placeholder="MM / YY"
          autoComplete="cc-exp"
          className="col-span-3 sm:col-span-2"
          onChange={(value) => onExpiryChange(formatExpiry(value))}
        />
        <CheckoutInput
          id="subscription-card-cvv"
          label="CVV"
          value={securityCode}
          placeholder="123"
          autoComplete="cc-csc"
          className="col-span-3 sm:col-span-1"
          type="password"
          maxLength={4}
          onFocus={() => onSecurityCodeFocus(true)}
          onBlur={() => onSecurityCodeFocus(false)}
          onChange={(value) =>
            onSecurityCodeChange(value.replace(/\D/g, "").slice(0, 4))
          }
          suffix={<CircleHelp className="h-4 w-4" />}
        />
      </div>

      <button
        type="button"
        role="checkbox"
        aria-checked={saveCard}
        onClick={() => onSaveCardChange(!saveCard)}
        className="mt-2 flex items-center gap-2 text-left"
      >
        <span
          className={cn(
            "flex h-4 w-4 items-center justify-center rounded border",
            saveCard
              ? "border-violet-500 bg-violet-600"
              : "border-slate-600 bg-slate-900",
          )}
        >
          {saveCard && <Check className="h-3 w-3" />}
        </span>
        <span>
          <strong className="block text-[9px] sm:text-[10px]">
            Save this card for future payments
          </strong>
          <span className="hidden text-[8px] text-slate-400 sm:block">
            Preview only. Card information is never submitted or saved.
          </span>
        </span>
      </button>
    </div>
  );
}

function CheckoutInput({
  id,
  label,
  value,
  placeholder,
  autoComplete,
  className,
  type = "text",
  maxLength,
  suffix,
  onChange,
  onFocus,
  onBlur,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  autoComplete: string;
  className?: string;
  type?: string;
  maxLength?: number;
  suffix?: React.ReactNode;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  return (
    <label htmlFor={id} className={cn("block min-w-0", className)}>
      <span className="mb-0.5 block text-[9px] font-bold text-slate-300">
        {label}
      </span>
      <span className="relative block">
        <input
          id={id}
          value={value}
          type={type}
          inputMode={id.includes("name") ? "text" : "numeric"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          maxLength={maxLength}
          onFocus={onFocus}
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-full rounded-lg border border-slate-600 bg-[#0d192b] px-3 pr-9 text-[11px] uppercase text-white outline-none transition placeholder:text-slate-500 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20"
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-300">
            {suffix}
          </span>
        )}
      </span>
    </label>
  );
}

function CardPreview({
  cardNumber,
  cardholderName,
  expiry,
  securityCode,
  flipped,
}: {
  cardNumber: string;
  cardholderName: string;
  expiry: string;
  securityCode: string;
  flipped: boolean;
}) {
  return (
    <section className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-2">
      <h3 className="mb-1 text-[9px] font-black uppercase tracking-wider text-violet-200">
        Card preview
      </h3>
      <div className="mx-auto aspect-[1.586/1] w-full max-w-48 [perspective:700px] sm:max-w-52">
        <div
          className={cn(
            "relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d]",
            flipped && "[transform:rotateY(180deg)]",
          )}
        >
          <div className="absolute inset-0 overflow-hidden rounded-xl border border-white/15 bg-linear-to-br from-violet-700 via-purple-700 to-indigo-950 p-3 shadow-xl shadow-violet-950/40 [backface-visibility:hidden]">
            <div className="absolute -right-10 -top-12 h-32 w-32 rounded-full bg-fuchsia-400/20 blur-2xl" />
            <div className="relative flex h-full flex-col justify-between">
              <div className="flex items-center justify-between">
                <CreditCard className="h-5 w-5 text-violet-100" />
                <span className="text-[8px] font-black uppercase tracking-wider">
                  {CARD_BRAND_LABELS[cardBrand(cardNumber)]}
                </span>
              </div>
              <div>
                <p className="font-mono text-[10px] font-bold tracking-[0.16em] sm:text-xs">
                  {cardNumber || "•••• •••• •••• ••••"}
                </p>
                <div className="mt-1.5 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[7px] font-bold uppercase tracking-widest text-violet-200/70">
                      Name
                    </p>
                    <p className="truncate text-[9px] font-bold uppercase">
                      {cardholderName || "NAME SURNAME"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[7px] font-bold uppercase tracking-widest text-violet-200/70">
                      Expires
                    </p>
                    <p className="text-[9px] font-bold">{expiry || "MM/YY"}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="absolute inset-0 overflow-hidden rounded-xl border border-white/15 bg-linear-to-br from-indigo-950 via-purple-800 to-violet-700 py-3 shadow-xl shadow-violet-950/40 [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <div className="mt-2 h-7 w-full bg-slate-950/90" />
            <div className="mx-3 mt-3 flex items-center">
              <div className="h-7 flex-1 rounded-l bg-white/90" />
              <div className="flex h-7 min-w-12 items-center justify-center rounded-r bg-slate-200 px-2 font-mono text-xs font-black text-slate-900">
                {securityCode || "CVV"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
