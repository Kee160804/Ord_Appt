"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  ClipboardCheck,
  HandCoins,
  Info,
  Landmark,
  Link2,
  Pencil,
  FileText,
  Plus,
  Save,
  Search,
  Trash2,
  WalletCards,
  XCircle,
} from "lucide-react";
import { Button } from "@/app/components/Button";
import { StatusBadge } from "@/app/components/Badge";
import {
  DEFAULT_FULFILLMENT_CONFIGURATION,
  PAYMENT_METHOD_LABELS,
  type BankAccountConfiguration,
  type BusinessPaymentMethod,
  type FulfillmentConfiguration,
  type PaymentMethodConfiguration,
} from "@/app/lib/business-payments";
import {
  loadBusinessPaymentSettings,
  saveBusinessPaymentSettings,
} from "@/app/services/businessPaymentService";
import type { Tenant } from "@/app/types/index";

const METHODS_BY_BUSINESS: Record<
  Tenant["businessType"],
  BusinessPaymentMethod[]
> = {
  appointment: ["bank_transfer", "payment_at_appointment", "external_link"],
  ordering: [
    "bank_transfer",
    "cash_on_delivery",
    "payment_on_pickup",
    "external_link",
  ],
  retail: [
    "bank_transfer",
    "cash_on_delivery",
    "payment_on_pickup",
    "external_link",
  ],
};

type Submission = {
  id: string;
  order_id: string | null;
  appointment_id: string | null;
  customer_name: string;
  customer_email: string;
  expected_amount: number | string;
  submitted_amount: number | string;
  payment_date: string;
  transaction_reference: string | null;
  notes: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  receiptUrl: string | null;
  target: {
    order_number?: string;
    appointment_number?: string;
    total?: number | string;
    payment_status?: string;
    fulfillment_status?: string;
    status?: string;
  } | null;
};

export function PaymentFulfillmentView({ tenant }: { tenant: Tenant }) {
  const [tab, setTab] = useState<"settings" | "verification">("settings");
  const [methods, setMethods] = useState<PaymentMethodConfiguration[]>([]);
  const [accounts, setAccounts] = useState<BankAccountConfiguration[]>([]);
  const [fulfillment, setFulfillment] = useState<FulfillmentConfiguration>(
    DEFAULT_FULFILLMENT_CONFIGURATION,
  );
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [filter, setFilter] = useState("AWAITING_VERIFICATION");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schemaUnavailable, setSchemaUnavailable] = useState(false);
  const [editingAccount, setEditingAccount] = useState<number | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const result = await loadBusinessPaymentSettings(tenant.id);
      setSchemaUnavailable(false);
      const allowedMethods = METHODS_BY_BUSINESS[tenant.businessType];
      setMethods(
        result.methods.map((method) => ({
          ...method,
          enabled: allowedMethods.includes(method.method)
            ? method.enabled
            : false,
          modules: [tenant.businessType],
        })),
      );
      setAccounts(result.bankAccounts);
      setFulfillment(result.fulfillment);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unable to load settings.";
      setMessage(errorMessage);
      setSchemaUnavailable(
        errorMessage.includes("required Supabase migration"),
      );
    } finally {
      setLoading(false);
    }
  }, [tenant.id, tenant.businessType]);

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/payments/submissions?tenantId=${tenant.id}&status=${filter}`,
      );
      const result = (await response.json()) as {
        submissions?: Submission[];
        error?: string;
      };
      if (!response.ok)
        throw new Error(result.error || "Unable to load submissions.");
      setSubmissions(result.submissions ?? []);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to load submissions.",
      );
    } finally {
      setLoading(false);
    }
  }, [tenant.id, filter]);

  useEffect(() => {
    if (tab === "settings") void loadSettings();
    else void loadSubmissions();
  }, [tab, loadSettings, loadSubmissions]);

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      await saveBusinessPaymentSettings(
        tenant.id,
        methods.map((method) => ({
          ...method,
          enabled: METHODS_BY_BUSINESS[tenant.businessType].includes(
            method.method,
          )
            ? method.enabled
            : false,
          modules: [tenant.businessType],
        })),
        accounts,
        fulfillment,
      );
      setMessage("Payment and fulfillment settings saved.");
      await loadSettings();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save settings.",
      );
    } finally {
      setSaving(false);
    }
  }

  function updateMethod(
    method: BusinessPaymentMethod,
    patch: Partial<PaymentMethodConfiguration>,
  ) {
    setMethods((current) =>
      current.map((item) =>
        item.method === method ? { ...item, ...patch } : item,
      ),
    );
  }

  function addBankAccount() {
    updateMethod("bank_transfer", { enabled: true });
    setAccounts((current) => [
      ...current,
      {
        label: `Account ${current.length + 1}`,
        bankName: "",
        accountHolder: "",
        accountNumber: "",
        accountType: "",
        currency: "BZD",
        instructions: "",
        isActive: true,
        sortOrder: current.length,
      },
    ]);
    window.requestAnimationFrame(() =>
      document
        .getElementById("customer-bank-accounts")
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  async function verify(
    submission: Submission,
    action: "verify" | "reject" | "request_resubmission",
  ) {
    const comment =
      action === "verify"
        ? "Funds confirmed in the business bank account."
        : window.prompt(
            action === "reject"
              ? "Why was this receipt rejected?"
              : "What should the customer correct?",
          );
    if (action !== "verify" && !comment) return;
    if (
      action === "verify" &&
      !window.confirm(
        "Confirm only after the funds appear in the business bank account. Continue?",
      )
    )
      return;
    const response = await fetch("/api/payments/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId: tenant.id,
        submissionId: submission.id,
        action,
        comment,
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok)
      setMessage(result.error || "Unable to process submission.");
    else {
      setMessage(
        action !== "verify"
          ? "Receipt review updated in tracking. No customer email was sent."
          : tenant.businessType === "retail"
            ? "Payment confirmed and the retail payment-confirmation email was queued."
            : tenant.businessType === "appointment"
              ? "Receipt accepted in tracking. No customer email was sent; confirm the appointment separately after full payment."
              : "Payment accepted in tracking. No customer email was sent; use Ready or Cancelled for the final order email.",
      );
      await loadSubmissions();
    }
  }

  const visibleSubmissions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return submissions;
    return submissions.filter((item) =>
      [
        item.customer_name,
        item.customer_email,
        item.transaction_reference,
        item.target?.order_number,
        item.target?.appointment_number,
        item.id,
      ].some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(query),
      ),
    );
  }, [submissions, search]);

  const paymentMethodIcons: Record<BusinessPaymentMethod, typeof Landmark> = {
    bank_transfer: Landmark,
    cash_on_delivery: Banknote,
    payment_on_pickup: WalletCards,
    payment_at_appointment: HandCoins,
    external_link: Link2,
  };

  return (
    <div className="dashboard-page payment-fulfillment-page">
      <div className="payment-direct-notice">
        <Info aria-hidden="true" />
        <div>
          <p>
            Customer payments go directly to {tenant.name}. YuhBusiness does not
            collect, hold, distribute, or verify these funds.
          </p>
          <p>Subscription billing remains separate.</p>
          <strong>
            {tenant.businessType === "retail"
              ? "Confirming payment sends the retail payment-confirmation email."
              : tenant.businessType === "appointment"
                ? "Receipt approval updates tracking only; confirm the appointment separately after full payment."
                : "Payment approval updates tracking only; Ready or Cancelled sends the final order email."}
          </strong>
        </div>
      </div>
      <div className="payment-page-tabs">
        {(
          [
            ["settings", "Payment & Fulfillment Settings"],
            ["verification", "Payment Verification"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={tab === value ? "active" : ""}
          >
            {label}
          </button>
        ))}
      </div>
      {message && (
        <p className="rounded-xl border border-violet-400/20 bg-violet-500/10 px-4 py-3 text-sm">
          {message}
        </p>
      )}
      {loading ? (
        <p className="py-10 text-center text-slate-400">Loading…</p>
      ) : schemaUnavailable && tab === "settings" ? (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-6 text-sm text-amber-100 light:text-amber-900">
          Apply{" "}
          <code>202610220001_business_managed_payments_fulfillment.sql</code> to
          the connected Supabase project, then reload this page. No existing
          orders, customers, analytics, or subscription billing are changed by
          this additive migration.
        </div>
      ) : tab === "settings" ? (
        <div className="payment-settings-stack">
          {!accounts.some((account) => account.isActive) && (
            <div className="flex flex-col gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm font-medium text-amber-300 light:text-amber-800 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Bank transfer is selected, but the business must add an active
                destination bank account before this request can be submitted.
              </span>
              <Button type="button" size="sm" onClick={addBankAccount}>
                <Plus className="h-4 w-4" /> Add bank account
              </Button>
            </div>
          )}
          <section className="payment-panel payment-methods-panel">
            <h2>Payment methods</h2>
            <div className="payment-method-grid">
              {methods
                .filter((item) =>
                  METHODS_BY_BUSINESS[tenant.businessType].includes(
                    item.method,
                  ),
                )
                .map((item) => {
                  const MethodIcon = paymentMethodIcons[item.method];
                  return (
                    <div key={item.method} className="payment-method-card">
                      <div className="payment-method-heading">
                        <span className="payment-method-icon">
                          <MethodIcon />
                        </span>
                        <div>
                          <strong>{PAYMENT_METHOD_LABELS[item.method]}</strong>
                          <span>Customer instructions</span>
                        </div>
                        <label className="payment-check-label">
                          <input
                            type="checkbox"
                            checked={item.enabled}
                            onChange={(event) =>
                              updateMethod(item.method, {
                                enabled: event.target.checked,
                              })
                            }
                          />
                          Show at checkout
                        </label>
                      </div>
                      <textarea
                        value={item.instructions}
                        onChange={(event) =>
                          updateMethod(item.method, {
                            instructions: event.target.value,
                          })
                        }
                        placeholder="Customer instructions"
                        className={`payment-method-input ${item.method === "external_link" ? "external-instructions" : ""}`}
                      />
                      {item.method === "external_link" && (
                        <input
                          type="url"
                          value={item.externalUrl ?? ""}
                          onChange={(event) =>
                            updateMethod(item.method, {
                              externalUrl: event.target.value,
                            })
                          }
                          placeholder="https://business-payment-provider.example/pay"
                          className="payment-method-input"
                        />
                      )}
                    </div>
                  );
                })}
            </div>
          </section>

          <section
            id="customer-bank-accounts"
            className="payment-panel bank-accounts-panel scroll-mt-24"
          >
            <div className="payment-panel-heading">
              <h2>Bank accounts</h2>
              <Button size="sm" onClick={addBankAccount}>
                <Plus className="h-4 w-4" /> Add account
              </Button>
            </div>
            <div className="bank-account-list">
              {accounts.map((account, index) => (
                <div
                  key={account.id ?? `new-${index}`}
                  className="bank-account-row"
                >
                  <span className="bank-account-icon">
                    <Landmark />
                  </span>
                  <label className="bank-account-identity">
                    <input
                      value={account.label}
                      aria-label="Account label"
                      onChange={(event) =>
                        setAccounts((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, label: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                    <input
                      value={account.bankName}
                      aria-label="Bank name"
                      onChange={(event) =>
                        setAccounts((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, bankName: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </label>
                  {(
                    [
                      ["Account number", "accountNumber"],
                      ["Account holder", "accountHolder"],
                      ["Currency", "currency"],
                    ] as const
                  ).map(([label, key]) => (
                    <label className="bank-account-field" key={key}>
                      <span>{label}</span>
                      <input
                        value={String(account[key])}
                        onChange={(event) =>
                          setAccounts((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, [key]: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </label>
                  ))}
                  <label className="bank-active-control">
                    <input
                      type="checkbox"
                      checked={account.isActive}
                      onChange={(event) =>
                        setAccounts((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, isActive: event.target.checked }
                              : item,
                          ),
                        )
                      }
                    />
                    <span>Active</span>
                  </label>
                  <button
                    type="button"
                    aria-label="Edit bank account"
                    className="bank-edit-button"
                    onClick={() =>
                      setEditingAccount(editingAccount === index ? null : index)
                    }
                  >
                    <Pencil />
                  </button>
                  <button
                    aria-label="Remove bank account"
                    onClick={() =>
                      setAccounts((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    className="bank-delete-button"
                  >
                    <Trash2 />
                  </button>
                  {editingAccount === index && (
                    <div className="bank-account-extra">
                      <label>
                        Account type
                        <input
                          value={account.accountType}
                          onChange={(event) =>
                            setAccounts((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, accountType: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </label>
                      <label>
                        Additional instructions
                        <textarea
                          value={account.instructions}
                          onChange={(event) =>
                            setAccounts((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? {
                                      ...item,
                                      instructions: event.target.value,
                                    }
                                  : item,
                              ),
                            )
                          }
                        />
                      </label>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="bank-account-note">
              Active account details are shown to customers only after they
              choose bank transfer and create a secure order or booking.
            </p>
            <Button
              type="button"
              className="bank-account-save"
              onClick={() => void save()}
              disabled={saving || accounts.length === 0}
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save bank account details"}
            </Button>
          </section>

          <section className="rounded-2xl border border-slate-700 bg-slate-900/50 p-5 light:border-slate-200 light:bg-white">
            <h2 className="text-lg font-black">Fulfillment & communication</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["Pickup enabled", "pickupEnabled"],
                  ["Local delivery", "localDeliveryEnabled"],
                  ["Nationwide delivery", "nationwideDeliveryEnabled"],
                  ["Delivery fee requires confirmation", "manualDeliveryQuote"],
                ] as const
              ).map(([label, key]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={fulfillment[key]}
                    onChange={(event) =>
                      setFulfillment((current) => ({
                        ...current,
                        [key]: event.target.checked,
                      }))
                    }
                  />
                  {label}
                </label>
              ))}
              {(
                [
                  ["Pickup location", "pickupLocation"],
                  ["WhatsApp number", "whatsappNumber"],
                ] as const
              ).map(([label, key]) => (
                <label key={key} className="text-xs font-semibold">
                  {label}
                  <input
                    value={String(fulfillment[key])}
                    onChange={(event) =>
                      setFulfillment((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm light:border-slate-300 light:bg-white"
                  />
                </label>
              ))}
              <label className="text-xs font-semibold">
                Preparation time (minutes)
                <input
                  type="number"
                  min="0"
                  value={fulfillment.preparationMinutes}
                  onChange={(event) =>
                    setFulfillment((current) => ({
                      ...current,
                      preparationMinutes: Number(event.target.value),
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm light:border-slate-300 light:bg-white"
                />
              </label>
              {(
                [
                  ["Pickup instructions", "pickupInstructions"],
                  ["Delivery notes", "deliveryNotes"],
                ] as const
              ).map(([label, key]) => (
                <label
                  key={key}
                  className="text-xs font-semibold sm:col-span-2"
                >
                  {label}
                  <textarea
                    value={String(fulfillment[key])}
                    onChange={(event) =>
                      setFulfillment((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                    className="mt-1 min-h-20 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm light:border-slate-300 light:bg-white"
                  />
                </label>
              ))}
            </div>
          </section>
          {tenant.businessType === "appointment" && (
            <section className="rounded-2xl border border-violet-400/30 bg-violet-500/5 p-5 light:bg-violet-50">
              <h2 className="text-lg font-black">
                In-person appointment deposit hold
              </h2>
              <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
                Appointments are first come, first served. Set how long a
                customer has to pay an in-person deposit before the pending slot
                can be released.
              </p>
              <label className="mt-4 block max-w-sm text-xs font-semibold">
                Minutes allowed to secure the appointment
                <input
                  type="number"
                  min="5"
                  max="1440"
                  value={fulfillment.paymentWindowMinutes}
                  onChange={(event) =>
                    setFulfillment((current) => ({
                      ...current,
                      paymentWindowMinutes: Number(event.target.value),
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm light:border-slate-300 light:bg-white"
                />
              </label>
            </section>
          )}
          {tenant.businessType === "retail" && (
            <section className="rounded-2xl border border-violet-400/30 bg-violet-500/5 p-5 light:bg-violet-50">
              <h2 className="text-lg font-black">
                Retail purchase reservations
              </h2>
              <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
                Protect limited stock while a bank-transfer customer verifies
                their email and submits a receipt.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={fulfillment.retailReservationsEnabled}
                    onChange={(event) =>
                      setFulfillment((current) => ({
                        ...current,
                        retailReservationsEnabled: event.target.checked,
                      }))
                    }
                  />
                  Require email verification for retail bank-transfer
                  reservations
                </label>
                <label className="text-xs font-semibold">
                  Minutes to enter email code
                  <input
                    type="number"
                    min="2"
                    max="30"
                    value={fulfillment.emailVerificationMinutes}
                    onChange={(event) =>
                      setFulfillment((current) => ({
                        ...current,
                        emailVerificationMinutes: Number(event.target.value),
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm light:border-slate-300 light:bg-white"
                  />
                </label>
                <label className="text-xs font-semibold">
                  Minutes to upload receipt after verification
                  <input
                    type="number"
                    min="5"
                    max="1440"
                    value={fulfillment.paymentWindowMinutes}
                    onChange={(event) =>
                      setFulfillment((current) => ({
                        ...current,
                        paymentWindowMinutes: Number(event.target.value),
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm light:border-slate-300 light:bg-white"
                  />
                </label>
              </div>
            </section>
          )}
          <Button onClick={() => void save()} disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </div>
      ) : (
        <div className="payment-verification-view">
          <div className="verification-controls">
            <label className="verification-search">
              <Search />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search customer, reference, or order"
              />
            </label>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="AWAITING_VERIFICATION">
                Awaiting verification
              </option>
              <option value="VERIFIED">Verified</option>
              <option value="REJECTED">Rejected</option>
              <option value="RESUBMISSION_REQUESTED">
                Resubmission requested
              </option>
              <option value="ALL">All</option>
            </select>
          </div>
          {visibleSubmissions.map((submission) => (
            <article key={submission.id} className="payment-submission-card">
              <div className="flex flex-col justify-between gap-3 sm:flex-row">
                <div>
                  <p className="font-black">
                    {submission.target?.order_number ??
                      submission.target?.appointment_number ??
                      `Appointment ${submission.appointment_id?.slice(0, 8).toUpperCase()}`}
                  </p>
                  <p className="text-sm text-slate-400">
                    {submission.customer_name} · {submission.customer_email}
                  </p>
                </div>
                <StatusBadge
                  status={submission.status.toLowerCase()}
                  className="h-fit"
                />
              </div>
              <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
                <p>
                  Expected:{" "}
                  <b>${Number(submission.expected_amount).toFixed(2)}</b>
                </p>
                <p>
                  Submitted:{" "}
                  <b>${Number(submission.submitted_amount).toFixed(2)}</b>
                </p>
                <p>
                  Date: <b>{submission.payment_date}</b>
                </p>
                <p>
                  Reference:{" "}
                  <b>{submission.transaction_reference || "Not provided"}</b>
                </p>
                <p>
                  Payment:{" "}
                  {submission.target?.payment_status ? (
                    <StatusBadge
                      status={submission.target.payment_status.toLowerCase()}
                      className="ml-1 align-middle"
                    />
                  ) : (
                    <b>Not available</b>
                  )}
                </p>
                <p>
                  Fulfillment:{" "}
                  <b>
                    {submission.target?.fulfillment_status ??
                      submission.target?.status}
                  </b>
                </p>
              </div>
              {submission.notes && (
                <p className="mt-3 rounded-lg bg-slate-800/60 p-3 text-sm light:bg-slate-100">
                  {submission.notes}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {submission.receiptUrl && (
                  <a
                    href={submission.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-500 px-3 py-2 text-xs font-bold"
                  >
                    <FileText className="h-4 w-4" />
                    View receipt
                  </a>
                )}
                {submission.status === "AWAITING_VERIFICATION" && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => void verify(submission, "verify")}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {tenant.businessType === "retail"
                        ? "Confirm payment & email customer"
                        : "Accept receipt (tracker only)"}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        void verify(submission, "request_resubmission")
                      }
                    >
                      <Banknote className="h-4 w-4" />
                      Request another receipt
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => void verify(submission, "reject")}
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </Button>
                  </>
                )}
              </div>
            </article>
          ))}
          {!visibleSubmissions.length && (
            <div className="payment-empty-state">
              <span>
                <ClipboardCheck />
              </span>
              <strong>No payment submissions match this view.</strong>
              <p>
                When customers submit a payment for verification, it will appear
                here.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
