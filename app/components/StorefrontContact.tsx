"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  Clock3,
  Facebook,
  Globe2,
  Headphones,
  Instagram,
  LockKeyhole,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
  Send,
  ShieldCheck,
  Store,
  Twitter,
  UserRound,
} from "lucide-react";
import { planHasFeature } from "@/app/lib/plans";
import { submitStorefrontContactMessage } from "@/app/services/contactService";
import type { BusinessHours, Tenant } from "@/app/types";

interface StorefrontContactProps {
  tenant: Tenant;
  viewOnly?: boolean;
}

interface ContactFormState {
  name: string;
  email: string;
  subject: string;
  message: string;
}

const EMPTY_FORM: ContactFormState = {
  name: "",
  email: "",
  subject: "",
  message: "",
};

function formatTime(value: string) {
  const [hourValue, minuteValue] = value.split(":");
  const hour = Number(hourValue);
  if (!Number.isFinite(hour)) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minuteValue || "00"} ${suffix}`;
}

function compactHours(hours: BusinessHours[]) {
  const openDays = hours.filter((day) => !day.closed && day.open && day.close);
  const groups = new Map<string, BusinessHours[]>();

  openDays.forEach((day) => {
    const key = `${day.open}-${day.close}`;
    groups.set(key, [...(groups.get(key) ?? []), day]);
  });

  return Array.from(groups.values()).map((days) => {
    const first = days[0].day.slice(0, 3);
    const last = days[days.length - 1].day.slice(0, 3);
    const dayLabel = days.length === 1 ? first : `${first} - ${last}`;
    return `${dayLabel}: ${formatTime(days[0].open)} - ${formatTime(days[0].close)}`;
  });
}

function socialHref(
  platform: "facebook" | "instagram" | "twitter",
  value: string,
) {
  if (/^https?:\/\//i.test(value)) return value;
  const handle = value.replace(/^@/, "");
  const host = platform === "twitter" ? "x.com" : `${platform}.com`;
  return `https://${host}/${handle}`;
}

function websiteHref(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function displayWebsite(value: string) {
  return value.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

export function StorefrontContact({
  tenant,
  viewOnly = false,
}: StorefrontContactProps) {
  const [form, setForm] = useState<ContactFormState>(EMPTY_FORM);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [isSending, setIsSending] = useState(false);
  const canSendMessage = planHasFeature(tenant.plan, "storefront_contact_form");
  const hours = useMemo(
    () => compactHours(tenant.businessHours),
    [tenant.businessHours],
  );
  const location = [tenant.address, tenant.city].filter(Boolean).join(", ");
  const website = tenant.socialLinks.website || tenant.domain || "";
  const locationHref = location
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`
    : "";

  const submitMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setStatus("");

    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setError("Please enter your name, email address, and message.");
      return;
    }

    if (viewOnly) {
      setStatus("Demo preview only — no message was sent.");
      return;
    }

    setIsSending(true);
    try {
      await submitStorefrontContactMessage({ tenantId: tenant.id, ...form });
      setForm(EMPTY_FORM);
      setStatus("Your message was received successfully.");
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Unable to send your message.";
      if (message.includes("not installed yet") && tenant.email) {
        const subject =
          form.subject.trim() || `Storefront message from ${form.name.trim()}`;
        const body = [
          `Name: ${form.name.trim()}`,
          `Email: ${form.email.trim()}`,
          "",
          form.message.trim(),
        ].join("\n");
        window.location.href = `mailto:${tenant.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        setStatus(
          "Storefront email is still being deployed, so your email app was opened as a safe fallback.",
        );
      } else {
        setError(message);
      }
    } finally {
      setIsSending(false);
    }
  };

  const infoRows = [
    tenant.email
      ? {
          label: "Email",
          value: tenant.email,
          action: "Send Email",
          href: `mailto:${tenant.email}`,
          icon: Mail,
        }
      : null,
    tenant.phone
      ? {
          label: "Phone",
          value: tenant.phone,
          action: "Call Now",
          href: `tel:${tenant.phone.replace(/[^+\d]/g, "")}`,
          icon: Phone,
        }
      : null,
    website
      ? {
          label: "Website",
          value: displayWebsite(website),
          action: "Visit Site",
          href: websiteHref(website),
          icon: Globe2,
        }
      : null,
    location
      ? {
          label: "Location",
          value: location,
          action: "Get Directions",
          href: locationHref,
          icon: MapPin,
        }
      : null,
  ].filter((row): row is NonNullable<typeof row> => Boolean(row));

  const socials = [
    tenant.socialLinks.facebook
      ? {
          label: "Facebook",
          href: socialHref("facebook", tenant.socialLinks.facebook),
          icon: Facebook,
        }
      : null,
    tenant.socialLinks.instagram
      ? {
          label: "Instagram",
          href: socialHref("instagram", tenant.socialLinks.instagram),
          icon: Instagram,
        }
      : null,
    tenant.socialLinks.twitter
      ? {
          label: "X / Twitter",
          href: socialHref("twitter", tenant.socialLinks.twitter),
          icon: Twitter,
        }
      : null,
  ].filter((social): social is NonNullable<typeof social> => Boolean(social));

  return (
    <section className="space-y-5" aria-labelledby="contact-heading">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 px-6 py-9 text-white shadow-2xl shadow-violet-950/10 dark:border-slate-800 sm:px-9 lg:px-12 lg:py-12">
        <div className="pointer-events-none absolute -right-24 top-0 h-80 w-80 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative grid items-center gap-10 lg:grid-cols-[1.08fr_0.92fr]">
          <div>
            <p className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-violet-300">
              Contact {tenant.name}
            </p>
            <h2
              id="contact-heading"
              className="max-w-xl text-4xl font-black leading-tight tracking-tight sm:text-5xl"
            >
              We&apos;d love to hear from{" "}
              <span
                style={{ color: tenant.accentColor || tenant.primaryColor }}
              >
                you
              </span>{" "}
              <span aria-hidden="true">👋</span>
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
              Have a question, feedback, or need support? Reach out to us —
              we&apos;re here to help.
            </p>

            <div className="mt-9 grid gap-5 sm:grid-cols-3">
              <ContactHighlight
                icon={Clock3}
                title="Quick Response"
                description="We reply within 24 hours"
                color={tenant.primaryColor}
              />
              <ContactHighlight
                icon={Headphones}
                title="Customer Support"
                description={hours[0] || "Contact us during business hours"}
                color={tenant.primaryColor}
              />
              <ContactHighlight
                icon={ShieldCheck}
                title="Trusted Service"
                description="Local support from a team that cares"
                color={tenant.primaryColor}
              />
            </div>
          </div>

          <div
            className="relative mx-auto flex min-h-64 w-full max-w-md items-center justify-center"
            aria-hidden="true"
          >
            <div className="absolute h-56 w-56 rounded-full border border-violet-400/15" />
            <div className="absolute h-40 w-40 rounded-full bg-violet-500/20 blur-2xl" />
            <div className="relative mt-10 h-40 w-56 rounded-b-3xl bg-gradient-to-br from-violet-500 to-violet-700 shadow-[0_30px_80px_rgba(124,58,237,0.4)]">
              <div className="absolute -top-16 left-1/2 h-36 w-40 -translate-x-1/2 rounded-2xl border border-white/30 bg-gradient-to-b from-white to-slate-200 p-5 shadow-2xl">
                <div className="h-2 w-16 rounded-full bg-violet-400" />
                <div className="mt-5 h-2 w-full rounded-full bg-slate-300" />
                <div className="mt-3 h-2 w-4/5 rounded-full bg-slate-300" />
                <div className="mt-3 h-2 w-2/3 rounded-full bg-slate-300" />
              </div>
              <div className="absolute inset-x-0 bottom-0 h-28 rounded-b-3xl bg-gradient-to-br from-violet-600 to-violet-700 [clip-path:polygon(0_0,50%_58%,100%_0,100%_100%,0_100%)]" />
            </div>
            <Send className="absolute right-4 top-5 h-16 w-16 rotate-[-12deg] text-violet-400 drop-shadow-[0_12px_24px_rgba(139,92,246,0.45)]" />
          </div>
        </div>
      </div>

      <div
        className={`grid items-stretch gap-5 ${canSendMessage ? "lg:grid-cols-[1.08fr_0.92fr]" : "lg:grid-cols-1"}`}
      >
        {canSendMessage && (
          <form
            onSubmit={submitMessage}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8"
          >
            <div className="mb-6">
              <h3 className="text-xl font-black text-slate-950 dark:text-white">
                Send us a message
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Fill out the form below and we&apos;ll get back to you as soon
                as possible.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <ContactInput
                icon={UserRound}
                label="Your Name"
                value={form.name}
                onChange={(value) =>
                  setForm((current) => ({ ...current, name: value }))
                }
                autoComplete="name"
              />
              <ContactInput
                icon={Mail}
                label="Email Address"
                type="email"
                value={form.email}
                onChange={(value) =>
                  setForm((current) => ({ ...current, email: value }))
                }
                autoComplete="email"
              />
              <ContactInput
                icon={MessageSquareText}
                label="Subject"
                value={form.subject}
                onChange={(value) =>
                  setForm((current) => ({ ...current, subject: value }))
                }
                className="sm:col-span-2"
              />
              <label className="relative sm:col-span-2">
                <span className="sr-only">Your Message</span>
                <MessageSquareText className="pointer-events-none absolute left-4 top-4 h-4 w-4 text-slate-400" />
                <textarea
                  value={form.message}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      message: event.target.value,
                    }))
                  }
                  placeholder="Your Message"
                  rows={7}
                  className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 dark:border-slate-700 dark:bg-slate-950/50 dark:text-white dark:placeholder:text-slate-400"
                />
              </label>
            </div>

            {error && (
              <p className="mt-4 text-sm font-medium text-red-500">{error}</p>
            )}
            {status && (
              <p className="mt-4 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                {status}
              </p>
            )}

            <button
              type="submit"
              disabled={isSending}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-black text-white shadow-lg transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              style={{
                background: `linear-gradient(90deg, ${tenant.primaryColor}, ${tenant.accentColor})`,
              }}
            >
              <Send className="h-4 w-4" />{" "}
              {isSending ? "Sending..." : "Send Message"}
            </button>

            <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-slate-400">
              <LockKeyhole className="h-3.5 w-3.5" /> Your information stays
              between you and {tenant.name}.
            </p>
          </form>
        )}

        <div
          className={`rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8 ${canSendMessage ? "" : "mx-auto w-full max-w-4xl"}`}
        >
          <div className="mb-6">
            <h3 className="text-xl font-black text-slate-950 dark:text-white">
              Contact Information
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              You can also reach us directly using the details below.
            </p>
          </div>

          <div
            className={`grid gap-3 ${canSendMessage ? "" : "md:grid-cols-2"}`}
          >
            {infoRows.map((row) => {
              const Icon = row.icon;
              const external = row.href.startsWith("http");
              return (
                <a
                  key={row.label}
                  href={row.href}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noopener noreferrer" : undefined}
                  className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:border-violet-300 hover:bg-violet-50/60 dark:border-slate-700 dark:bg-slate-950/40 dark:hover:border-violet-700 dark:hover:bg-violet-950/20"
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
                    style={{ backgroundColor: tenant.primaryColor }}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold text-slate-900 dark:text-white">
                      {row.label}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
                      {row.value}
                    </span>
                  </span>
                  <span className="hidden items-center gap-1 text-xs font-bold text-violet-600 group-hover:text-violet-500 sm:flex">
                    {row.action} <ArrowUpRight className="h-3.5 w-3.5" />
                  </span>
                </a>
              );
            })}
          </div>

          {location && (
            <a
              href={locationHref}
              target="_blank"
              rel="noopener noreferrer"
              className="relative mt-5 block min-h-44 overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 dark:border-slate-700"
              aria-label={`Open directions to ${location}`}
            >
              <span className="absolute inset-0 opacity-35 [background-image:linear-gradient(32deg,transparent_47%,rgba(148,163,184,0.45)_48%,rgba(148,163,184,0.45)_50%,transparent_51%),linear-gradient(145deg,transparent_46%,rgba(148,163,184,0.28)_47%,rgba(148,163,184,0.28)_49%,transparent_50%)] [background-size:72px_72px,96px_96px]" />
              <span className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.18),transparent_55%)]" />
              <span className="absolute left-1/2 top-7 flex -translate-x-1/2 flex-col items-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-600 text-white shadow-[0_10px_30px_rgba(124,58,237,0.55)]">
                  <MapPin className="h-6 w-6" />
                </span>
                <span className="mt-3 rounded-xl border border-white/10 bg-slate-950/90 px-4 py-2 text-center text-xs text-white shadow-xl">
                  <strong className="block">{tenant.name}</strong>
                  <span className="mt-0.5 block text-slate-300">
                    {location}
                  </span>
                </span>
              </span>
            </a>
          )}
        </div>
      </div>

      <div className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-[1fr_auto_1fr] md:items-center sm:p-7">
        <div>
          <h3 className="font-black text-slate-950 dark:text-white">
            Other ways to connect
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Follow us on social media or visit us in person.
          </p>
        </div>

        <div className="flex items-center gap-3 md:border-x md:border-slate-200 md:px-8 dark:md:border-slate-700">
          {socials.map((social) => {
            const Icon = social.icon;
            return (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-violet-600 hover:text-white dark:bg-slate-800 dark:text-slate-300"
              >
                <Icon className="h-4 w-4" />
              </a>
            );
          })}
          {socials.length === 0 && (
            <span className="text-xs text-slate-400">
              Social links coming soon
            </span>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 sm:items-center">
          {location && (
            <a
              href={locationHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 group"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-300">
                <Store className="h-4 w-4" />
              </span>
              <span>
                <strong className="block text-sm text-slate-900 group-hover:text-violet-600 dark:text-white">
                  Visit our store
                </strong>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Come by and say hello!
                </span>
              </span>
            </a>
          )}
          <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
            {(hours.length ? hours : ["Hours available on request"])
              .slice(0, 3)
              .map((line) => (
                <p key={line}>{line}</p>
              ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ContactHighlight({
  icon: Icon,
  title,
  description,
  color,
}: {
  icon: typeof Clock3;
  title: string;
  description: string;
  color: string;
}) {
  return (
    <div className="flex items-start gap-3 sm:border-r sm:border-white/10 sm:pr-4 sm:last:border-r-0">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: color }}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span>
        <strong className="block text-xs font-black text-white">{title}</strong>
        <span className="mt-1 block text-xs leading-5 text-slate-300">
          {description}
        </span>
      </span>
    </div>
  );
}

function ContactInput({
  icon: Icon,
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  className = "",
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  className?: string;
}) {
  return (
    <label className={`relative ${className}`}>
      <span className="sr-only">{label}</span>
      <Icon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={label}
        autoComplete={autoComplete}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 dark:border-slate-700 dark:bg-slate-950/50 dark:text-white dark:placeholder:text-slate-400"
      />
    </label>
  );
}
