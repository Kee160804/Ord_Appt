"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  Eye,
  EyeOff,
  ImagePlus,
  Link2,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  Rocket,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Upload,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { useAuth } from "@/app/contexts/auth";
import { cn } from "@/app/lib/utils";
import { resendSignupConfirmation } from "@/app/services/authService";
import type { BusinessType } from "@/app/types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

const BUSINESS_OPTIONS: Array<{
  type: BusinessType;
  icon: LucideIcon;
  label: string;
  description: string;
  features: string[];
  theme: "violet" | "orange" | "emerald";
}> = [
  {
    type: "appointment",
    icon: CalendarDays,
    label: "Appointments",
    description: "Salons, barbershops, clinics, studios and more.",
    features: ["Book services", "Manage calendar", "Client booking"],
    theme: "violet",
  },
  {
    type: "ordering",
    icon: ShoppingBag,
    label: "Ordering",
    description: "Restaurants, bakeries, food trucks, cafes and more.",
    features: ["Online orders", "Menu management", "Pickup or delivery"],
    theme: "orange",
  },
  {
    type: "retail",
    icon: Store,
    label: "Retail Stores",
    description: "Clothing, shoes, gifts, accessories and more.",
    features: ["Product catalog", "Inventory tracking", "Online sales"],
    theme: "emerald",
  },
];

const STEPS = ["Account", "Business", "Complete"];

export default function RegisterPage() {
  const router = useRouter();
  const { signup } = useAuth();
  const [step, setStep] = useState(1);
  const [businessType, setBusinessType] = useState<BusinessType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [isResending, setIsResending] = useState(false);
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [logoPreview, setLogoPreview] = useState("");
  const [logoName, setLogoName] = useState("");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    businessName: "",
    city: "",
    phone: "",
    slug: "",
  });

  const passwordChecks = useMemo(
    () => [
      { label: "At least 8 characters", valid: form.password.length >= 8 },
      {
        label: "A mix of letters and numbers",
        valid: /[a-z]/i.test(form.password) && /\d/.test(form.password),
      },
      {
        label: "Passwords match",
        valid:
          form.confirmPassword.length > 0 &&
          form.password === form.confirmPassword,
      },
    ],
    [form.confirmPassword, form.password],
  );

  const update = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  };

  const goBack = () => {
    setError("");
    if (step === 1) {
      router.push("/home");
      return;
    }
    setStep((current) => current - 1);
  };

  const continueFromAccount = () => {
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const email = form.email.trim();
    if (!firstName && !lastName) {
      setError("Enter your first and last name.");
      return;
    }
    if (!firstName) {
      setError("Enter your first name.");
      return;
    }
    if (!lastName) {
      setError("Enter your last name.");
      return;
    }
    if (!EMAIL_PATTERN.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (form.password.length < 8) {
      setError("Create a password with at least 8 characters.");
      return;
    }
    if (!/[a-z]/i.test(form.password) || !/\d/.test(form.password)) {
      setError("Use a mix of letters and numbers in your password.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Your password confirmation does not match.");
      return;
    }
    setError("");
    setStep(2);
  };

  const continueFromBusiness = () => {
    if (!businessType) {
      setError("Choose the option that best describes your business.");
      return;
    }
    setError("");
    setStep(3);
  };

  const selectLogo = (file: File | null) => {
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setError("Choose a PNG or JPG logo.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError("Business logos must be 2 MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogoPreview(typeof reader.result === "string" ? reader.result : "");
      setLogoName(file.name);
      setError("");
    };
    reader.onerror = () => setError("Unable to preview that logo.");
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    if (!businessType) {
      setStep(2);
      setError("Choose your business type.");
      return;
    }
    if (!form.businessName.trim()) {
      setError("Enter your business name.");
      return;
    }
    if (!acceptedLegal) {
      setError("Accept the Terms of Service and Privacy Policy to continue.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMessage("");
    const result = await signup(
      form.email.trim(),
      form.password,
      `${form.firstName.trim()} ${form.lastName.trim()}`,
      form.businessName.trim(),
      businessType,
      form.city.trim(),
      form.phone.trim(),
      form.slug.trim(),
      new Date().toISOString(),
    );

    if (result.success) {
      if (result.requiresEmailConfirmation) {
        setConfirmationEmail(form.email.trim().toLowerCase());
        setSuccessMessage(
          "Your account is ready. Confirm your email address, then sign in to launch your storefront.",
        );
        setLoading(false);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
      router.push("/dashboard");
      return;
    }

    setError(result.error || "Signup failed. Please try again.");
    setLoading(false);
  };

  const resendConfirmation = async () => {
    if (!confirmationEmail) return;
    setIsResending(true);
    setError("");
    try {
      await resendSignupConfirmation(confirmationEmail);
      setSuccessMessage(
        "A fresh confirmation email was sent. Check your inbox and spam folder.",
      );
    } catch (resendError) {
      setError(
        resendError instanceof Error
          ? resendError.message
          : "Unable to resend the confirmation email.",
      );
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (confirmationEmail) return;
    if (step === 1) continueFromAccount();
    else if (step === 2) continueFromBusiness();
    else void submit();
  };

  return (
    <main className="registration-shell pwa-page-safe relative h-dvh overflow-hidden bg-[#070b14] px-3 py-2 text-white sm:px-6">
      <div className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-violet-700/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 right-[-5rem] h-80 w-80 rounded-full bg-indigo-800/25 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(124,58,237,0.08),transparent_38%)]" />

      <div className="relative mx-auto flex h-full w-full max-w-[500px] flex-col">
        <BrandHeader />

        <div className="mb-2 shrink-0 text-center">
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-[2rem]">
            Mek yuh business
          </h1>
          <p className="mt-1.5 text-sm text-[#8298c2] sm:text-base">
            Set up your digital storefront in minutes
          </p>
        </div>

        <Progress step={step} />

        <form onSubmit={handleSubmit} className="min-h-0 flex-1">
          <section className="flex h-full flex-col overflow-hidden rounded-[20px] border border-[#273858] bg-[linear-gradient(145deg,rgba(17,29,51,0.98),rgba(9,19,36,0.98))] p-3 shadow-[0_30px_90px_rgba(0,0,0,0.35)] sm:p-4">
            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="mb-3 shrink-0 rounded-xl border border-rose-500/40 bg-[#2a101d] px-4 py-2.5 text-sm text-rose-200 shadow-lg"
              >
                {error}
              </div>
            )}

            {confirmationEmail ? (
              <ConfirmationPanel
                email={confirmationEmail}
                message={successMessage}
                resending={isResending}
                onResend={() => void resendConfirmation()}
              />
            ) : step === 1 ? (
              <AccountStep
                form={form}
                update={update}
                passwordChecks={passwordChecks}
                showPassword={showPassword}
                showConfirmation={showConfirmation}
                togglePassword={() => setShowPassword((current) => !current)}
                toggleConfirmation={() =>
                  setShowConfirmation((current) => !current)
                }
              />
            ) : step === 2 ? (
              <BusinessTypeStep
                selected={businessType}
                onSelect={(value) => {
                  setBusinessType(value);
                  setError("");
                }}
              />
            ) : (
              <BusinessDetailsStep
                form={form}
                update={update}
                businessType={businessType}
                logoPreview={logoPreview}
                logoName={logoName}
                onLogoSelected={selectLogo}
                acceptedLegal={acceptedLegal}
                onLegalChange={setAcceptedLegal}
              />
            )}

            {!confirmationEmail && (
              <div className="mt-3 flex shrink-0 gap-3">
                <button
                  type="button"
                  onClick={goBack}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[#7990b8] text-sm font-bold text-slate-200 transition hover:border-violet-400 hover:bg-violet-500/10"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <button
                  type="submit"
                  disabled={loading || (step === 2 && !businessType)}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-bold text-white shadow-lg shadow-violet-950/40 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {loading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Creating...
                    </>
                  ) : step === 3 ? (
                    <>
                      Launch My Business <Rocket className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Continue <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            )}
          </section>
        </form>

        <footer className="shrink-0 pb-1 pt-2 text-center">
          <p className="text-sm text-[#91a4c6]">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-bold text-violet-400 transition hover:text-violet-300"
            >
              Sign in
            </Link>
          </p>
          <p className="mt-2 text-xs text-[#536889]">
            <Link href="/privacy" className="hover:text-violet-300">
              Privacy Policy
            </Link>{" "}
            ·{" "}
            <Link href="/terms" className="hover:text-violet-300">
              Terms of Service
            </Link>
          </p>
        </footer>
      </div>
    </main>
  );
}

function BrandHeader() {
  return (
    <div className="mb-2 flex shrink-0 items-center justify-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-500 bg-violet-950/80 shadow-lg shadow-violet-950/30">
        <Sparkles className="h-6 w-6 text-fuchsia-300" />
      </div>
      <div>
        <p className="text-[22px] font-black leading-none tracking-tight">
          Yuh<span className="text-violet-500">Business</span>
        </p>
        <p className="mt-1.5 text-xs text-slate-300">Launch. Serve. Grow.</p>
      </div>
    </div>
  );
}

function Progress({ step }: { step: number }) {
  return (
    <ol
      className="mb-2 grid shrink-0 grid-cols-3"
      aria-label="Registration progress"
    >
      {STEPS.map((label, index) => {
        const number = index + 1;
        const complete = step > number;
        const current = step === number;
        return (
          <li key={label} className="relative flex flex-col items-center">
            {index > 0 && (
              <span
                className={cn(
                  "absolute right-1/2 top-3.5 h-px w-full",
                  step > index ? "bg-emerald-400" : "bg-[#3a4c6b]",
                )}
              />
            )}
            <span
              className={cn(
                "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border text-sm font-black shadow-lg",
                complete
                  ? "border-emerald-400 bg-emerald-500 text-white shadow-emerald-950/30"
                  : current
                    ? "border-violet-400 bg-violet-600 text-white shadow-violet-950/40"
                    : "border-[#395174] bg-[#14233e] text-[#86a0c9]",
              )}
              aria-current={current ? "step" : undefined}
            >
              {complete ? <Check className="h-5 w-5" /> : number}
            </span>
            <span
              className={cn(
                "relative z-10 mt-2 text-xs",
                current ? "font-bold text-white" : "text-[#91a4c6]",
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

interface RegistrationForm {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  businessName: string;
  city: string;
  phone: string;
  slug: string;
}

interface AccountStepProps {
  form: RegistrationForm;
  update: (key: keyof RegistrationForm, value: string) => void;
  passwordChecks: Array<{ label: string; valid: boolean }>;
  showPassword: boolean;
  showConfirmation: boolean;
  togglePassword: () => void;
  toggleConfirmation: () => void;
}

function AccountStep({
  form,
  update,
  passwordChecks,
  showPassword,
  showConfirmation,
  togglePassword,
  toggleConfirmation,
}: AccountStepProps) {
  return (
    <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain pr-1 animate-fade-in">
      <PanelHeading
        icon={UserRound}
        title="Create your account"
        description="Start with your personal details."
      />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <FormField
          label="First Name"
          icon={UserRound}
          autoComplete="given-name"
          placeholder="Jane"
          value={form.firstName}
          onChange={(value) => update("firstName", value)}
        />
        <FormField
          label="Last Name"
          icon={UserRound}
          autoComplete="family-name"
          placeholder="Smith"
          value={form.lastName}
          onChange={(value) => update("lastName", value)}
        />
      </div>
      <div className="mt-3">
        <FormField
          label="Email Address"
          icon={Mail}
          type="email"
          autoComplete="email"
          placeholder="jane@business.com"
          value={form.email}
          onChange={(value) => update("email", value)}
        />
      </div>
      <div className="mt-3">
        <FormField
          label="Password"
          icon={LockKeyhole}
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Create a strong password"
          value={form.password}
          onChange={(value) => update("password", value)}
          action={
            <VisibilityButton
              visible={showPassword}
              label="password"
              onClick={togglePassword}
            />
          }
        />
      </div>
      <div className="mt-3">
        <FormField
          label="Confirm Password"
          icon={LockKeyhole}
          type={showConfirmation ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Confirm your password"
          value={form.confirmPassword}
          onChange={(value) => update("confirmPassword", value)}
          action={
            <VisibilityButton
              visible={showConfirmation}
              label="password confirmation"
              onClick={toggleConfirmation}
            />
          }
        />
      </div>
      <div className="mt-3 rounded-xl border border-[#60769b] bg-[#101d33]/70 p-2.5">
        <div className="flex items-center gap-2 text-sm font-bold text-fuchsia-300">
          <ShieldCheck className="h-5 w-5" /> Strong password keeps you safe
        </div>
        <ul className="mt-2 space-y-1 pl-7 text-xs text-[#9cb0d1]">
          {passwordChecks.map((check) => (
            <li key={check.label} className="flex items-center gap-2">
              <Check
                className={cn(
                  "h-3.5 w-3.5",
                  check.valid ? "text-emerald-400" : "text-[#6480aa]",
                )}
              />
              {check.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function BusinessTypeStep({
  selected,
  onSelect,
}: {
  selected: BusinessType | null;
  onSelect: (type: BusinessType) => void;
}) {
  return (
    <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain pr-1 animate-fade-in">
      <PanelHeading
        icon={Store}
        title="Select your business type"
        description="Choose the option that best describes your business. You can always change this later."
      />
      <div className="mt-3 space-y-2">
        {BUSINESS_OPTIONS.map((option) => {
          const Icon = option.icon;
          const active = selected === option.type;
          return (
            <button
              key={option.type}
              type="button"
              onClick={() => onSelect(option.type)}
              aria-pressed={active}
              className={cn(
                "group w-full rounded-xl border bg-[#0d192c]/80 p-3 text-left transition",
                option.theme === "violet" &&
                  "border-violet-600/80 hover:bg-violet-500/10",
                option.theme === "orange" &&
                  "border-orange-700/70 hover:bg-orange-500/10",
                option.theme === "emerald" &&
                  "border-emerald-700/70 hover:bg-emerald-500/10",
                active &&
                  (option.theme === "violet"
                    ? "bg-violet-500/15 ring-1 ring-violet-400"
                    : option.theme === "orange"
                      ? "bg-orange-500/15 ring-1 ring-orange-400"
                      : "bg-emerald-500/15 ring-1 ring-emerald-400"),
              )}
            >
              <span className="flex items-center gap-4">
                <span
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border",
                    option.theme === "violet" &&
                      "border-violet-500 bg-violet-700/60 text-violet-200",
                    option.theme === "orange" &&
                      "border-orange-600 bg-orange-800/50 text-orange-300",
                    option.theme === "emerald" &&
                      "border-emerald-600 bg-emerald-800/50 text-emerald-300",
                  )}
                >
                  <Icon className="h-6 w-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-black text-white">
                    {option.label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-[#91a8ce]">
                    {option.description}
                  </span>
                </span>
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1b2846] transition group-hover:translate-x-0.5",
                    active && "bg-violet-600",
                  )}
                >
                  {active ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                </span>
              </span>
              <span className="mt-2 flex flex-wrap gap-1.5 pl-[3.75rem]">
                {option.features.map((feature) => (
                  <span
                    key={feature}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[10px]",
                      option.theme === "violet" &&
                        "border-violet-700/70 bg-violet-950/70 text-violet-200",
                      option.theme === "orange" &&
                        "border-orange-700/70 bg-orange-950/60 text-orange-300",
                      option.theme === "emerald" &&
                        "border-emerald-700/70 bg-emerald-950/60 text-emerald-300",
                    )}
                  >
                    {feature}
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface BusinessDetailsStepProps {
  form: RegistrationForm;
  update: (key: keyof RegistrationForm, value: string) => void;
  businessType: BusinessType | null;
  logoPreview: string;
  logoName: string;
  onLogoSelected: (file: File | null) => void;
  acceptedLegal: boolean;
  onLegalChange: (accepted: boolean) => void;
}

function BusinessDetailsStep({
  form,
  update,
  businessType,
  logoPreview,
  logoName,
  onLogoSelected,
  acceptedLegal,
  onLegalChange,
}: BusinessDetailsStepProps) {
  const businessDescription =
    businessType === "appointment"
      ? "appointment booking"
      : businessType === "retail"
        ? "retail catalog"
        : "online ordering";

  return (
    <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain pr-1 animate-fade-in">
      <PanelHeading
        icon={Store}
        title="Tell us about your business"
        description="Add your business details. This information will be public on your storefront."
      />

      <div className="mt-3 grid grid-cols-[100px_minmax(0,1fr)] gap-3 sm:grid-cols-[120px_minmax(0,1fr)]">
        <div>
          <label className="mb-2 block text-xs font-bold text-slate-200">
            Business Logo
          </label>
          <label className="flex h-16 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-fuchsia-500 bg-violet-950/20 text-center transition hover:bg-violet-500/10">
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoPreview}
                alt="Selected business logo preview"
                className="h-full w-full object-cover"
              />
            ) : (
              <>
                <ImagePlus className="h-6 w-6 text-fuchsia-400" />
                <span className="mt-2 text-xs font-bold text-fuchsia-400">
                  Upload logo
                </span>
                <span className="mt-1 text-[9px] text-[#91a4c6]">
                  PNG, JPG (Max 2MB)
                </span>
              </>
            )}
            <input
              type="file"
              accept="image/png,image/jpeg"
              className="sr-only"
              onChange={(event) =>
                onLogoSelected(event.target.files?.[0] ?? null)
              }
            />
          </label>
          {logoName && (
            <p className="mt-1 truncate text-[9px] text-[#7388aa]">
              Preview: {logoName}
            </p>
          )}
        </div>
        <FormField
          label="Business Name"
          icon={Building2}
          autoComplete="organization"
          placeholder="e.g. Luxe Beauty Studio"
          value={form.businessName}
          onChange={(value) => update("businessName", value)}
        />
      </div>

      <div className="mt-3">
        <label className="mb-2 block text-xs font-bold text-slate-200">
          Storefront URL
        </label>
        <div className="flex h-10 min-w-0 overflow-hidden rounded-xl border border-[#41577b] bg-[#13213a] focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/20">
          <span className="flex shrink-0 items-center gap-2 border-r border-[#41577b] px-3 text-xs text-[#8196b9] sm:px-4">
            <Link2 className="h-4 w-4 text-slate-300" />
            <span className="hidden sm:inline">yuhbusiness.com/</span>
          </span>
          <input
            aria-label="Storefront URL"
            value={form.slug}
            onChange={(event) => update("slug", event.target.value)}
            placeholder="your-business"
            className="min-w-0 flex-1 bg-transparent px-3 text-base text-white outline-none placeholder:text-[#60769a] sm:text-sm"
          />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <FormField
          label="City / Location"
          icon={MapPin}
          autoComplete="address-level2"
          placeholder="e.g. Belize City"
          value={form.city}
          onChange={(value) => update("city", value)}
        />
        <FormField
          label="Phone Number"
          icon={Phone}
          type="tel"
          autoComplete="tel"
          placeholder="(501) 000-0000"
          value={form.phone}
          onChange={(value) => update("phone", value)}
        />
      </div>

      <div className="mt-3 flex gap-2 rounded-xl border border-fuchsia-600 bg-[linear-gradient(110deg,rgba(86,20,158,0.42),rgba(124,58,237,0.2))] p-2.5">
        <Rocket className="mt-0.5 h-6 w-6 shrink-0 text-fuchsia-400" />
        <div>
          <p className="text-sm font-black text-fuchsia-300">
            You&apos;re almost done!
          </p>
          <p className="mt-1 text-xs leading-4 text-violet-200/80">
            Your {businessDescription} storefront will be live after signup.
            You&apos;ll get 14 days to explore all features. No credit card is
            required today.
          </p>
        </div>
      </div>

      <label className="mt-2 flex cursor-pointer items-start gap-3 text-xs leading-5 text-slate-300">
        <input
          required
          type="checkbox"
          checked={acceptedLegal}
          onChange={(event) => onLegalChange(event.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-violet-500"
        />
        <span>
          I agree to the{" "}
          <Link
            href="/terms"
            target="_blank"
            className="font-bold text-fuchsia-400 underline underline-offset-2"
          >
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            target="_blank"
            className="font-bold text-fuchsia-400 underline underline-offset-2"
          >
            Privacy Policy
          </Link>
          .
        </span>
      </label>
      {logoPreview && (
        <p className="mt-2 flex items-center gap-2 text-[10px] leading-4 text-[#7186aa]">
          <Upload className="h-3.5 w-3.5" /> Your selected logo is a preview.
          Save it permanently from Storefront Settings after confirming your
          account.
        </p>
      )}
    </div>
  );
}

function PanelHeading({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-800 to-violet-950 text-fuchsia-300 shadow-inner shadow-violet-400/20">
        <Icon className="h-7 w-7" />
      </div>
      <div className="pt-1">
        <h2 className="text-lg font-black text-white">{title}</h2>
        <p className="mt-1 text-sm leading-5 text-[#91a5c8]">{description}</p>
      </div>
    </div>
  );
}

function FormField({
  label,
  icon: Icon,
  action,
  onChange,
  ...inputProps
}: {
  label: string;
  icon: LucideIcon;
  action?: React.ReactNode;
  value: string;
  placeholder: string;
  type?: string;
  autoComplete?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold text-slate-200">
        {label}
      </span>
      <span className="flex h-10 items-center rounded-xl border border-[#41577b] bg-[#13213a] px-3 transition focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/20">
        <Icon className="mr-3 h-4 w-4 shrink-0 text-slate-300" />
        <input
          {...inputProps}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-[#60769a] sm:text-sm"
        />
        {action}
      </span>
    </label>
  );
}

function VisibilityButton({
  visible,
  label,
  onClick,
}: {
  visible: boolean;
  label: string;
  onClick: () => void;
}) {
  const Icon = visible ? EyeOff : Eye;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${visible ? "Hide" : "Show"} ${label}`}
      className="ml-2 rounded-md p-1 text-slate-300 transition hover:bg-white/5 hover:text-white"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function ConfirmationPanel({
  email,
  message,
  resending,
  onResend,
}: {
  email: string;
  message: string;
  resending: boolean;
  onResend: () => void;
}) {
  return (
    <div className="min-h-0 flex-1 animate-fade-in py-4 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/40">
        <Mail className="h-8 w-8" />
      </div>
      <h2 className="mt-5 text-2xl font-black">Check your email</h2>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#91a5c8]">
        {message}
      </p>
      <p className="mt-3 break-all text-sm font-bold text-violet-300">
        {email}
      </p>
      <button
        type="button"
        disabled={resending}
        onClick={onResend}
        className="mt-6 rounded-xl border border-violet-500 px-5 py-2.5 text-sm font-bold text-violet-200 transition hover:bg-violet-500/10 disabled:opacity-50"
      >
        {resending ? "Resending..." : "Resend confirmation email"}
      </button>
      <div className="mt-5">
        <Link
          href="/login"
          className="text-sm font-bold text-violet-400 hover:text-violet-300"
        >
          Continue to sign in
        </Link>
      </div>
    </div>
  );
}
