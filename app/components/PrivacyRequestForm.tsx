"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";

import { Button } from "@/app/components/Button";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 light:border-slate-300 light:bg-white light:text-slate-950";

export function PrivacyRequestForm() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    requestType: "ACCESS",
    relationship: "ACCOUNT_HOLDER",
    businessReference: "",
    details: "",
    website: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    referenceCode: string;
    acknowledgementSent: boolean;
  } | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/privacy/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json()) as {
        error?: string;
        referenceCode?: string;
        acknowledgementSent?: boolean;
      };
      if (!response.ok || !payload.referenceCode) {
        throw new Error(payload.error || "Unable to submit your request.");
      }
      setResult({
        referenceCode: payload.referenceCode,
        acknowledgementSent: payload.acknowledgementSent === true,
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to submit your request.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6">
        <CheckCircle2 className="h-8 w-8 text-emerald-400" />
        <h2 className="mt-4 text-xl font-black text-white light:text-slate-950">
          Request received
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-300 light:text-slate-700">
          Keep this reference code for future communication:
        </p>
        <p className="mt-3 rounded-xl bg-slate-950/50 px-4 py-3 font-mono text-base font-black text-emerald-300 light:bg-white light:text-emerald-700">
          {result.referenceCode}
        </p>
        <p className="mt-3 text-xs leading-5 text-slate-400 light:text-slate-600">
          {result.acknowledgementSent
            ? "An acknowledgement was sent to your email address. "
            : "The request is safely recorded. Email acknowledgement is temporarily unavailable. "}
          YuhBusiness may contact you to verify identity before taking action.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold">
          Full name
          <input
            required
            maxLength={120}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            className={inputClass}
            autoComplete="name"
          />
        </label>
        <label className="text-sm font-bold">
          Email address
          <input
            required
            type="email"
            maxLength={254}
            value={form.email}
            onChange={(event) =>
              setForm({ ...form, email: event.target.value })
            }
            className={inputClass}
            autoComplete="email"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold">
          Request type
          <select
            value={form.requestType}
            onChange={(event) =>
              setForm({ ...form, requestType: event.target.value })
            }
            className={inputClass}
          >
            <option value="ACCESS">Access my information</option>
            <option value="CORRECTION">Correct my information</option>
            <option value="DELETION">Delete my information</option>
            <option value="EXPORT">Export my information</option>
            <option value="OBJECTION">Object to processing</option>
            <option value="RESTRICTION">Restrict processing</option>
            <option value="CONSENT_WITHDRAWAL">Withdraw consent</option>
            <option value="OTHER">Another privacy request</option>
          </select>
        </label>
        <label className="text-sm font-bold">
          Your relationship
          <select
            value={form.relationship}
            onChange={(event) =>
              setForm({ ...form, relationship: event.target.value })
            }
            className={inputClass}
          >
            <option value="ACCOUNT_HOLDER">Account holder or staff</option>
            <option value="BUSINESS_OWNER">Business owner</option>
            <option value="STOREFRONT_CUSTOMER">Storefront customer</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
      </div>

      <label className="block text-sm font-bold">
        Business name or storefront URL (optional)
        <input
          maxLength={200}
          value={form.businessReference}
          onChange={(event) =>
            setForm({ ...form, businessReference: event.target.value })
          }
          className={inputClass}
          placeholder="Business name or business.yuhbusiness.com"
        />
      </label>

      <label className="block text-sm font-bold">
        Describe your request
        <textarea
          required
          minLength={20}
          maxLength={5000}
          rows={7}
          value={form.details}
          onChange={(event) =>
            setForm({ ...form, details: event.target.value })
          }
          className={inputClass + " resize-y"}
          placeholder="Tell us which account, order, appointment, or information your request concerns. Do not include passwords or payment credentials."
        />
      </label>

      <div className="hidden" aria-hidden="true">
        <label>
          Website
          <input
            tabIndex={-1}
            autoComplete="off"
            value={form.website}
            onChange={(event) =>
              setForm({ ...form, website: event.target.value })
            }
          />
        </label>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-xs leading-5 text-slate-400 light:border-slate-200 light:bg-slate-50 light:text-slate-600">
        <p className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
          We verify identity before disclosing, correcting, exporting, or
          deleting personal information. Some records may need to be retained
          for transactions, security, disputes, or legal obligations.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm font-semibold text-rose-400">
          {error}
        </p>
      )}

      <Button type="submit" loading={submitting} className="w-full sm:w-auto">
        Submit privacy request
      </Button>
    </form>
  );
}
