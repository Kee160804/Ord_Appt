"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Building2,
  Clock,
  Globe,
  ChevronRight,
  ImageIcon,
  Upload,
  Users,
  CreditCard,
  ShoppingBag,
  X,
} from "lucide-react";
import { Card, CardHeader, CardBody } from "../components/Card";
import { Button } from "../components/Button";
import { Input, Textarea } from "../components/input";
import { formatCurrency, cn } from "../lib/utils";
import { PLAN_DEFINITIONS, PLAN_ORDER, tenantHasFeature } from "../lib/plans";
import { PlanFeatureRequired } from "./PlanFeatureRequired";
import { TeamAccessView } from "./TeamAccessView";
import {
  updateBusinessDetails,
  updateBusinessHours,
  deleteStorefrontCoverImage,
  updateStorefrontSettings,
  uploadStorefrontCoverImage,
  validateStorefrontCoverImage,
  getOrderingSettings,
  updateOrderingSettings,
} from "../services/settingsService";
import {
  listBillingLedger,
  runMockSubscriptionCheckout,
  type BillingInvoice,
  type BillingTransaction,
} from "../services/billingService";
import type { Tenant, User } from "../types/index";

type Tab =
  | "business"
  | "hours"
  | "team"
  | "payments"
  | "ordering"
  | "storefront"
  | "notifications";

const TABS: { id: Tab; label: string; icon: typeof Building2 }[] = [
  { id: "business", label: "Business Info", icon: Building2 },
  { id: "hours", label: "Business Hours", icon: Clock },
  { id: "team", label: "Team & Access", icon: Users },
  { id: "payments", label: "Billing & Payments", icon: CreditCard },
  { id: "ordering", label: "Order Operations", icon: ShoppingBag },
  { id: "storefront", label: "Storefront", icon: Globe },
];

interface Props {
  tenant: Tenant;
  user: User;
  onTenantUpdated: (tenant: Tenant) => void;
}
export function SettingsView({ tenant, user, onTenantUpdated }: Props) {
  const [active, setActive] = useState<Tab>("business");
  const [hours, setHours] = useState(tenant.businessHours);
  return (
    <div className="min-h-full space-y-4 bg-[#08111f] light:bg-[#f8fafc] p-4 text-white light:text-[#14213a] md:p-5">
      <div className="sr-only">
        <h2 className="text-sm font-bold text-white light:text-[#17223a]">
          Settings
        </h2>
        <p className="text-sm text-slate-400 light:text-gray-600">
          Manage your business configuration
        </p>
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-4">
        {/* Nav */}
        <Card className="lg:col-span-1">
          <CardBody className="p-2 space-y-0.5">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActive(tab.id)}
                  className={cn(
                    "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-[10px] font-medium transition-colors",
                    active === tab.id
                      ? "bg-violet-600 text-white shadow-sm"
                      : "text-slate-400 light:text-gray-600 hover:bg-slate-700 light:hover:bg-gray-100",
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1">{tab.label}</span>
                  {active !== tab.id && (
                    <ChevronRight className="w-3 h-3 text-slate-500 light:text-gray-400" />
                  )}
                </button>
              );
            })}
          </CardBody>
        </Card>

        {/* Content */}
        <div className="lg:col-span-3 space-y-0">
          {active === "business" && (
            <BusinessTab tenant={tenant} onTenantUpdated={onTenantUpdated} />
          )}
          {active === "hours" && (
            <HoursTab
              tenant={tenant}
              hours={hours}
              setHours={setHours}
              onTenantUpdated={onTenantUpdated}
            />
          )}
          {active === "team" &&
            (user.role === "owner" ? (
              <TeamAccessView tenant={tenant} />
            ) : (
              <Card>
                <CardBody>
                  <p className="text-sm text-slate-400 light:text-slate-600">
                    Only the business owner can manage team access.
                  </p>
                </CardBody>
              </Card>
            ))}
          {active === "payments" && (
            <PaymentsTab tenant={tenant} onTenantUpdated={onTenantUpdated} />
          )}
          {active === "ordering" &&
            (tenant.businessType === "ordering" ? (
              <OrderingTab tenant={tenant} onTenantUpdated={onTenantUpdated} />
            ) : (
              <Card>
                <CardBody>
                  <p className="text-sm text-slate-400">
                    Order operations apply to ordering businesses.
                  </p>
                </CardBody>
              </Card>
            ))}
          {active === "storefront" &&
            (tenantHasFeature(tenant, "storefront_branding") ? (
              <StorefrontTab
                tenant={tenant}
                onTenantUpdated={onTenantUpdated}
              />
            ) : (
              <PlanFeatureRequired
                feature="storefront_branding"
                title="Storefront branding controls are a Pro feature"
                description="Your storefront remains published on Beginner with its current design. Upgrade to change its URL, cover image, and brand colours."
              />
            ))}
        </div>
      </div>
    </div>
  );
}
// Settings panels

function BusinessTab({
  tenant,
  onTenantUpdated,
}: {
  tenant: Tenant;
  onTenantUpdated: (tenant: Tenant) => void;
}) {
  const [form, setForm] = useState({
    name: tenant.name,
    description: tenant.description,
    phone: tenant.phone,
    email: tenant.email,
    address: tenant.address,
    city: tenant.city,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const save = async () => {
    setIsSaving(true);
    setError("");
    setSuccess("");

    try {
      const saved = await updateBusinessDetails(tenant.id, form);
      onTenantUpdated({ ...tenant, ...saved });
      setSuccess("Business information saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save business information.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <h3 className="text-xs font-bold text-white light:text-[#17223a]">
          Business Information
        </h3>
      </CardHeader>
      <CardBody className="space-y-5">
        <div className="flex items-center gap-4">
          <div
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg text-sm font-black text-white"
            style={{ backgroundColor: tenant.logoBg }}
          >
            {tenant.logo}
          </div>
          <p className="text-[10px] text-slate-400 light:text-[#71809a]">
            Your business initial is used until image uploads are enabled.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Business Name"
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            className="col-span-2"
          />
          <Textarea
            label="Description"
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            rows={3}
            className="col-span-2"
          />
          <Input
            label="Phone"
            value={form.phone}
            onChange={(event) =>
              setForm((current) => ({ ...current, phone: event.target.value }))
            }
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(event) =>
              setForm((current) => ({ ...current, email: event.target.value }))
            }
          />
          <Input
            label="Address"
            value={form.address}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                address: event.target.value,
              }))
            }
          />
          <Input
            label="City"
            value={form.city}
            onChange={(event) =>
              setForm((current) => ({ ...current, city: event.target.value }))
            }
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {success && <p className="text-sm text-emerald-400">{success}</p>}
        <Button
          type="button"
          loading={isSaving}
          onClick={save}
          className="bg-violet-600 hover:bg-violet-500 light:bg-violet-600 light:hover:bg-violet-700 text-white"
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </CardBody>
    </Card>
  );
}

function HoursTab({
  tenant,
  hours,
  setHours,
  onTenantUpdated,
}: {
  tenant: Tenant;
  hours: Tenant["businessHours"];
  setHours: React.Dispatch<React.SetStateAction<Tenant["businessHours"]>>;
  onTenantUpdated: (tenant: Tenant) => void;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const save = async () => {
    setIsSaving(true);
    setError("");
    setSuccess("");
    try {
      await updateBusinessHours(tenant.id, hours);
      onTenantUpdated({ ...tenant, businessHours: hours });
      setSuccess("Business hours saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save business hours.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <h3 className="text-xs font-bold text-white light:text-[#17223a]">
          Business Hours
        </h3>
      </CardHeader>
      <CardBody className="space-y-3">
        {hours.map((day, i) => (
          <div key={day.day} className="flex items-center gap-4">
            <span className="w-24 flex-shrink-0 text-xs font-medium text-white light:text-[#566681]">
              {day.day}
            </span>
            <input
              type="checkbox"
              checked={!day.closed}
              className="w-4 h-4 accent-violet-600"
              onChange={() =>
                setHours((prev) =>
                  prev.map((d, idx) =>
                    idx === i ? { ...d, closed: !d.closed } : d,
                  ),
                )
              }
            />
            {day.closed ? (
              <span className="text-sm text-slate-400 light:text-gray-600">
                Closed
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={day.open}
                  aria-label="Opening time"
                  onChange={(event) =>
                    setHours((current) =>
                      current.map((candidate, index) =>
                        index === i
                          ? { ...candidate, open: event.target.value }
                          : candidate,
                      ),
                    )
                  }
                  className="px-2 py-1.5 bg-slate-700 light:bg-white border border-slate-600 light:border-gray-300 rounded-xl text-sm text-white light:text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                />
                <span className="text-slate-400 light:text-gray-600">
                  Ã¢â‚¬â€œ
                </span>
                <input
                  type="time"
                  value={day.close}
                  aria-label="Closing time"
                  onChange={(event) =>
                    setHours((current) =>
                      current.map((candidate, index) =>
                        index === i
                          ? { ...candidate, close: event.target.value }
                          : candidate,
                      ),
                    )
                  }
                  className="px-2 py-1.5 bg-slate-700 light:bg-white border border-slate-600 light:border-gray-300 rounded-xl text-sm text-white light:text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                />
              </div>
            )}
          </div>
        ))}
        {error && <p className="text-sm text-red-400">{error}</p>}
        {success && <p className="text-sm text-emerald-400">{success}</p>}
        <div className="pt-2">
          <Button
            type="button"
            loading={isSaving}
            onClick={save}
            className="bg-violet-600 hover:bg-violet-500 light:bg-violet-600 light:hover:bg-violet-700 text-white"
          >
            {isSaving ? "Saving..." : "Save Hours"}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function StorefrontTab({
  tenant,
  onTenantUpdated,
}: {
  tenant: Tenant;
  onTenantUpdated: (tenant: Tenant) => void;
}) {
  const [slug, setSlug] = useState(tenant.slug);
  const [coverImage, setCoverImage] = useState(tenant.coverImage);
  const [primaryColor, setPrimaryColor] = useState(tenant.primaryColor);
  const [accentColor, setAccentColor] = useState(tenant.accentColor);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const previewUrlRef = useRef("");
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [],
  );

  const clearSelectedFile = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = "";
    setCoverFile(null);
    setCoverPreview("");
    if (coverInputRef.current) coverInputRef.current.value = "";
  };

  const selectCoverFile = (file: File | null) => {
    if (!file) return;
    setError("");
    setSuccess("");
    try {
      validateStorefrontCoverImage(file);
      clearSelectedFile();
      const previewUrl = URL.createObjectURL(file);
      previewUrlRef.current = previewUrl;
      setCoverFile(file);
      setCoverPreview(previewUrl);
    } catch (selectionError) {
      if (coverInputRef.current) coverInputRef.current.value = "";
      setError(
        selectionError instanceof Error
          ? selectionError.message
          : "Unable to use this photo.",
      );
    }
  };

  const removeCoverImage = () => {
    clearSelectedFile();
    setCoverImage("");
    setSuccess("");
  };

  const save = async () => {
    setIsSaving(true);
    setError("");
    setSuccess("");
    let uploadedCoverImage = "";

    try {
      if (coverFile) {
        uploadedCoverImage = await uploadStorefrontCoverImage(
          tenant.id,
          coverFile,
        );
      }
      const saved = await updateStorefrontSettings(tenant.id, {
        slug,
        coverImage: uploadedCoverImage || coverImage,
        primaryColor,
        accentColor,
      });
      setSlug(saved.slug);
      setCoverImage(saved.coverImage);
      clearSelectedFile();
      onTenantUpdated({ ...tenant, ...saved });
      if (uploadedCoverImage && tenant.coverImage !== uploadedCoverImage) {
        await deleteStorefrontCoverImage(tenant.id, tenant.coverImage);
      }
      setSuccess("Storefront settings saved.");
    } catch (saveError) {
      if (uploadedCoverImage) {
        await deleteStorefrontCoverImage(tenant.id, uploadedCoverImage);
      }
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save storefront settings.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <h3 className="text-xs font-bold text-white light:text-[#17223a]">
          Storefront Settings
        </h3>
      </CardHeader>
      <CardBody className="space-y-4">
        <div>
          <label
            htmlFor="storefront-slug"
            className="block text-sm font-medium text-slate-300 light:text-gray-700 mb-1.5"
          >
            Storefront URL
          </label>
          <div className="flex min-w-0 items-center">
            <span className="text-sm text-slate-400 light:text-gray-600 bg-slate-700 light:bg-gray-100 border border-slate-600 light:border-gray-300 rounded-l-xl px-3 py-2.5 border-r-0 whitespace-nowrap">
              {(process.env.NEXT_PUBLIC_APP_URL || "Current site").replace(
                /\/+$/,
                "",
              )}
              /store-front/
            </span>
            <input
              id="storefront-slug"
              title="Storefront Slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              className="min-w-0 flex-1 px-3 py-2.5 bg-slate-700 light:bg-white border border-slate-600 light:border-gray-300 rounded-r-xl text-sm text-white light:text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/30 sm:px-4"
            />
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-medium text-slate-300 light:text-gray-700">
              Cover Image
            </label>
            {(coverPreview || coverImage) && (
              <button
                type="button"
                onClick={removeCoverImage}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 transition hover:text-red-400"
              >
                <X className="h-3.5 w-3.5" /> Remove
              </button>
            )}
          </div>

          <div
            className="relative flex min-h-36 items-center justify-center overflow-hidden rounded-2xl border border-slate-600 bg-slate-800 bg-cover bg-center light:border-slate-300 light:bg-slate-100"
            style={
              coverPreview || coverImage
                ? {
                    backgroundImage: `linear-gradient(rgba(8,17,31,.12),rgba(8,17,31,.4)),url(${JSON.stringify(coverPreview || coverImage)})`,
                  }
                : undefined
            }
          >
            {!coverPreview && !coverImage && (
              <div className="text-center text-slate-500">
                <ImageIcon className="mx-auto h-7 w-7" />
                <p className="mt-2 text-xs font-medium">
                  No cover image selected
                </p>
              </div>
            )}
            {coverFile && (
              <span className="absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] truncate rounded-full bg-slate-950/75 px-3 py-1 text-[10px] font-bold text-white backdrop-blur">
                Ready to upload Ã‚· {coverFile.name}
              </span>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,auto)_minmax(0,1fr)] sm:items-end">
            <div>
              <span className="mb-1.5 block text-xs font-semibold text-slate-300 light:text-slate-700">
                Upload a photo
              </span>
              <label
                htmlFor="storefront-cover-upload"
                className="inline-flex h-[42px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-violet-500/70 bg-violet-500/10 px-4 text-xs font-bold text-violet-300 transition hover:bg-violet-500/20 light:text-violet-700 sm:w-auto"
              >
                <Upload className="h-4 w-4" /> Choose photo
              </label>
              <input
                ref={coverInputRef}
                id="storefront-cover-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) =>
                  selectCoverFile(event.target.files?.[0] ?? null)
                }
                className="sr-only"
              />
            </div>
            <Input
              label="Or paste an image URL"
              type="url"
              value={coverImage}
              onChange={(event) => {
                clearSelectedFile();
                setCoverImage(event.target.value);
                setSuccess("");
              }}
              placeholder="https://example.com/cover.jpg"
            />
          </div>
          <p className="text-[11px] text-slate-500 light:text-slate-600">
            JPG, PNG, or WebP Ã‚· Maximum 5 MB. Recommended wide format: 1600
            Ãƒâ€” 700.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="primary-color"
              className="block text-sm font-medium text-slate-300 light:text-gray-700 mb-1.5"
            >
              Primary Colour
            </label>
            <div className="flex items-center gap-2">
              <input
                id="primary-color"
                title="Primary Colour"
                type="color"
                value={primaryColor}
                onChange={(event) => setPrimaryColor(event.target.value)}
                className="w-10 h-10 rounded-xl border border-slate-600 light:border-gray-300 cursor-pointer p-1 bg-transparent"
              />
              <input
                title="Primary Colour"
                value={primaryColor}
                onChange={(event) => setPrimaryColor(event.target.value)}
                className="flex-1 px-3 py-2 bg-slate-700 light:bg-white border border-slate-600 light:border-gray-300 rounded-xl text-sm text-white light:text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="accent-color"
              className="block text-sm font-medium text-slate-300 light:text-gray-700 mb-1.5"
            >
              Accent Colour
            </label>
            <div className="flex items-center gap-2">
              <input
                id="accent-color"
                title="Accent Colour"
                type="color"
                value={accentColor}
                onChange={(event) => setAccentColor(event.target.value)}
                className="w-10 h-10 rounded-xl border border-slate-600 light:border-gray-300 cursor-pointer p-1 bg-transparent"
              />
              <input
                title="Accent Colour"
                value={accentColor}
                onChange={(event) => setAccentColor(event.target.value)}
                className="flex-1 px-3 py-2 bg-slate-700 light:bg-white border border-slate-600 light:border-gray-300 rounded-xl text-sm text-white light:text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              />
            </div>
          </div>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {success && <p className="text-sm text-emerald-400">{success}</p>}
        <Button
          type="button"
          loading={isSaving}
          onClick={save}
          className="bg-violet-600 hover:bg-violet-500 light:bg-violet-600 light:hover:bg-violet-700 text-white"
        >
          {isSaving ? "Saving..." : "Save Storefront"}
        </Button>
      </CardBody>
    </Card>
  );
}

function PaymentsTab({
  tenant,
  onTenantUpdated,
}: {
  tenant: Tenant;
  onTenantUpdated: (tenant: Tenant) => void;
}) {
  const [transactions, setTransactions] = useState<BillingTransaction[]>([]);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [selectedPlan, setSelectedPlan] = useState(tenant.plan);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const ledger = await listBillingLedger(tenant.id);
      setTransactions(ledger.transactions);
      setInvoices(ledger.invoices);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load billing history.",
      );
    } finally {
      setLoading(false);
    }
  }, [tenant.id]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const checkout = async () => {
    setProcessing(true);
    setError("");
    setMessage("");
    try {
      const result = await runMockSubscriptionCheckout(tenant.id, selectedPlan);
      onTenantUpdated({
        ...tenant,
        plan: selectedPlan,
        subscriptionStatus: "active",
      });
      setMessage(
        `Mock payment ${result.paymentReference ?? ""} approved. No real money was processed.`,
      );
      await refresh();
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Unable to complete checkout.",
      );
    } finally {
      setProcessing(false);
    }
  };
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h3 className="text-xs font-bold text-white light:text-slate-900">
            Subscription checkout
          </h3>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200 light:text-amber-800">
            <strong>Mock payment mode.</strong> This exercises invoices, payment
            records, and plan activation without collecting card details or
            moving money. Replace the provider adapter when the bank supplies
            its sandbox package.
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {PLAN_ORDER.map((planId) => {
              const plan = PLAN_DEFINITIONS[planId];
              return (
                <button
                  type="button"
                  key={planId}
                  onClick={() => setSelectedPlan(planId)}
                  className={cn(
                    "rounded-xl border p-4 text-left",
                    selectedPlan === planId
                      ? "border-violet-500 bg-violet-500/10"
                      : "border-slate-700 light:border-slate-200",
                  )}
                >
                  <p className="font-bold">{plan.name}</p>
                  <p className="mt-1 text-lg font-black">
                    {formatCurrency(plan.price)}
                    <span className="text-xs font-normal text-slate-400">
                      {" "}
                      / month
                    </span>
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    {plan.description}
                  </p>
                </button>
              );
            })}
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          {message && <p className="text-sm text-emerald-400">{message}</p>}
          <Button type="button" loading={processing} onClick={checkout}>
            Run Mock Checkout
          </Button>
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <h3 className="text-xs font-bold">Billing history</h3>
        </CardHeader>
        <CardBody>
          {loading ? (
            <p className="text-sm text-slate-400">
              Loading billing historyÃ¢â‚¬Â¦
            </p>
          ) : invoices.length === 0 ? (
            <p className="text-sm text-slate-400">
              No subscription invoices yet.
            </p>
          ) : (
            <div className="space-y-2">
              {invoices.slice(0, 8).map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-700 p-3 text-xs light:border-slate-200"
                >
                  <div>
                    <p className="font-bold">{invoice.number}</p>
                    <p className="text-slate-400">
                      {PLAN_DEFINITIONS[invoice.plan]?.name ?? invoice.plan} Ã‚·{" "}
                      {new Date(invoice.periodStart).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">
                      {formatCurrency(invoice.amount)}
                    </p>
                    <p className="text-emerald-400">{invoice.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
      {transactions.length > 0 && (
        <p className="text-xs text-slate-500">
          {transactions.length} payment ledger record
          {transactions.length === 1 ? "" : "s"} available.
        </p>
      )}
    </div>
  );
}

function OrderingTab({
  tenant,
  onTenantUpdated,
}: {
  tenant: Tenant;
  onTenantUpdated: (tenant: Tenant) => void;
}) {
  const fallback = tenant.orderingSettings ?? {
    enabled: true,
    paused: false,
    orderTypes: ["dine_in", "pickup", "delivery"] as const,
    taxRate: 10,
    discountEnabled: true,
    discountThreshold: 100,
    discountRate: 5,
    minimumOrder: 0,
    deliveryFee: 0,
    deliveryAreas: [],
    preparationMinutes: 30,
  };
  const [settings, setSettings] = useState({
    ...fallback,
    orderTypes: [...fallback.orderTypes],
    deliveryAreas: [...fallback.deliveryAreas],
  } as NonNullable<Tenant["orderingSettings"]>);
  const [areas, setAreas] = useState(fallback.deliveryAreas.join(", "));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  useEffect(() => {
    let active = true;
    getOrderingSettings(tenant.id)
      .then((value) => {
        if (active) {
          setSettings(value);
          setAreas(value.deliveryAreas.join(", "));
        }
      })
      .catch(
        (loadError) =>
          active &&
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load order settings.",
          ),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [tenant.id]);
  const setNumber = (
    key:
      | "taxRate"
      | "discountThreshold"
      | "discountRate"
      | "minimumOrder"
      | "deliveryFee"
      | "preparationMinutes",
    value: string,
  ) => setSettings((current) => ({ ...current, [key]: Number(value) }));
  const toggleType = (value: "dine_in" | "pickup" | "delivery") =>
    setSettings((current) => ({
      ...current,
      orderTypes: current.orderTypes.includes(value)
        ? current.orderTypes.filter((item) => item !== value)
        : [...current.orderTypes, value],
    }));
  const save = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const value = await updateOrderingSettings(tenant.id, {
        ...settings,
        deliveryAreas: areas
          .split(",")
          .map((area) => area.trim())
          .filter(Boolean),
      });
      setSettings(value);
      onTenantUpdated({ ...tenant, orderingSettings: value });
      setSuccess("Order operations saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save order settings.",
      );
    } finally {
      setSaving(false);
    }
  };
  if (loading)
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-slate-400">
            Loading order operationsÃ¢â‚¬Â¦
          </p>
        </CardBody>
      </Card>
    );
  return (
    <Card>
      <CardHeader>
        <h3 className="text-xs font-bold">Order Operations</h3>
      </CardHeader>
      <CardBody className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <ToggleSetting
            label="Accept online orders"
            checked={settings.enabled}
            onChange={(checked) =>
              setSettings((current) => ({ ...current, enabled: checked }))
            }
          />
          <ToggleSetting
            label="Temporarily pause orders"
            checked={settings.paused}
            onChange={(checked) =>
              setSettings((current) => ({ ...current, paused: checked }))
            }
          />
          <ToggleSetting
            label="Automatic threshold discount"
            checked={settings.discountEnabled}
            onChange={(checked) =>
              setSettings((current) => ({
                ...current,
                discountEnabled: checked,
              }))
            }
          />
        </div>
        <div>
          <p className="mb-2 text-xs font-bold">Available order types</p>
          <div className="flex flex-wrap gap-3">
            {(["dine_in", "pickup", "delivery"] as const).map((value) => (
              <label key={value} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={settings.orderTypes.includes(value)}
                  onChange={() => toggleType(value)}
                />{" "}
                {value.replace("_", " ")}
              </label>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            label="Tax rate (%)"
            type="number"
            min="0"
            max="100"
            value={settings.taxRate}
            onChange={(event) => setNumber("taxRate", event.target.value)}
          />
          <Input
            label="Minimum order (BZD)"
            type="number"
            min="0"
            value={settings.minimumOrder}
            onChange={(event) => setNumber("minimumOrder", event.target.value)}
          />
          <Input
            label="Delivery fee (BZD)"
            type="number"
            min="0"
            value={settings.deliveryFee}
            onChange={(event) => setNumber("deliveryFee", event.target.value)}
          />
          <Input
            label="Discount threshold (BZD)"
            type="number"
            min="0"
            value={settings.discountThreshold}
            onChange={(event) =>
              setNumber("discountThreshold", event.target.value)
            }
          />
          <Input
            label="Discount rate (%)"
            type="number"
            min="0"
            max="100"
            value={settings.discountRate}
            onChange={(event) => setNumber("discountRate", event.target.value)}
          />
          <Input
            label="Preparation minutes"
            type="number"
            min="5"
            value={settings.preparationMinutes}
            onChange={(event) =>
              setNumber("preparationMinutes", event.target.value)
            }
          />
          <Input
            label="Ordering opens"
            type="time"
            value={settings.openTime ?? ""}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                openTime: event.target.value,
              }))
            }
          />
          <Input
            label="Ordering closes"
            type="time"
            value={settings.closeTime ?? ""}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                closeTime: event.target.value,
              }))
            }
          />
        </div>
        <Input
          label="Delivery areas (comma separated)"
          value={areas}
          onChange={(event) => setAreas(event.target.value)}
          placeholder="Belize City, Ladyville, Hattieville"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        {success && <p className="text-sm text-emerald-400">{success}</p>}
        <Button type="button" loading={saving} onClick={save}>
          Save Order Operations
        </Button>
      </CardBody>
    </Card>
  );
}

function ToggleSetting({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-slate-700 p-3 text-xs light:border-slate-200">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}
