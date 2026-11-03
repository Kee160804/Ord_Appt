"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Mail,
  PackageSearch,
  ShieldCheck,
} from "lucide-react";
import type { TrackedOrder } from "@/app/lib/order-tracking";
import { OrderTrackingCenter } from "@/app/components/OrderTrackingCenter";

const primary =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7c00ff] to-[#8b2cff] px-5 text-sm font-bold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-purple-400";
const field =
  "w-full rounded-xl border border-[#7c00ff]/40 bg-[#0d0820] px-4 py-3 text-sm text-white outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 light:bg-white light:text-slate-950";

class TrackingError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
async function trackingRequest<T>(
  body: object,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch("/api/public/order-tracking", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal,
  });
  const data = await response.json();
  if (!response.ok)
    throw new TrackingError(
      data.error ||
        "Unable to load your order or appointment. Please try again.",
      response.status,
    );
  return data as T;
}

export function StorefrontOrderTracking({
  tenantId,
  viewOnly = false,
  initialOrderNumber = "",
  mode = "order",
}: {
  tenantId: string;
  viewOnly?: boolean;
  initialOrderNumber?: string;
  mode?: "order" | "appointment";
}) {
  const [step, setStep] = useState<"lookup" | "verify" | "order">("lookup");
  const [reference, setReference] = useState(initialOrderNumber);
  const [token, setToken] = useState("");
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [expiresAt, setExpiresAt] = useState(0);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(0);
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const heading = useRef<HTMLHeadingElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => () => requestRef.current?.abort(), []);
  useEffect(() => {
    if (step === "verify") inputs.current[0]?.focus();
    else heading.current?.focus();
  }, [step]);
  useEffect(() => {
    if (step !== "verify") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [step]);

  const refreshOrder = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const result = await trackingRequest<{ order: TrackedOrder }>(
          { action: "details", tenantId, accessToken: token },
          signal,
        );
        if (!signal?.aborted) {
          setOrder(result.order);
          setError("");
        }
      } catch (cause) {
        if (signal?.aborted) return;
        if (cause instanceof TrackingError && cause.status === 401) {
          setOrder(null);
          setToken("");
          setStep("lookup");
        }
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to refresh your transaction.",
        );
      }
    },
    [tenantId, token],
  );

  useEffect(() => {
    if (step !== "order") return;
    const controller = new AbortController();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible")
        void refreshOrder(controller.signal);
    }, 20_000);
    return () => {
      window.clearInterval(timer);
      controller.abort();
    };
  }, [step, refreshOrder]);

  function reset() {
    requestRef.current?.abort();
    setToken("");
    setOrder(null);
    setError("");
    setDigits(Array(6).fill(""));
    setStep("lookup");
  }

  async function sendCode(event?: React.FormEvent) {
    event?.preventDefault();
    if (busy) return;
    if (viewOnly) {
      setError(
        `${mode === "appointment" ? "Booking" : "Order"} tracking is available on the business's live storefront.`,
      );
      return;
    }
    setBusy(true);
    setError("");
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const result = await trackingRequest<{
        accessToken: string;
        expiresAt: string;
        resendAfter: number;
      }>(
        { action: "request", tenantId, orderNumber: reference },
        controller.signal,
      );
      setToken(result.accessToken);
      setExpiresAt(Date.parse(result.expiresAt));
      setResendAt(Date.now() + result.resendAfter * 1000);
      setNow(Date.now());
      setDigits(Array(6).fill(""));
      setStep("verify");
      inputs.current[0]?.focus();
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(
          cause instanceof Error ? cause.message : "Unable to request a code.",
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (busy || digits.join("").length !== 6) return;
    setBusy(true);
    setError("");
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const result = await trackingRequest<{ order: TrackedOrder }>(
        {
          action: "verify",
          tenantId,
          accessToken: token,
          code: digits.join(""),
        },
        controller.signal,
      );
      setOrder(result.order);
      setStep("order");
      setDigits(Array(6).fill(""));
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to verify your code.",
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  function fillDigits(value: string, start: number) {
    const numbers = value.replace(/\D/g, "").slice(0, 6);
    setDigits((current) => {
      const next = [...current];
      if (!numbers) next[start] = "";
      else
        [...numbers].forEach((digit, index) => {
          if (start + index < 6) next[start + index] = digit;
        });
      return next;
    });
    if (numbers) inputs.current[Math.min(5, start + numbers.length)]?.focus();
  }

  if (step === "order" && order)
    return (
      <OrderTrackingCenter
        tenantId={tenantId}
        accessToken={token}
        order={order}
        error={error}
        onClose={reset}
        onRefresh={() => refreshOrder()}
      />
    );

  const resendSeconds = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const expired = now >= expiresAt;
  return (
    <section className="flex min-h-[60vh] items-start justify-center py-8 sm:py-14">
      <div className="w-full max-w-md rounded-2xl border border-[#7c00ff]/40 bg-[#130b2a] p-5 text-white sm:p-7 light:border-purple-200 light:bg-white light:text-slate-950">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#8b2cff]/40 bg-[#7c00ff]/20 text-[#b86cff] light:text-purple-700">
          {step === "lookup" ? (
            <PackageSearch className="h-7 w-7" />
          ) : (
            <ShieldCheck className="h-7 w-7" />
          )}
        </div>
        <h2
          ref={heading}
          tabIndex={-1}
          className="mt-4 text-center text-xl font-black outline-none"
        >
          {step === "lookup"
            ? mode === "appointment"
              ? "Track Your Booking"
              : "Track Your Order"
            : mode === "appointment"
              ? "Verify Your Booking"
              : "Verify Your Order"}
        </h2>
        {step === "lookup" ? (
          <>
            <p className="mt-2 text-center text-sm leading-6 text-slate-300 light:text-slate-600">
              Enter the reference provided after{" "}
              {mode === "appointment" ? "booking" : "checkout"} to view details,
              payment status, and progress.
            </p>
            <form className="mt-6" onSubmit={sendCode}>
              <label
                htmlFor="order-reference"
                className="mb-2 block text-sm font-bold"
              >
                {mode === "appointment"
                  ? "Booking Reference"
                  : "Order Reference"}
              </label>
              <input
                id="order-reference"
                name="order-reference"
                required
                maxLength={50}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                value={reference}
                onChange={(event) =>
                  setReference(event.target.value.toUpperCase())
                }
                placeholder={
                  mode === "appointment"
                    ? "e.g. AP-945EF35BD72C"
                    : "e.g. TR-945EF35BD72C"
                }
                className={field}
              />
              <button disabled={busy} className={primary + " mt-4 w-full"}>
                {busy ? "Sending code…" : "Find My Reference"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="mt-2 text-center text-sm leading-6 text-slate-300 light:text-slate-600">
              If this reference matches a{" "}
              {mode === "appointment" ? "booking" : "order"}, a six-digit
              verification code will be sent to the customer email on file.
            </p>
            <div className="mt-5 flex items-center gap-3 rounded-xl border border-purple-500/25 bg-[#0d0820] p-3 text-xs light:bg-purple-50">
              <Mail className="h-4 w-4 shrink-0 text-purple-400" />
              <span>
                Check your {mode === "appointment" ? "booking" : "checkout"}{" "}
                email, including spam.
              </span>
            </div>
            <form onSubmit={verify} className="mt-5">
              <fieldset disabled={busy}>
                <legend className="mb-3 text-sm font-bold">
                  Verification code
                </legend>
                <div
                  className="grid grid-cols-6 gap-2"
                  onPaste={(event) => {
                    event.preventDefault();
                    fillDigits(event.clipboardData.getData("text"), 0);
                  }}
                >
                  {digits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(element) => {
                        inputs.current[index] = element;
                      }}
                      aria-label={`Digit ${index + 1} of 6`}
                      inputMode="numeric"
                      autoComplete={index === 0 ? "one-time-code" : "off"}
                      value={digit}
                      onFocus={(event) => event.target.select()}
                      onChange={(event) =>
                        fillDigits(event.target.value, index)
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Backspace" && !digit && index > 0)
                          inputs.current[index - 1]?.focus();
                        if (event.key === "ArrowLeft" && index > 0)
                          inputs.current[index - 1]?.focus();
                        if (event.key === "ArrowRight" && index < 5)
                          inputs.current[index + 1]?.focus();
                      }}
                      className={
                        field + " min-w-0 px-0 text-center text-xl font-bold"
                      }
                    />
                  ))}
                </div>
              </fieldset>
              <p className="mt-3 text-center text-xs text-slate-400 light:text-slate-600">
                {expired
                  ? "This code has expired. Request a new code below."
                  : "Your code expires in 10 minutes."}
              </p>
              <div className="mt-4 text-center text-xs">
                Didn&apos;t receive the code?{" "}
                <button
                  type="button"
                  onClick={() => void sendCode()}
                  disabled={busy || resendSeconds > 0}
                  className="font-bold text-purple-400 disabled:opacity-50 light:text-purple-700"
                >
                  Resend Code
                  {resendSeconds > 0
                    ? ` (${String(Math.floor(resendSeconds / 60)).padStart(2, "0")}:${String(resendSeconds % 60).padStart(2, "0")})`
                    : ""}
                </button>
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={reset}
                  className="inline-flex items-center gap-2 rounded-xl border border-purple-500/30 px-4 text-sm font-bold disabled:opacity-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  disabled={busy || expired || digits.join("").length !== 6}
                  className={primary + " flex-1 px-3"}
                >
                  {busy ? "Verifying…" : "Verify & Continue"}
                </button>
              </div>
            </form>
          </>
        )}
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200 light:text-rose-700"
          >
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
