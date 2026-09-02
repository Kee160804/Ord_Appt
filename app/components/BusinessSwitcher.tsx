"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  Building2,
  Check,
  ChevronRight,
  Loader2,
  Plus,
  Store,
} from "lucide-react";
import { useAuth } from "@/app/contexts/auth";
import { PLAN_DEFINITIONS } from "@/app/lib/plans";
import type { BusinessType, Tenant } from "@/app/types";
import { Modal } from "@/app/components/Modal";
import { cn } from "@/app/lib/utils";

interface BusinessSwitcherProps {
  tenant: Tenant;
  collapsed?: boolean;
  onBusinessSelected?: () => void;
}

const inputClass = "mt-1.5 h-11 w-full rounded-xl border border-slate-600 bg-slate-900/70 px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 light:border-slate-300 light:bg-white light:text-slate-900";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function BusinessSwitcher({ tenant, collapsed = false, onBusinessSelected }: BusinessSwitcherProps) {
  const { businesses, switchBusiness, addBusiness, isSwitchingBusiness } = useAuth();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState<BusinessType>("appointment");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [slug, setSlug] = useState("");
  const suggestedSlug = useMemo(() => slugify(slug || businessName), [businessName, slug]);

  const close = () => {
    if (isSwitchingBusiness) return;
    setOpen(false);
    setAdding(false);
    setError("");
  };

  const selectBusiness = async (tenantId: string) => {
    setError("");
    const result = await switchBusiness(tenantId);
    if (!result.success) {
      setError(result.error ?? "Unable to switch businesses.");
      return;
    }
    close();
    onBusinessSelected?.();
  };

  const submitBusiness = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const result = await addBusiness({
      businessName,
      businessType,
      city,
      phone,
      slug: suggestedSlug,
    });
    if (!result.success) {
      setError(result.error ?? "Unable to add this business.");
      return;
    }
    setBusinessName("");
    setCity("");
    setPhone("");
    setSlug("");
    close();
    onBusinessSelected?.();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={collapsed ? `Switch business: ${tenant.name}` : "Switch business"}
        aria-label={`Switch business. Current business: ${tenant.name}`}
        className={cn(
          "group flex w-full items-center gap-3 rounded-xl px-1 py-1 text-left transition hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400",
          collapsed && "justify-center",
        )}
      >
        <span
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white shadow-sm"
          style={{ backgroundColor: tenant.logoBg }}
        >
          {tenant.logo}
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-white">{tenant.name}</span>
              <span className="mt-1 inline-flex rounded-full bg-violet-600 px-2 py-0.5 text-[7px] font-bold uppercase tracking-wide text-white">
                {tenant.businessType === "appointment" ? "Appointments" : "Ordering"}
              </span>
            </span>
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-slate-500 transition group-hover:text-violet-300" />
          </>
        )}
      </button>

      <Modal
        open={open}
        onClose={close}
        title={adding ? "Add another business" : "Switch business"}
        maxWidth="max-w-md"
      >
        {adding ? (
          <form onSubmit={submitBusiness} className="space-y-5">
            <div className="rounded-2xl border border-violet-500/25 bg-violet-500/10 p-4 text-xs leading-5 text-violet-100 light:text-violet-900">
              This creates a separate business under the same login. It starts on a 14-day trial and keeps its own data, plan, and subscription.
            </div>

            <label className="block text-xs font-semibold text-slate-200 light:text-slate-700">
              Business name
              <input
                autoFocus
                required
                minLength={2}
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                placeholder="My second business"
                className={inputClass}
              />
            </label>

            <fieldset>
              <legend className="text-xs font-semibold text-slate-200 light:text-slate-700">Business type</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {([
                  { id: "appointment" as const, label: "Appointments", icon: Building2 },
                  { id: "ordering" as const, label: "Ordering", icon: Store },
                ]).map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setBusinessType(option.id)}
                      className={cn(
                        "flex min-h-20 flex-col items-start justify-center rounded-xl border px-4 text-left transition",
                        businessType === option.id
                          ? "border-violet-500 bg-violet-500/15 text-white light:text-violet-900"
                          : "border-slate-600 text-slate-300 hover:border-slate-500 light:border-slate-300 light:text-slate-700",
                      )}
                    >
                      <Icon className="mb-2 h-4 w-4 text-violet-400" />
                      <span className="text-xs font-bold">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-slate-200 light:text-slate-700">
                City
                <input value={city} onChange={(event) => setCity(event.target.value)} className={inputClass} />
              </label>
              <label className="block text-xs font-semibold text-slate-200 light:text-slate-700">
                Phone
                <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className={inputClass} />
              </label>
            </div>

            <label className="block text-xs font-semibold text-slate-200 light:text-slate-700">
              Storefront address
              <div className="mt-1.5 flex min-w-0 items-center rounded-xl border border-slate-600 bg-slate-900/70 px-3 light:border-slate-300 light:bg-white">
                <span className="flex-shrink-0 text-xs text-slate-500">/store-front/</span>
                <input
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                  placeholder={slugify(businessName) || "business-name"}
                  className="h-11 min-w-0 flex-1 bg-transparent px-1 text-sm text-white outline-none light:text-slate-900"
                />
              </div>
            </label>

            {error && <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-300 light:text-rose-700">{error}</p>}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => { setAdding(false); setError(""); }} disabled={isSwitchingBusiness} className="h-11 rounded-xl border border-slate-600 px-5 text-xs font-bold text-slate-300 hover:bg-slate-700 disabled:opacity-50 light:border-slate-300 light:text-slate-700 light:hover:bg-slate-100">
                Back
              </button>
              <button disabled={isSwitchingBusiness || businessName.trim().length < 2} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 text-xs font-bold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50">
                {isSwitchingBusiness && <Loader2 className="h-4 w-4 animate-spin" />}
                Add business
              </button>
            </div>
          </form>
        ) : (
          <div>
            <p className="mb-3 text-xs leading-5 text-slate-400 light:text-slate-600">
              Your businesses use one account, but their customers, activity, settings, storefronts, and subscriptions stay separate.
            </p>
            <div className="space-y-2">
              {businesses.map((business) => {
                const active = business.id === tenant.id;
                const plan = PLAN_DEFINITIONS[business.plan];
                return (
                  <button
                    key={business.id}
                    type="button"
                    disabled={isSwitchingBusiness}
                    onClick={() => void selectBusiness(business.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition disabled:opacity-60",
                      active
                        ? "border-violet-500/60 bg-violet-500/10"
                        : "border-slate-700 hover:border-slate-500 hover:bg-slate-700/40 light:border-slate-200 light:hover:bg-slate-50",
                    )}
                  >
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-sm font-black text-white" style={{ backgroundColor: business.logoBg }}>{business.logo}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-white light:text-slate-900">{business.name}</span>
                      <span className="mt-0.5 block text-[10px] text-slate-400 light:text-slate-500">
                        {plan.name} · ${plan.price} BZD/month · {business.businessType === "appointment" ? "Appointments" : "Ordering"}
                      </span>
                    </span>
                    {isSwitchingBusiness && !active ? <Loader2 className="h-4 w-4 animate-spin text-violet-400" /> : active ? <Check className="h-4 w-4 text-violet-400" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
                  </button>
                );
              })}
            </div>

            {error && <p role="alert" className="mt-3 rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-300 light:text-rose-700">{error}</p>}

            <button
              type="button"
              onClick={() => { setAdding(true); setError(""); }}
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-violet-500/60 text-xs font-bold text-violet-300 transition hover:bg-violet-500/10 light:text-violet-700"
            >
              <Plus className="h-4 w-4" /> Add another business
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}
