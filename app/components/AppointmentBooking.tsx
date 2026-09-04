"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  MessageCircle,
  Star,
  User,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/app/lib/utils";
import { createPublicAppointment } from "@/app/services/bookingService";
import { listPublicAppointmentAvailability } from "@/app/services/appointmentService";
import { isSupabaseConfigured } from "@/app/lib/supabase/config";
import { Button } from "@/app/components/Button";
import { Input } from "@/app/components/input";
import { Modal } from "@/app/components/Modal";
import type { PublicServiceProvider, Service, Tenant } from "@/app/types/index";

// Extend Service type locally to include optional fields used in this component
interface ExtendedService extends Service {
  specialty?: string;
  includes?: string[];
  specialities?: string[];
}

interface AppointmentBookingProps {
  tenant: Tenant;
  services: Service[];
  providers?: PublicServiceProvider[];
  viewOnly?: boolean;
}

// Helpers
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PLACEHOLDER_IMG = "/fallback-product.png";

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildCalendarDays(currentMonth: Date): (Date | null)[] {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (Date | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d));
  return days;
}

function buildTimeSlots(
  open: string,
  close: string,
  duration: number,
): string[] {
  const [openHour, openMinute] = open.split(":").map(Number);
  const [closeHour, closeMinute] = close.split(":").map(Number);
  const start = openHour * 60 + openMinute;
  const end = closeHour * 60 + closeMinute;
  const slots: string[] = [];
  for (let minutes = start; minutes + duration <= end; minutes += 30) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    slots.push(
      `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    );
  }
  return slots;
}

// Placeholder reviews (replace with real data)
const FAKE_REVIEWS: Record<string, { rating: number; text: string }[]> = {};

export function AppointmentBooking({
  tenant,
  services,
  providers = [],
  viewOnly = false,
}: AppointmentBookingProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [concerns, setConcerns] = useState("");
  const [bookingOpen, setBookingOpen] = useState(false);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });
  const [isBooking, setIsBooking] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [confirmationId, setConfirmationId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"pay_later" | "mock_card">(
    "pay_later",
  );
  const [paymentConfirmation, setPaymentConfirmation] = useState("");
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [promotionCode, setPromotionCode] = useState("");

  const calendarDays = useMemo(
    () => buildCalendarDays(currentMonth),
    [currentMonth],
  );
  const selectedService =
    services.find((service) => service.id === selectedServiceId) ?? null;
  const eligibleProviders = useMemo(
    () =>
      providers.filter(
        (provider) =>
          selectedServiceId && provider.serviceIds.includes(selectedServiceId),
      ),
    [providers, selectedServiceId],
  );
  useEffect(() => {
    if (
      viewOnly ||
      !selectedDate ||
      !selectedServiceId ||
      !isSupabaseConfigured()
    ) {
      setAvailableSlots([]);
      setIsLoadingAvailability(false);
      setAvailabilityError("");
      return;
    }
    let active = true;
    setIsLoadingAvailability(true);
    setAvailableSlots([]);
    setAvailabilityError("");
    if (eligibleProviders.length > 0 && !selectedProviderId) {
      setIsLoadingAvailability(false);
      return;
    }
    listPublicAppointmentAvailability(
      tenant.id,
      selectedServiceId,
      selectedDate,
      selectedProviderId || undefined,
    )
      .then((slots) => {
        if (active) setAvailableSlots(slots);
      })
      .catch((err) => {
        if (active) {
          const message =
            err instanceof Error && err.message
              ? err.message
              : typeof err === "object" &&
                  err !== null &&
                  "message" in err &&
                  typeof err.message === "string"
                ? err.message
                : "Unable to load available times. Please try again.";
          setAvailabilityError(message);
        }
      })
      .finally(() => {
        if (active) setIsLoadingAvailability(false);
      });
    return () => {
      active = false;
    };
  }, [
    eligibleProviders.length,
    selectedDate,
    selectedProviderId,
    selectedServiceId,
    tenant.id,
    viewOnly,
  ]);

  const timeSlots = useMemo(() => {
    if (!selectedDate) return [];
    const selectedDay = new Date(`${selectedDate}T12:00:00`).getDay();
    const hours = tenant.businessHours[selectedDay];
    if (!hours || hours.closed || !hours.open || !hours.close) return [];
    if (isSupabaseConfigured() && !viewOnly) return availableSlots;
    return buildTimeSlots(
      hours.open,
      hours.close,
      selectedService?.duration ?? 30,
    );
  }, [
    availableSlots,
    selectedDate,
    selectedService?.duration,
    tenant.businessHours,
    viewOnly,
  ]);

  const today = dateKey(new Date());

  const filteredServices = useMemo(
    () =>
      services.filter(
        (s) =>
          (!categoryFilter || s.category === categoryFilter) &&
          (s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (s.description ?? "")
              .toLowerCase()
              .includes(searchQuery.toLowerCase())),
      ),
    [categoryFilter, services, searchQuery],
  );
  const serviceCategories = useMemo(
    () => [
      ...new Set(services.map((service) => service.category).filter(Boolean)),
    ],
    [services],
  );

  const extendedServices = filteredServices as ExtendedService[];
  const detailService =
    extendedServices.find((s) => s.id === selectedServiceId) ?? null;
  const reviews = detailService ? (FAKE_REVIEWS[detailService.id] ?? []) : [];

  const prevMonth = () =>
    setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const nextMonth = () =>
    setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));

  const beginBooking = (serviceId = selectedServiceId) => {
    if (!serviceId || !selectedDate || !selectedTime) return;
    setSelectedServiceId(serviceId);
    setBookingError("");
    setBookingOpen(true);
  };

  const submitBooking = async () => {
    if (viewOnly) {
      setBookingError(
        "This is a view-only demo. No appointment was submitted.",
      );
      return;
    }
    if (!selectedServiceId || !selectedDate || !selectedTime) return;
    if (
      !customer.name.trim() ||
      !customer.email.trim() ||
      !customer.phone.trim()
    ) {
      setBookingError("Name, email, and phone are required.");
      return;
    }

    setIsBooking(true);
    setBookingError("");
    try {
      const result = await createPublicAppointment({
        tenantId: tenant.id,
        serviceId: selectedServiceId,
        date: selectedDate,
        time: selectedTime,
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        notes: concerns,
        providerId: selectedProviderId || undefined,
        promotionCode: promotionCode.trim() || undefined,
        paymentMethod,
      });
      setConfirmationId(result.appointmentId);
      setPaymentConfirmation(
        result.paymentStatus.toUpperCase() === "PAID"
          ? `Mock payment ${result.paymentReference ?? ""} approved.`
          : "Payment will be collected by the business.",
      );
      setBookingOpen(false);
      setSelectedServiceId(null);
      setSelectedDate(null);
      setSelectedTime(null);
      setConcerns("");
      setSelectedProviderId("");
      setPromotionCode("");
      setPaymentMethod("pay_later");
    } catch (submitError) {
      setBookingError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to create the appointment.",
      );
    } finally {
      setIsBooking(false);
    }
  };

  const canBook =
    !!selectedServiceId &&
    !!selectedDate &&
    !!selectedTime &&
    (eligibleProviders.length === 0 || !!selectedProviderId);

  return (
    <>
      {confirmationId && (
        <div className="mb-5 rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-4 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
          <p className="font-bold">Appointment requested successfully.</p>
          <p className="mt-1 text-sm">
            Confirmation: {confirmationId.slice(0, 8).toUpperCase()}. The
            business will review your request.
          </p>
          {paymentConfirmation && (
            <p className="mt-1 text-sm">{paymentConfirmation}</p>
          )}
        </div>
      )}
      <div className="grid min-h-[calc(100dvh-260px)] min-w-0 grid-cols-1 gap-0 overflow-hidden rounded-2xl border border-slate-200 shadow-sm dark:border-slate-700 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_300px]">
        {/* Left sidebar: Calendar, Time slots, Notes */}
        <aside className="flex min-w-0 flex-col gap-6 border-b border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5 lg:border-b-0 lg:border-r lg:overflow-y-auto">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4">
              Booking for {tenant.name}
            </p>

            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                {currentMonth.toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={prevMonth}
                  className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                </button>
                <button
                  onClick={nextMonth}
                  className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                  aria-label="Next month"
                >
                  <ChevronRight className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 text-center mb-1">
              {WEEKDAYS.map((d, i) => (
                <span
                  key={d}
                  className={`text-[10px] font-semibold pb-1 ${
                    i === 0
                      ? "text-red-400"
                      : i === 6
                        ? "text-violet-400"
                        : "text-slate-400 dark:text-slate-500"
                  }`}
                >
                  {d}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-y-1 text-center">
              {calendarDays.map((day, idx) => {
                if (!day) return <div key={`empty-${idx}`} />;
                const iso = dateKey(day);
                const dow = day.getDay();
                const isToday = iso === today;
                const isSelected = iso === selectedDate;
                const isPast = iso < today;
                return (
                  <button
                    key={iso}
                    disabled={isPast}
                    onClick={() => {
                      setSelectedDate(iso);
                      setSelectedTime(null);
                    }}
                    className={`
                    aspect-square w-full rounded-full text-[11px] font-medium transition
                    disabled:opacity-30 disabled:cursor-not-allowed
                    ${
                      isSelected
                        ? "bg-violet-600 text-white"
                        : isToday
                          ? "ring-2 ring-violet-500 text-violet-600 dark:text-violet-400"
                          : dow === 0
                            ? "text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                            : dow === 6
                              ? "text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20"
                              : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    }
                  `}
                    aria-label={`Select ${day.toLocaleDateString(undefined, { month: "numeric", day: "numeric" })}`}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
          </div>

          {eligibleProviders.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                Choose a provider
              </p>
              <select
                value={selectedProviderId}
                onChange={(event) => {
                  setSelectedProviderId(event.target.value);
                  setSelectedTime(null);
                }}
                aria-label="Choose service provider"
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">Select a provider</option>
                {eligibleProviders.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Time slots */}
          <div>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              {selectedDate ? formatDate(selectedDate) : "Select a date"}
            </p>
            {isLoadingAvailability ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">
                Checking available times...
              </p>
            ) : availabilityError ? (
              <p className="text-xs text-red-500 text-center py-4">
                {availabilityError}
              </p>
            ) : timeSlots.length > 0 ? (
              <div className="grid grid-cols-2 gap-1.5">
                {timeSlots.map((slot) => {
                  const isSelected = selectedTime === slot;
                  return (
                    <button
                      key={slot}
                      onClick={() => setSelectedTime(slot)}
                      className={`
                      py-2 rounded-lg text-xs font-semibold transition
                      ${
                        isSelected
                          ? "bg-violet-600 text-white"
                          : "border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-400"
                      }
                    `}
                      aria-label={`Select time ${slot}`}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">
                {!selectedDate
                  ? "Pick a date to see available times."
                  : !selectedServiceId
                    ? "Select a service to see available times."
                    : "No times are available on this date."}
              </p>
            )}
          </div>

          {/* Notes */}
          <div>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              Notes / Concerns
            </p>
            <textarea
              value={concerns}
              onChange={(e) => setConcerns(e.target.value)}
              placeholder="Describe your concerns or special requests…"
              rows={4}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-xs text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-600 outline-none focus:ring-2 focus:ring-violet-500 resize-none"
              aria-label="Notes or concerns"
            />
          </div>
        </aside>

        {/* Center: Service list */}
        <div className="min-w-0 bg-slate-50 p-4 dark:bg-slate-900/50 sm:p-6 xl:overflow-y-auto">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Services
            </h2>
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800 sm:w-48 sm:flex-none">
                <svg
                  className="w-3.5 h-3.5 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  placeholder="Search…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent text-xs outline-none text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 w-full"
                  aria-label="Search services"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                aria-label="Filter services by department"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 outline-none hover:border-violet-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                <option value="">All departments</option>
                {serviceCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {extendedServices.length === 0 && (
              <div className="py-16 text-center text-slate-400 dark:text-slate-500 sm:col-span-2">
                <p className="text-sm">No services found.</p>
              </div>
            )}
            {extendedServices.map((service) => {
              const isSelected = selectedServiceId === service.id;
              return (
                <div
                  key={service.id}
                  className={`bg-white dark:bg-slate-800 rounded-xl border overflow-hidden transition hover:shadow-md ${
                    isSelected
                      ? "border-violet-500 ring-1 ring-violet-500"
                      : "border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <div className="relative h-36 w-full overflow-hidden bg-slate-100 dark:bg-slate-700">
                    <Image
                      src={service.image || PLACEHOLDER_IMG}
                      alt={service.name}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-cover"
                      unoptimized
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = PLACEHOLDER_IMG;
                      }}
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                      {service.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1 text-slate-500 dark:text-slate-400 text-xs">
                      <User className="w-3 h-3" />
                      <span>{service.specialty ?? service.description}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <DollarSign className="w-3 h-3" />
                      <span>{formatCurrency(service.price)}</span>
                      {service.duration > 0 && (
                        <>
                          <span className="text-slate-300 dark:text-slate-600 mx-1">
                            ·
                          </span>
                          <Clock className="w-3 h-3" />
                          <span>{service.duration} min</span>
                        </>
                      )}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => {
                          setSelectedServiceId(service.id);
                          setSelectedProviderId("");
                          setSelectedTime(null);
                        }}
                        className="flex-1 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition"
                        aria-label={`Book ${service.name}`}
                      >
                        {viewOnly ? "Preview Service" : "Book Now"}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedServiceId(service.id);
                          setSelectedProviderId("");
                          setSelectedTime(null);
                        }}
                        className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-violet-400 hover:text-violet-600 transition"
                        aria-label={`View details of ${service.name}`}
                      >
                        Detail
                      </button>
                      <button
                        className="w-9 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 hover:border-violet-400 hover:text-violet-600 dark:text-slate-400 transition"
                        aria-label={`Send message about ${service.name}`}
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right panel: Service detail */}
        <aside className="flex min-w-0 flex-col border-t border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 lg:col-span-2 xl:col-span-1 xl:border-l xl:border-t-0 xl:overflow-y-auto">
          {detailService ? (
            <>
              <div className="relative h-48 w-full overflow-hidden bg-slate-100 dark:bg-slate-700 flex-shrink-0">
                <Image
                  src={detailService.image || PLACEHOLDER_IMG}
                  alt={detailService.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover"
                  unoptimized
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = PLACEHOLDER_IMG;
                  }}
                />
              </div>

              <div className="p-5 flex flex-col gap-5 flex-1">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                    {detailService.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className="bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                      {detailService.specialty ?? "Service"}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {formatCurrency(detailService.price)}
                    </span>
                    {detailService.duration > 0 && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        ⏱ {detailService.duration} min
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <SectionHeading>Description</SectionHeading>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mt-1.5">
                    {detailService.description || "No description available."}
                  </p>
                </div>

                {detailService.includes &&
                  detailService.includes.length > 0 && (
                    <div>
                      <SectionHeading>What&apos;s Included</SectionHeading>
                      <ul className="mt-1.5 space-y-1">
                        {detailService.includes.map((item, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400"
                          >
                            <span className="text-violet-500 mt-0.5">•</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                {detailService.specialities &&
                  detailService.specialities.length > 0 && (
                    <div>
                      <SectionHeading>Speciality</SectionHeading>
                      <ul className="mt-1.5 space-y-1">
                        {detailService.specialities.map((item, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400"
                          >
                            <span className="text-violet-500 mt-0.5">•</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                <div>
                  <SectionHeading>Reviews</SectionHeading>
                  {reviews.length === 0 ? (
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                      No reviews yet for this service.
                    </p>
                  ) : (
                    <div className="mt-2 space-y-3">
                      {reviews.map((r, i) => (
                        <div key={i}>
                          <div className="flex gap-0.5 text-amber-400 text-sm">
                            {Array.from({ length: 5 }).map((_, s) => (
                              <Star
                                key={s}
                                className="w-3.5 h-3.5"
                                fill={s < r.rating ? "currentColor" : "none"}
                              />
                            ))}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 italic">
                            &ldquo;{r.text}&rdquo;
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
                <button
                  onClick={() => beginBooking()}
                  disabled={viewOnly || !canBook}
                  className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold transition"
                >
                  {viewOnly
                    ? "Demo preview only"
                    : canBook
                      ? "Book Now →"
                      : "Select date & time to book"}
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400 dark:text-slate-500 px-6 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl">
                📋
              </div>
              <p className="text-sm font-medium">
                Select a service to see details
              </p>
              <p className="text-xs">
                Click Detail on any service card to see description, inclusions,
                and reviews.
              </p>
            </div>
          )}
        </aside>

        {/* Floating confirmation bar */}
        {canBook && !viewOnly && (
          <div className="fixed bottom-3 left-1/2 z-50 flex w-[calc(100%-1.5rem)] max-w-3xl -translate-x-1/2 flex-col items-stretch gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-sm shadow-xl dark:border-slate-700 dark:bg-slate-800 sm:bottom-6 sm:w-auto sm:flex-row sm:items-center sm:gap-4 sm:rounded-full sm:px-5 sm:py-2.5">
            <span className="truncate font-semibold text-slate-800 dark:text-white">
              {detailService?.name}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500 sm:text-sm">
              {formatDate(selectedDate!)} at {selectedTime}
            </span>
            <button
              onClick={() => beginBooking()}
              className="rounded-full bg-violet-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-violet-700"
              aria-label="Confirm booking"
            >
              Confirm Booking
            </button>
          </div>
        )}
      </div>

      <Modal
        open={bookingOpen}
        onClose={() => !isBooking && setBookingOpen(false)}
        title="Complete your booking"
        footer={
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={isBooking}
              onClick={() => setBookingOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="button"
              loading={isBooking}
              onClick={submitBooking}
              className="flex-1"
            >
              {isBooking ? "Booking..." : "Request Appointment"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-violet-500/10 p-4 text-sm text-violet-200">
            <p className="font-bold">
              {selectedService?.name ?? "Selected service"}
            </p>
            <p className="mt-1 text-violet-300">
              {selectedDate ? formatDate(selectedDate) : ""} at {selectedTime} ·{" "}
              {selectedService?.duration ?? 0} min
            </p>
            <p className="mt-1 font-semibold">
              {formatCurrency(selectedService?.price ?? 0)}
            </p>
          </div>
          <Input
            label="Full Name"
            autoComplete="name"
            value={customer.name}
            onChange={(event) =>
              setCustomer((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
          />
          <Input
            label="Email Address"
            type="email"
            autoComplete="email"
            value={customer.email}
            onChange={(event) =>
              setCustomer((current) => ({
                ...current,
                email: event.target.value,
              }))
            }
          />
          <Input
            label="Phone Number"
            type="tel"
            autoComplete="tel"
            value={customer.phone}
            onChange={(event) =>
              setCustomer((current) => ({
                ...current,
                phone: event.target.value,
              }))
            }
          />
          <Input
            label="Discount Code (optional)"
            value={promotionCode}
            onChange={(event) =>
              setPromotionCode(
                event.target.value.toUpperCase().replace(/\s/g, ""),
              )
            }
            placeholder="WELCOME10"
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">
              Payment
            </label>
            <select
              value={paymentMethod}
              onChange={(event) =>
                setPaymentMethod(
                  event.target.value as "pay_later" | "mock_card",
                )
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"
            >
              <option value="pay_later">Pay at the appointment</option>
              <option value="mock_card">
                Mock card payment (testing only)
              </option>
            </select>
            {paymentMethod === "mock_card" && (
              <p className="mt-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-300">
                No card details or real money are used. The required deposit, or
                the full service price when no deposit is required, is recorded
                as a simulated payment.
              </p>
            )}
          </div>
          {bookingError && (
            <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {bookingError}
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-1 h-3.5 rounded-full bg-violet-600" />
      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
        {children}
      </span>
    </div>
  );
}
