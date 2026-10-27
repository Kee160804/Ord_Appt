"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  Copy,
  FileText,
  Landmark,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Truck,
  UploadCloud,
  X,
} from "lucide-react";
import {
  trackingStatusLabel,
  type TrackedOrder,
} from "@/app/lib/order-tracking";
import { formatCurrency } from "@/app/lib/utils";

const panel =
  "rounded-xl border border-purple-500/20 bg-[#0c1020] p-4 light:border-slate-200 light:bg-white";
const primary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7c00ff] to-[#8b2cff] px-5 text-sm font-bold text-white hover:brightness-110 disabled:opacity-50";
function date(value: string | null) {
  return value
    ? new Date(value).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "";
}

export function OrderTrackingCenter({
  tenantId,
  accessToken,
  order,
  error,
  onClose,
  onRefresh,
}: {
  tenantId: string;
  accessToken: string;
  order: TrackedOrder;
  error: string;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [tab, setTab] = useState<"details" | "payment" | "delivery">("details");
  const [refreshing, setRefreshing] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const status =
    order.status === "CANCELLED"
      ? "Cancelled"
      : trackingStatusLabel(order.paymentStatus);
  const statusClass =
    order.paymentStatus === "PAID"
      ? "bg-emerald-500/15 text-emerald-300 light:text-emerald-700"
      : order.paymentStatus === "AWAITING_VERIFICATION"
        ? "bg-purple-500/20 text-purple-300 light:text-purple-700"
        : "bg-amber-500/15 text-amber-200 light:text-amber-800";
  return (
    <section className="mx-auto max-w-4xl py-5 sm:py-10">
      <div className="rounded-2xl border border-[#7c00ff]/40 bg-[#130b2a] p-4 text-white sm:p-6 light:bg-slate-50 light:text-slate-950">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2
                ref={heading}
                tabIndex={-1}
                className="break-all text-xl font-black outline-none"
              >
                Order #{order.orderNumber}
              </h2>
              <span
                role="status"
                className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass}`}
              >
                {status}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-400 light:text-slate-600">
              Placed on {date(order.createdAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close order and track another"
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 light:hover:bg-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div
          className="mt-5 grid grid-cols-3 gap-1 rounded-xl bg-[#080d19] p-1 light:bg-slate-200"
          role="tablist"
          aria-label="Order information"
        >
          {(
            [
              ["details", "Order Details"],
              ["payment", "Payment"],
              ["delivery", "Delivery"],
            ] as const
          ).map(([id, label], index) => (
            <button
              key={id}
              id={`tracking-tab-${id}`}
              role="tab"
              aria-selected={tab === id}
              aria-controls={`tracking-panel-${id}`}
              tabIndex={tab === id ? 0 : -1}
              onClick={() => setTab(id)}
              onKeyDown={(event) => {
                const ids = ["details", "payment", "delivery"] as const;
                const next =
                  event.key === "ArrowRight"
                    ? (index + 1) % 3
                    : event.key === "ArrowLeft"
                      ? (index + 2) % 3
                      : event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? 2
                          : -1;
                if (next >= 0) {
                  event.preventDefault();
                  setTab(ids[next]);
                  document.getElementById(`tracking-tab-${ids[next]}`)?.focus();
                }
              }}
              className={`min-h-11 rounded-lg border-b-2 px-2 text-xs font-bold sm:text-sm ${tab === id ? "border-[#8b2cff] bg-[#7c00ff]/20 text-purple-200 light:text-purple-800" : "border-transparent text-slate-400 hover:text-purple-300 light:text-slate-600"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-rose-400/30 p-3 text-sm text-rose-300 light:text-rose-700"
          >
            {error}
          </p>
        )}
        <div
          id={`tracking-panel-${tab}`}
          role="tabpanel"
          aria-labelledby={`tracking-tab-${tab}`}
          className="mt-5"
        >
          {tab === "details" ? (
            <OrderDetails order={order} />
          ) : tab === "payment" ? (
            <OrderPayment
              tenantId={tenantId}
              accessToken={accessToken}
              order={order}
              onRefresh={onRefresh}
            />
          ) : (
            <OrderDelivery order={order} />
          )}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-purple-500/20 pt-4 text-xs text-slate-400 light:text-slate-600">
          <span>Order status updates automatically every 20 seconds.</span>
          <button
            type="button"
            disabled={refreshing}
            onClick={async () => {
              setRefreshing(true);
              try {
                await onRefresh();
              } finally {
                setRefreshing(false);
              }
            }}
            className="inline-flex items-center gap-2 font-bold text-purple-400 light:text-purple-700"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
            />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>
    </section>
  );
}

function OrderDetails({ order }: { order: TrackedOrder }) {
  return (
    <div className="grid gap-4 md:grid-cols-[1.6fr_1fr]">
      <div className={panel}>
        <h3 className="text-sm font-bold">
          Items{" "}
          <span className="font-normal text-slate-400 light:text-slate-600">
            ({order.items.length} products ·{" "}
            {order.items.reduce((sum, item) => sum + item.quantity, 0)} items)
          </span>
        </h3>
        <ul className="mt-2 divide-y divide-purple-500/15">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-4">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-white/5 light:bg-slate-100">
                {item.image ? (
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    sizes="64px"
                    unoptimized
                    className="object-contain"
                  />
                ) : (
                  <Package className="m-4 h-8 w-8 text-purple-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{item.name}</p>
                {item.sku && (
                  <p className="mt-1 text-xs text-slate-400">{item.sku}</p>
                )}
                {item.addons.length > 0 && (
                  <p className="mt-1 text-xs text-slate-400">
                    {item.addons.map((addon) => addon.name).join(", ")}
                  </p>
                )}
                <p className="mt-1 text-xs text-slate-400 light:text-slate-600">
                  {formatCurrency(item.unitPrice)} each · ×{item.quantity}
                </p>
              </div>
              <span className="shrink-0 text-sm font-bold">
                {formatCurrency(item.subtotal)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className={`${panel} h-fit`}>
        <h3 className="text-sm font-bold">Order Summary</h3>
        <dl className="mt-5 space-y-3 text-sm">
          {[
            ["Subtotal", order.subtotal],
            ["Delivery Fee", order.deliveryFee],
            ["Tax", order.tax],
            ...(order.discount > 0 ? [["Discount", -order.discount]] : []),
          ].map(([label, amount]) => (
            <div key={label} className="flex justify-between gap-4">
              <dt className="text-slate-400 light:text-slate-600">{label}</dt>
              <dd>{formatCurrency(Number(amount))}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-5 flex justify-between gap-4 rounded-xl border border-purple-500/20 bg-[#7c00ff]/15 p-4 font-bold">
          <span>Total</span>
          <span className="text-purple-300 light:text-purple-700">
            {formatCurrency(order.total)}
          </span>
        </div>
        <p className="mt-4 text-xs text-slate-400 light:text-slate-600">
          {order.orderType === "delivery"
            ? "Delivery"
            : order.orderType === "pickup"
              ? "Pickup"
              : "Dine-in"}{" "}
          · {trackingStatusLabel(order.status)}
        </p>
      </div>
    </div>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 border-b border-purple-500/10 py-2 text-xs last:border-0">
      <div className="min-w-0">
        <span className="block text-slate-400 light:text-slate-600">
          {label}
        </span>
        <span className="mt-1 block break-all font-semibold">{value}</span>
        {failed && (
          <span role="status" className="block text-amber-400">
            Select and copy the value manually.
          </span>
        )}
      </div>
      <button
        type="button"
        aria-label={`Copy ${label}`}
        className="rounded-md p-2 text-purple-400"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setFailed(false);
          } catch {
            setFailed(true);
          }
        }}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}

function OrderPayment({
  tenantId,
  accessToken,
  order,
  onRefresh,
}: {
  tenantId: string;
  accessToken: string;
  order: TrackedOrder;
  onRefresh: () => Promise<void>;
}) {
  const receipt = order.receipt;
  const paid = order.paymentStatus === "PAID";
  return (
    <div className="space-y-4">
      {(paid || receipt) && (
        <div
          className={`flex items-start gap-3 rounded-xl border p-4 ${paid || receipt?.status === "VERIFIED" ? "border-emerald-500/30 bg-emerald-500/10" : "border-purple-500/30 bg-purple-500/10"}`}
        >
          <CheckCircle2
            className={`mt-0.5 h-6 w-6 shrink-0 ${paid ? "text-emerald-400" : "text-purple-400"}`}
          />
          <div>
            <h3 className="font-bold">
              {paid
                ? "Payment Verified"
                : receipt?.status === "AWAITING_VERIFICATION"
                  ? "Receipt Submitted Successfully"
                  : trackingStatusLabel(receipt?.status ?? order.paymentStatus)}
            </h3>
            <p className="mt-1 text-sm text-slate-300 light:text-slate-600">
              {paid
                ? "The business has confirmed your payment. View the Delivery tab for order progress."
                : receipt?.status === "AWAITING_VERIFICATION"
                  ? "Your receipt has been uploaded. The business will verify the payment and update your order."
                  : receipt?.reason ||
                    "Check the receipt status below for the business's update."}
            </p>
          </div>
        </div>
      )}
      {receipt && (
        <div className={panel}>
          <h3 className="text-sm font-bold">Receipt Details</h3>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            {[
              ["Submitted on", date(receipt.createdAt)],
              ["Amount", formatCurrency(receipt.amount)],
              ["Reference", receipt.reference || order.orderNumber],
              ["Status", trackingStatusLabel(receipt.status)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-slate-400 light:text-slate-600">
                  {label}
                </dt>
                <dd className="mt-1 break-words font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          {receipt.url ? (
            <a
              href={receipt.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-purple-500/40 px-4 py-2 text-sm font-bold text-purple-300 light:text-purple-700"
            >
              <FileText className="h-4 w-4" />
              View Receipt
            </a>
          ) : (
            <p className="mt-3 text-xs text-slate-400">
              Receipt preview is temporarily unavailable. Refresh to try again.
            </p>
          )}
        </div>
      )}
      {!paid && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className={panel}>
            <h3 className="flex items-center gap-2 font-bold">
              <Landmark className="h-5 w-5 text-purple-400" />
              {order.paymentMethod === "bank_transfer"
                ? "Pay via Bank Transfer"
                : "Payment Instructions"}
            </h3>
            {order.payment.instructions && (
              <p className="mt-3 whitespace-pre-wrap text-sm text-slate-300 light:text-slate-600">
                {order.payment.instructions}
              </p>
            )}
            {order.paymentMethod === "bank_transfer" ? (
              <>
                {order.payment.bankAccounts.length ? (
                  order.payment.bankAccounts.map((account) => (
                    <div
                      key={account.id}
                      className="mt-4 rounded-xl border border-purple-500/20 p-3"
                    >
                      <CopyField label="Bank Name" value={account.bankName} />
                      <CopyField
                        label="Account Name"
                        value={account.accountHolder}
                      />
                      <CopyField
                        label="Account Number"
                        value={account.accountNumber}
                      />
                      <CopyField label="Currency" value={account.currency} />
                      <CopyField label="Reference" value={order.orderNumber} />
                      {account.instructions && (
                        <p className="mt-3 text-xs text-slate-400 light:text-slate-600">
                          {account.instructions}
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="mt-3 text-sm text-slate-400">
                    Contact the business for bank details before transferring
                    payment.
                  </p>
                )}
                {order.canUploadReceipt && (
                  <div className="mt-4 rounded-xl border border-purple-500/30 bg-purple-500/10 p-3 text-xs leading-6">
                    <p className="font-bold">Important</p>
                    <ul className="ml-4 list-disc">
                      <li>
                        Transfer{" "}
                        {formatCurrency(
                          Math.max(0, order.total - order.amountPaid),
                        )}{" "}
                        to the business.
                      </li>
                      <li>
                        Use {order.orderNumber} as your payment reference.
                      </li>
                      <li>
                        Upload a clear receipt. Payment is confirmed after the
                        business verifies the funds.
                      </li>
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <p className="mt-4 text-sm text-slate-300 light:text-slate-600">
                {order.paymentMethod === "cash_on_delivery"
                  ? "Pay the business when your order is delivered."
                  : order.paymentMethod === "payment_on_pickup"
                    ? "Pay the business when you collect your order."
                    : "Arrange payment directly with the business."}
              </p>
            )}
            {order.payment.externalUrl && (
              <a
                href={order.payment.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`${primary} mt-4`}
              >
                Open Payment Provider
              </a>
            )}
            {order.reservationExpiresAt && (
              <p className="mt-4 text-xs text-amber-300 light:text-amber-800">
                Payment window ends {date(order.reservationExpiresAt)}.
              </p>
            )}
          </div>
          {order.canUploadReceipt ? (
            <TrackingReceiptUpload
              key={receipt?.id ?? "first"}
              tenantId={tenantId}
              accessToken={accessToken}
              order={order}
              onSubmitted={onRefresh}
            />
          ) : (
            <div
              className={`${panel} flex items-center justify-center text-center text-sm text-slate-400 light:text-slate-600`}
            >
              {receipt?.status === "AWAITING_VERIFICATION"
                ? "Your receipt is awaiting business verification. Check back here for updates."
                : "Receipt upload is not available for this order's current payment status or method."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TrackingReceiptUpload({
  tenantId,
  accessToken,
  order,
  onSubmitted,
}: {
  tenantId: string;
  accessToken: string;
  order: TrackedOrder;
  onSubmitted: () => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [amount, setAmount] = useState(
    String(Math.max(0, order.total - order.amountPaid)),
  );
  const [paymentDate, setPaymentDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  function selectFile(next?: File) {
    setMessage("");
    if (!next) return;
    if (
      !["image/jpeg", "image/png", "application/pdf"].includes(next.type) ||
      next.size === 0 ||
      next.size > 5 * 1024 * 1024
    ) {
      setMessage("Choose a JPG, PNG, or PDF no larger than 5 MB.");
      return;
    }
    setFile(next);
  }
  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file || busy || saved) return;
    setBusy(true);
    setMessage("");
    try {
      const form = new FormData();
      Object.entries({
        tenantId,
        targetType: "order",
        targetId: order.id,
        accessToken,
        customerEmail: order.customerEmail,
        amount,
        paymentDate,
        transactionReference: order.orderNumber,
      }).forEach(([key, value]) => form.set(key, value));
      form.set("receipt", file);
      const response = await fetch("/api/public/payment-receipts", {
        method: "POST",
        body: form,
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Unable to upload your receipt.");
      setSaved(true);
      setMessage(
        "Receipt submitted successfully. Awaiting business verification.",
      );
      await onSubmitted();
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : "Unable to upload your receipt.",
      );
    } finally {
      setBusy(false);
    }
  }
  const inputClass =
    "mt-1 w-full min-w-0 rounded-lg border border-purple-500/30 bg-transparent px-3 py-2 text-sm outline-none focus:border-purple-400";
  return (
    <form onSubmit={upload} className={panel}>
      <h3 className="font-bold">Upload Payment Receipt</h3>
      <fieldset disabled={busy || saved}>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (!busy && !saved) selectFile(event.dataTransfer.files[0]);
          }}
          className="mt-4 flex min-h-36 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-purple-400/70 bg-purple-500/5 p-4 text-center"
        >
          <UploadCloud className="h-8 w-8 text-purple-300" />
          <span className="text-sm font-semibold">
            Click to upload or drag and drop
          </span>
          <span className="text-xs text-slate-400">
            JPG, PNG or PDF (Max 5 MB)
          </span>
        </button>
        <input
          ref={fileInput}
          type="file"
          aria-label="Payment receipt"
          accept="image/jpeg,image/png,application/pdf"
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => selectFile(event.target.files?.[0])}
        />
        {file && (
          <div className="mt-3 flex items-center gap-3 rounded-lg bg-purple-500/10 p-3">
            <FileText className="h-6 w-6 shrink-0 text-purple-300" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{file.name}</p>
              <p className="text-xs text-slate-400">
                {Math.ceil(file.size / 1024)} KB
              </p>
            </div>
            <button
              type="button"
              aria-label="Remove selected receipt"
              onClick={() => {
                setFile(null);
                if (fileInput.current) fileInput.current.value = "";
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs">
            Amount paid
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="text-xs">
            Payment date
            <input
              type="date"
              required
              value={paymentDate}
              onChange={(event) => setPaymentDate(event.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <button
          disabled={!file || busy || saved}
          className={`${primary} mt-4 w-full`}
        >
          {busy ? "Uploading…" : saved ? "Receipt Submitted" : "Upload Receipt"}
        </button>
      </fieldset>
      {message && (
        <p
          role="status"
          className="mt-3 text-sm text-purple-300 light:text-purple-700"
        >
          {message}
        </p>
      )}
    </form>
  );
}

function OrderDelivery({ order }: { order: TrackedOrder }) {
  const pickup = order.orderType === "pickup";
  const stages = [
    "PENDING",
    "CONFIRMED",
    "PREPARING",
    "READY",
    ...(pickup ? [] : ["OUT_FOR_DELIVERY"]),
    "COMPLETED",
  ];
  const current = stages.indexOf(
    order.status === "DELIVERED" ? "COMPLETED" : order.status,
  );
  const cancelled = order.status === "CANCELLED";
  return (
    <div className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
      <div className={panel}>
        <h3 className="font-bold">Order Progress</h3>
        {cancelled && (
          <p className="mt-3 rounded-lg bg-rose-500/10 p-3 text-sm text-rose-300 light:text-rose-700">
            This order has been cancelled.
          </p>
        )}
        <ol className="mt-5 space-y-0">
          {stages.map((stage, index) => {
            const done = !cancelled && index <= current;
            const timestamp =
              order.history.find(
                (event) =>
                  event.status === stage ||
                  (stage === "COMPLETED" && event.status === "DELIVERED"),
              )?.createdAt ?? (stage === "PENDING" ? order.createdAt : null);
            return (
              <li
                key={stage}
                className="relative flex min-h-16 gap-3 pb-5 last:pb-0"
              >
                {index < stages.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={`absolute bottom-0 left-3 top-6 w-px ${done ? "bg-purple-500" : "bg-slate-700 light:bg-slate-300"}`}
                  />
                )}
                <span
                  className={`relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${done ? "border-purple-500 bg-[#7c00ff] text-white" : "border-slate-700 text-slate-500 light:border-slate-300"}`}
                >
                  {done ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  )}
                </span>
                <div>
                  <p
                    className={`text-sm font-semibold ${done ? "" : "text-slate-500"}`}
                  >
                    {stage === "PENDING"
                      ? "Order Placed"
                      : stage === "READY"
                        ? pickup
                          ? "Ready for Pickup"
                          : "Ready for Dispatch"
                        : trackingStatusLabel(stage)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400 light:text-slate-600">
                    {timestamp
                      ? date(timestamp)
                      : done
                        ? "Updated by business"
                        : "Pending"}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="mt-4 border-t border-purple-500/20 pt-4 text-sm">
          <p className="font-bold">
            Payment: {trackingStatusLabel(order.paymentStatus)}
          </p>
          {order.receipt?.verifiedAt && (
            <p className="mt-1 text-xs text-slate-400">
              Verified {date(order.receipt.verifiedAt)}
            </p>
          )}
        </div>
      </div>
      <div className="space-y-3">
        <InfoCard
          icon={Truck}
          title={pickup ? "Pickup Time" : "Delivery Time"}
          text={
            order.requestedTime
              ? `Requested: ${date(order.requestedTime)}. Await business confirmation.`
              : "The business has not provided a confirmed time yet."
          }
        />
        <InfoCard
          icon={MapPin}
          title={pickup ? "Pickup Location" : "Delivery Address"}
          text={
            (pickup ? order.business.pickupLocation : order.deliveryAddress) ||
            "Contact the business to confirm the location."
          }
        />
        <InfoCard
          icon={Phone}
          title="Contact Business"
          text={
            order.business.phone ||
            "Use the storefront Contact tab to reach the business."
          }
        />
        <InfoCard
          icon={FileText}
          title="Special Instructions"
          text={
            [
              order.instructions,
              pickup
                ? order.business.pickupInstructions
                : order.business.deliveryNotes,
            ]
              .filter(Boolean)
              .join("\n") || "No special instructions."
          }
        />
      </div>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Truck;
  title: string;
  text: string;
}) {
  return (
    <div className={`${panel} flex items-start gap-3`}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-purple-400" />
      <div>
        <h4 className="text-sm font-bold">{title}</h4>
        <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-400 light:text-slate-600">
          {text}
        </p>
      </div>
    </div>
  );
}
