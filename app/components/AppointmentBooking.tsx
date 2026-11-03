"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  MessageCircle,
  Star,
  User,
  ClipboardList,
  Landmark,
  Store,
  UploadCloud,
  Copy,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/app/lib/utils";
import { createPublicAppointment } from "@/app/services/bookingService";
import { listPublicAppointmentAvailability } from "@/app/services/appointmentService";
import { isSupabaseConfigured } from "@/app/lib/supabase/config";
import { parseStorefrontDesign } from "@/app/lib/storefront-design";
import { Button } from "@/app/components/Button";
import { Input } from "@/app/components/input";
import { Modal } from "@/app/components/Modal";
import { StorefrontOffers } from "@/app/components/StorefrontOffers";
import { StorefrontHero } from "@/app/components/StorefrontHero";
import {
  MAX_PROMOTION_CODE_LENGTH,
  normalizePromotionCode,
} from "@/app/lib/promotions";
import { validatePromotion } from "@/app/services/businessToolsService";
import {
  PAYMENT_METHOD_LABELS,
  type BusinessPaymentMethod,
  type PaymentMethodConfiguration,
  type PublicBusinessPaymentConfiguration,
} from "@/app/lib/business-payments";
import type {
  BusinessReview,
  PublicPromotion,
  PublicServiceProvider,
  Service,
  Tenant,
} from "@/app/types/index";

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
  reviews?: BusinessReview[];
  promotions?: PublicPromotion[];
  viewOnly?: boolean;
  onTrackAppointment?: (reference: string) => void;
}

// Helpers
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PLACEHOLDER_IMG = "/fallback-product.png";

/**
 * Lightweight client-side validation mirrors the public booking API enough to
 * give customers immediate feedback. The server remains authoritative.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(value: string) {
  return EMAIL_PATTERN.test(value.trim());
}

function isValidPhone(value: string) {
  const normalized = value.trim();
  return normalized.length >= 7 && normalized.length <= 40;
}

function isValidBookingDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidBookingTime(value: string) {
  return /^\d{2}:\d{2}(?::\d{2})?$/.test(value);
}

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

export function AppointmentBooking({
  tenant,
  services,
  providers = [],
  reviews = [],
  promotions = [],
  viewOnly = false,
  onTrackAppointment,
}: AppointmentBookingProps) {
  const storefrontDesign = parseStorefrontDesign(
    tenant.storefrontDesign,
    tenant.businessType,
  );
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
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [depositCheckout, setDepositCheckout] = useState<
    | (NonNullable<
        Awaited<ReturnType<typeof createPublicAppointment>>["depositCheckout"]
      > & { appointmentId: string; appointmentNumber: string })
    | null
  >(null);
  const [selectedDepositBankId, setSelectedDepositBankId] = useState("");
  const [depositReceipt, setDepositReceipt] = useState<File | null>(null);
  const [depositUploadError, setDepositUploadError] = useState("");
  const [isUploadingDeposit, setIsUploadingDeposit] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<BusinessPaymentMethod>(
    "payment_at_appointment",
  );
  const [paymentOption, setPaymentOption] = useState<"deposit" | "full">(
    "deposit",
  );
  const [paymentConfirmation, setPaymentConfirmation] = useState("");
  const [paymentConfiguration, setPaymentConfiguration] =
    useState<PublicBusinessPaymentConfiguration | null>(null);
  const [paymentConfigurationLoading, setPaymentConfigurationLoading] =
    useState(true);
  const [paymentConfigurationError, setPaymentConfigurationError] =
    useState("");
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [promotionCode, setPromotionCode] = useState("");
  const [appliedPromotion, setAppliedPromotion] = useState<{
    code: string;
    name: string;
    discountAmount: number;
  } | null>(null);
  const [isApplyingPromotion, setIsApplyingPromotion] = useState(false);

  const calendarDays = useMemo(
    () => buildCalendarDays(currentMonth),
    [currentMonth],
  );
  const selectedService =
    services.find((service) => service.id === selectedServiceId) ?? null;
  const appointmentPaymentOptions = useMemo<
    Array<PaymentMethodConfiguration & { available: boolean }>
  >(() => {
    const configured = (paymentConfiguration?.methods ?? []).filter(
      (method) =>
        method.enabled &&
        ["bank_transfer", "payment_at_appointment", "external_link"].includes(
          method.method,
        ),
    );
    if (selectedService?.requiresDeposit) {
      const bankTransfer: PaymentMethodConfiguration & {
        available: boolean;
      } = {
        ...(configured.find((method) => method.method === "bank_transfer") ?? {
          method: "bank_transfer" as const,
          enabled: true,
          modules: ["appointment" as const],
          instructions:
            "Transfer the required deposit to the business, then upload your receipt.",
        }),
        available: true,
      };
      const inPerson: PaymentMethodConfiguration & { available: boolean } = {
        ...(configured.find(
          (method) => method.method === "payment_at_appointment",
        ) ?? {
          method: "payment_at_appointment" as const,
          enabled: true,
          modules: ["appointment" as const],
          instructions:
            "Arrange the required deposit directly with the business owner.",
        }),
        available: true,
      };
      return [bankTransfer, inPerson];
    }
    return configured.length
      ? configured.map((option) => ({ ...option, available: true }))
      : [
          {
            method: "payment_at_appointment" as const,
            enabled: true,
            modules: ["appointment" as const],
            instructions: "Pay the business when you attend your appointment.",
            available: true,
          },
        ].map((option) => ({ ...option, available: true }));
  }, [paymentConfiguration, selectedService?.requiresDeposit]);
  const eligibleProviders = useMemo(
    () =>
      providers.filter(
        (provider) =>
          selectedServiceId && provider.serviceIds.includes(selectedServiceId),
      ),
    [providers, selectedServiceId],
  );

  useEffect(() => {
    const controller = new AbortController();
    setPaymentConfigurationLoading(true);
    setPaymentConfigurationError("");
    fetch(
      `/api/public/payment-options?tenantId=${encodeURIComponent(tenant.id)}&module=appointment`,
      { signal: controller.signal, cache: "no-store" },
    )
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            "Business payment options are unavailable. Please try again.",
          );
        return response.json() as Promise<PublicBusinessPaymentConfiguration>;
      })
      .then((configuration) => {
        if (!controller.signal.aborted) setPaymentConfiguration(configuration);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setPaymentConfiguration(null);
          setPaymentConfigurationError(
            error instanceof Error
              ? error.message
              : "Unable to load payment options.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setPaymentConfigurationLoading(false);
      });
    return () => controller.abort();
  }, [tenant.id]);

  useEffect(() => {
    if (
      appointmentPaymentOptions.length > 0 &&
      !appointmentPaymentOptions.some(
        (option) =>
          option.method === paymentMethod && option.available !== false,
      )
    ) {
      setPaymentMethod(
        appointmentPaymentOptions.find((option) => option.available !== false)
          ?.method ?? "payment_at_appointment",
      );
    }
  }, [appointmentPaymentOptions, paymentMethod]);

  /**
   * A provider selected for one service must never leak into another service.
   * This also handles live storefront data changing while the page is open.
   */
  useEffect(() => {
    if (
      selectedProviderId &&
      !eligibleProviders.some((provider) => provider.id === selectedProviderId)
    ) {
      setSelectedProviderId("");
      setSelectedTime(null);
    }
  }, [eligibleProviders, selectedProviderId]);
  useEffect(() => {
    setAppliedPromotion(null);
    setPaymentOption("deposit");
  }, [selectedServiceId]);
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
        if (!active) return;

        /**
         * Only render well-formed, unique slot values returned by the server.
         * The server still performs the final availability check at booking.
         */
        const normalizedSlots = Array.from(
          new Set(slots.filter((slot) => isValidBookingTime(slot))),
        ).sort();

        setAvailableSlots(normalizedSlots);
        setSelectedTime((current) =>
          current && normalizedSlots.includes(current) ? current : null,
        );
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
  const serviceReviews = detailService
    ? reviews.filter((review) => review.serviceId === detailService.id)
    : [];

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

  const applyPromotion = async () => {
    if (!selectedService || !promotionCode.trim()) return;
    setIsApplyingPromotion(true);
    setBookingError("");
    try {
      const validated = await validatePromotion(
        tenant.id,
        promotionCode,
        selectedService.price,
        [],
        selectedService.id,
      );
      setAppliedPromotion({
        code: validated.code,
        name: validated.name,
        discountAmount: Math.min(
          selectedService.price,
          validated.discountAmount,
        ),
      });
    } catch (promotionError) {
      setAppliedPromotion(null);
      setBookingError(
        promotionError instanceof Error
          ? promotionError.message
          : "That discount code is not valid.",
      );
    } finally {
      setIsApplyingPromotion(false);
    }
  };

  const submitBooking = async () => {
    if (viewOnly) {
      setBookingError(
        "This is a view-only demo. No appointment was submitted.",
      );
      return;
    }

    if (!selectedServiceId || !selectedDate || !selectedTime) {
      setBookingError("Choose a service, date, and available time.");
      return;
    }

    if (!selectedService) {
      setBookingError("The selected service is no longer available.");
      return;
    }

    if (
      !isValidBookingDate(selectedDate) ||
      !isValidBookingTime(selectedTime)
    ) {
      setBookingError("Choose a valid appointment date and time.");
      return;
    }

    /**
     * When the selected service has providers, a provider is required. Validate
     * against the eligible list rather than trusting a stale select value.
     */
    if (
      eligibleProviders.length > 0 &&
      !eligibleProviders.some((provider) => provider.id === selectedProviderId)
    ) {
      setBookingError("Choose an available service provider.");
      return;
    }

    const customerName = customer.name.trim();
    const customerEmail = customer.email.trim().toLowerCase();
    const customerPhone = customer.phone.trim();
    const bookingNotes = concerns.trim();

    if (customerName.length < 2 || customerName.length > 120) {
      setBookingError("Enter a valid full name.");
      return;
    }

    if (!isValidEmail(customerEmail)) {
      setBookingError("Enter a valid email address.");
      return;
    }

    if (!isValidPhone(customerPhone)) {
      setBookingError("Enter a valid phone number.");
      return;
    }

    if (bookingNotes.length > 2000) {
      setBookingError("Notes must be 2,000 characters or fewer.");
      return;
    }

    if (
      promotionCode.trim() &&
      appliedPromotion?.code !== normalizePromotionCode(promotionCode)
    ) {
      setBookingError(
        "Apply the discount code before requesting the appointment.",
      );
      return;
    }

    if (!isSupabaseConfigured()) {
      setBookingError("Online appointment booking is not configured.");
      return;
    }

    if (paymentConfigurationLoading) {
      setBookingError(
        "Wait for the business payment options to finish loading.",
      );
      return;
    }

    if (paymentConfigurationError) {
      setBookingError(paymentConfigurationError);
      return;
    }

    if (
      paymentMethod === "bank_transfer" &&
      paymentConfiguration?.bankTransferAvailable !== true
    ) {
      setBookingError(
        "Bank transfer is not available because this business has not added an active bank account. Choose pay deposit in person or contact the business.",
      );
      return;
    }

    if (
      !appointmentPaymentOptions.some(
        (option) =>
          option.method === paymentMethod && option.available !== false,
      )
    ) {
      setBookingError("Choose an available business payment method.");
      return;
    }

    setIsBooking(true);
    setBookingError("");

    try {
      /**
       * Only identifiers and customer selections are submitted. Service price,
       * deposit amount, promotion value, provider eligibility, and final slot
       * availability must be calculated/validated by the server/database.
       */
      const result = await createPublicAppointment({
        tenantId: tenant.id,
        serviceId: selectedServiceId,
        date: selectedDate,
        time: selectedTime,
        customerName,
        customerEmail,
        customerPhone,
        notes: bookingNotes,
        providerId:
          eligibleProviders.length > 0 ? selectedProviderId : undefined,
        promotionCode: appliedPromotion?.code,
        paymentMethod,
        paymentOption: selectedPaymentOption,
      });

      if (
        paymentMethod === "bank_transfer" &&
        result.appointmentNumber &&
        result.depositCheckout
      ) {
        setConfirmationId(result.appointmentNumber);
        setDepositCheckout({
          ...result.depositCheckout,
          appointmentId: result.appointmentId,
          appointmentNumber: result.appointmentNumber,
        });
        setSelectedDepositBankId(
          result.depositCheckout.bankAccounts[0]?.id ?? "",
        );
        setDepositReceipt(null);
        setDepositUploadError("");
        setRequestSubmitted(false);
      } else {
        setConfirmationId("");
        setRequestSubmitted(true);
        setPaymentConfirmation(
          "Your request is awaiting the business owner's confirmation. The owner will confirm the time allowed for an in-person deposit, and you will receive an email only after the booking is confirmed.",
        );
      }

      setBookingOpen(false);
      setSelectedServiceId(null);
      setSelectedDate(null);
      setSelectedTime(null);
      setConcerns("");
      setSelectedProviderId("");
      setPromotionCode("");
      setAppliedPromotion(null);
      setPaymentMethod("payment_at_appointment");
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

  const uploadDepositReceipt = async () => {
    if (!depositCheckout || !depositReceipt || !selectedDepositBankId) {
      setDepositUploadError(
        "Choose the destination bank and select a receipt.",
      );
      return;
    }
    setIsUploadingDeposit(true);
    setDepositUploadError("");
    try {
      const form = new FormData();
      form.set("tenantId", tenant.id);
      form.set("targetType", "appointment");
      form.set("targetId", depositCheckout.appointmentId);
      form.set("accessToken", depositCheckout.accessToken);
      form.set("customerEmail", depositCheckout.customerEmail);
      form.set("amount", String(depositCheckout.amount));
      form.set("paymentDate", dateKey(new Date()));
      form.set("transactionReference", depositCheckout.appointmentNumber);
      form.set("bankAccountId", selectedDepositBankId);
      form.set("receipt", depositReceipt);
      const response = await fetch("/api/public/payment-receipts", {
        method: "POST",
        body: form,
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || "Unable to upload the receipt.");
      }
      setDepositCheckout(null);
      setDepositReceipt(null);
      setRequestSubmitted(true);
      setPaymentConfirmation(
        "Your deposit receipt was uploaded and is awaiting verification. The business will email you after the appointment is confirmed.",
      );
    } catch (error) {
      setDepositUploadError(
        error instanceof Error
          ? error.message
          : "Unable to upload the receipt.",
      );
    } finally {
      setIsUploadingDeposit(false);
    }
  };

  const canBook =
    !!selectedService &&
    !!selectedDate &&
    isValidBookingDate(selectedDate) &&
    !!selectedTime &&
    isValidBookingTime(selectedTime) &&
    (eligibleProviders.length === 0 ||
      eligibleProviders.some((provider) => provider.id === selectedProviderId));
  const selectedTotal = Math.max(
    0,
    (selectedService?.price ?? 0) - (appliedPromotion?.discountAmount ?? 0),
  );
  const requiredDeposit = selectedService?.requiresDeposit
    ? selectedService.depositType === "percentage"
      ? Math.min(
          selectedTotal,
          selectedTotal * ((selectedService.depositAmount ?? 0) / 100),
        )
      : Math.min(selectedTotal, selectedService.depositAmount ?? 0)
    : 0;
  const selectedPaymentOption = requiredDeposit > 0 ? paymentOption : "full";

  return (
    <>
      {requestSubmitted && (
        <div className="mb-5 rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-4 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
          <p className="font-bold">Appointment requested successfully.</p>
          {confirmationId && (
            <p className="mt-1 text-sm">
              Track Booking reference: {confirmationId}. The business will
              review your request.
            </p>
          )}
          {paymentConfirmation && (
            <p className="mt-1 text-sm">{paymentConfirmation}</p>
          )}
          {confirmationId && onTrackAppointment && (
            <button
              type="button"
              onClick={() => onTrackAppointment(confirmationId)}
              className="mt-3 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-600"
            >
              Track Booking
            </button>
          )}
        </div>
      )}
      {storefrontDesign.sections.promotions && (
        <StorefrontOffers
          promotions={promotions}
          onSelectCode={(code) => {
            setPromotionCode(code);
            setAppliedPromotion(null);
            setBookingError("");
          }}
        />
      )}
      <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        {/* Left sidebar: Calendar, Time slots, Notes */}
        <aside
          id="appointment-booking-panel"
          className="order-2 flex min-w-0 scroll-mt-24 flex-col gap-5 rounded-2xl border border-[#26364f] bg-[#0d1829] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.22)] light:border-slate-200 light:bg-white xl:sticky xl:top-24 xl:self-start"
        >
          <div>
            <p className="mb-4 text-base font-black text-white light:text-slate-950">
              Select Date &amp; Time
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
                    mx-auto flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold transition
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
              <div className="grid grid-cols-3 gap-1.5">
                {timeSlots.map((slot) => {
                  const isSelected = selectedTime === slot;
                  return (
                    <button
                      key={slot}
                      onClick={() => setSelectedTime(slot)}
                      className={`
                      rounded-lg py-2 text-[10px] font-semibold transition
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
          <div className="hidden">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              Notes / Concerns
            </p>
            <textarea
              value={concerns}
              onChange={(e) => setConcerns(e.target.value)}
              placeholder="Describe your concerns or special requests…"
              rows={4}
              maxLength={2000}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-xs text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-600 outline-none focus:ring-2 focus:ring-violet-500 resize-none"
              aria-label="Notes or concerns"
            />
          </div>

          <div className="border-t border-[#26364f] pt-5 light:border-slate-200">
            {selectedService ? (
              <div className="flex gap-3 rounded-xl border border-[#2b3b55] bg-[#111d30] p-3 light:border-slate-200 light:bg-slate-50">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-800">
                  <Image
                    src={selectedService.image || PLACEHOLDER_IMG}
                    alt=""
                    fill
                    sizes="56px"
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-black text-white light:text-slate-950">
                    {selectedService.name}
                  </p>
                  <p className="mt-1 text-[10px] text-[#8292aa]">
                    {formatCurrency(selectedService.price)} ·{" "}
                    {selectedService.duration} min
                  </p>
                  {selectedDate && selectedTime && (
                    <p className="mt-1 truncate text-[10px] font-bold text-violet-300 light:text-violet-700">
                      {formatDate(selectedDate)} at {selectedTime}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-[#2b3b55] px-3 py-4 text-center text-xs text-[#71829b] light:border-slate-300">
                Select a service to begin.
              </p>
            )}
            <button
              type="button"
              onClick={() => beginBooking()}
              disabled={viewOnly || !canBook}
              className="mt-4 w-full rounded-xl bg-linear-to-r from-violet-700 to-purple-600 py-3 text-xs font-black text-white shadow-lg shadow-violet-900/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {viewOnly
                ? "Demo Preview"
                : canBook
                  ? "Confirm Booking"
                  : "Select service, date & time"}
            </button>
            <p className="mt-3 text-center text-[9px] font-semibold text-[#71829b]">
              Professional staff · Clean &amp; secure · Easy rescheduling
            </p>
          </div>
        </aside>

        {/* Center: Service list */}
        <div className="order-1 min-w-0 space-y-5">
          <StorefrontHero
            tenant={tenant}
            onAction={() => {
              const firstService = extendedServices[0];
              if (firstService) setSelectedServiceId(firstService.id);
              document
                .getElementById("appointment-booking-panel")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          />
          {false && (
            <section className="relative min-h-64 overflow-hidden rounded-2xl border border-[#26364f] bg-[#0d1829] light:border-slate-200 light:bg-white">
              <Image
                src={tenant.coverImage || PLACEHOLDER_IMG}
                alt=""
                fill
                sizes="(max-width: 1280px) 100vw, 75vw"
                className="pointer-events-none object-cover opacity-55 blur-xl scale-110"
                aria-hidden="true"
                unoptimized
              />
              <Image
                src={tenant.coverImage || PLACEHOLDER_IMG}
                alt={tenant.name}
                fill
                priority
                sizes="(max-width: 1280px) 100vw, 75vw"
                className="object-contain"
                style={{
                  objectPosition: `${tenant.coverImagePositionX ?? 50}% ${tenant.coverImagePositionY ?? 50}%`,
                  transform: `scale(${(tenant.coverImageZoom ?? 100) / 100})`,
                }}
                unoptimized
                onError={(event) => {
                  (event.target as HTMLImageElement).src = PLACEHOLDER_IMG;
                }}
              />
              <div className="absolute inset-0 bg-linear-to-r from-[#080d18]/45 via-[#080d18]/15 to-transparent" />
              <div className="relative flex min-h-64 max-w-xl flex-col justify-center p-6 sm:p-9">
                <p className="mb-3 text-[10px] font-black uppercase tracking-[0.22em] text-violet-300">
                  Premium care, made simple
                </p>
                <h2 className="text-3xl font-black leading-none text-white [text-shadow:0_2px_14px_rgba(0,0,0,0.7)] sm:text-5xl">
                  Look Good
                  <br />
                  Feel <span className="text-violet-400">Amazing</span>
                </h2>
                <p className="mt-4 max-w-md text-sm leading-6 text-white/90 [text-shadow:0_1px_8px_rgba(0,0,0,0.72)]">
                  {tenant.description ||
                    "Premium services tailored to you. Book your appointment in minutes."}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const firstService = extendedServices[0];
                    if (firstService) {
                      setSelectedServiceId(firstService.id);
                      setSelectedProviderId("");
                      setSelectedTime(null);
                    }
                    document
                      .getElementById("appointment-booking-panel")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="mt-5 w-fit rounded-xl bg-linear-to-r from-violet-700 to-fuchsia-600 px-5 py-3 text-xs font-black text-white shadow-lg shadow-violet-900/30 transition hover:brightness-110"
                >
                  Book Now
                </button>
              </div>
            </section>
          )}

          <div className="rounded-2xl border border-[#26364f] bg-[#091322] p-4 light:border-slate-200 light:bg-slate-50 sm:p-5">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-black text-white light:text-slate-950">
                Popular Services
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
                    id="storefront-search"
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

            <div
              className="mb-5 flex gap-2 overflow-x-auto pb-1"
              aria-label="Service categories"
            >
              {["", ...serviceCategories].map((category) => (
                <button
                  key={category || "all"}
                  type="button"
                  onClick={() => setCategoryFilter(category)}
                  className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition ${
                    categoryFilter === category
                      ? "border-violet-500 bg-violet-600 text-white"
                      : "border-[#26364f] bg-[#0d1829] text-[#a9b7ca] hover:border-violet-400 light:border-slate-200 light:bg-white light:text-slate-600"
                  }`}
                >
                  {category || "All"}
                </button>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {extendedServices.length === 0 && (
                <div className="py-16 text-center text-slate-400 dark:text-slate-500 sm:col-span-2 lg:col-span-3">
                  <p className="text-sm">No services found.</p>
                </div>
              )}
              {extendedServices.map((service) => {
                const isSelected = selectedServiceId === service.id;
                return (
                  <div
                    key={service.id}
                    className={`overflow-hidden rounded-xl border bg-[#0d1829] transition hover:-translate-y-0.5 hover:shadow-xl light:bg-white ${
                      isSelected
                        ? "border-violet-500 ring-1 ring-violet-500"
                        : "border-[#26364f] light:border-slate-200"
                    }`}
                  >
                    <div className="relative h-40 w-full overflow-hidden bg-[#172238]">
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
                      <h3 className="truncate text-sm font-black text-white light:text-slate-950">
                        {service.name}
                      </h3>
                      <div className="mt-1 flex min-h-8 items-start gap-1.5 text-[11px] leading-4 text-[#8798b2] light:text-slate-500">
                        <User className="w-3 h-3" />
                        <span>{service.specialty ?? service.description}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-1 text-xs font-semibold text-white light:text-slate-800">
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
                            setBookingError("");
                          }}
                          className="flex-1 rounded-lg bg-linear-to-r from-violet-700 to-purple-600 py-2.5 text-xs font-black text-white transition hover:brightness-110"
                          aria-label={`Book ${service.name}`}
                        >
                          {viewOnly ? "Preview Service" : "Book Now"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedServiceId(service.id);
                            setSelectedProviderId("");
                            setSelectedTime(null);
                            setBookingError("");
                          }}
                          className="rounded-lg border border-[#2b3b55] px-3 py-2 text-xs font-semibold text-[#9aabc3] transition hover:border-violet-400 hover:text-violet-300 light:border-slate-200 light:text-slate-600"
                          aria-label={`View details of ${service.name}`}
                        >
                          Detail
                        </button>
                        <button
                          type="button"
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
        </div>

        {/* Keep service details visible while customers browse the service list. */}
        <aside className="hidden">
          {detailService ? (
            <>
              <div className="relative h-48 w-full shrink-0 overflow-hidden bg-slate-100 dark:bg-slate-700">
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
                  {serviceReviews.length === 0 ? (
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                      No reviews yet for this service.
                    </p>
                  ) : (
                    <div className="mt-2 space-y-3">
                      {serviceReviews.map((review) => (
                        <div key={review.id}>
                          <div className="flex gap-0.5 text-amber-400 text-sm">
                            {Array.from({ length: 5 }).map((_, s) => (
                              <Star
                                key={s}
                                className="w-3.5 h-3.5"
                                fill={
                                  s < review.rating ? "currentColor" : "none"
                                }
                              />
                            ))}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 italic">
                            &ldquo;{review.body}&rdquo;
                          </p>
                          <p className="mt-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                            {review.reviewerName}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="shrink-0 border-t border-slate-100 p-5 dark:border-slate-800">
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
            <div className="flex min-h-96 flex-col items-center justify-center gap-3 px-6 text-center text-slate-400 dark:text-slate-500">
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
          <div className="hidden">
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
        maxWidth="max-w-5xl"
        contentClassName="py-3 sm:px-4"
        footer={
          <div>
            <Button
              type="button"
              loading={isBooking}
              onClick={submitBooking}
              className="min-h-12 w-full justify-center text-base"
            >
              {isBooking ? "Booking..." : "Request Appointment"}
            </Button>
          </div>
        }
      >
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="hidden">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 font-black text-white">
                {tenant.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate font-black">{tenant.name}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Appointment checkout
                </p>
              </div>
            </div>
            <div className="hidden items-center md:flex">
              {[
                ["1", "Service", true],
                ["2", "Booking", true],
                ["3", "Review", false],
                ["4", "Complete", false],
              ].map(([step, label, active], index) => (
                <div key={String(step)} className="flex items-center">
                  {index > 0 && (
                    <span
                      className={`h-px w-12 lg:w-20 ${active ? "bg-violet-500" : "bg-slate-600"}`}
                    />
                  )}
                  <span className="flex flex-col items-center gap-1">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold ${active ? "border-violet-400 bg-violet-600 text-white" : "border-slate-600 text-slate-400"}`}
                    >
                      {step}
                    </span>
                    <span className="text-[10px] text-slate-400">{label}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="hidden">
            <p className="font-bold">
              {selectedService?.name ?? "Selected service"}
            </p>
            <p className="mt-1 text-violet-300">
              {selectedDate ? formatDate(selectedDate) : ""} at {selectedTime} ·{" "}
              {selectedService?.duration ?? 0} min
            </p>
            <p className="mt-1 font-semibold">
              {appliedPromotion ? (
                <>
                  <span className="mr-2 text-violet-300 line-through">
                    {formatCurrency(selectedService?.price ?? 0)}
                  </span>
                  {formatCurrency(
                    Math.max(
                      0,
                      (selectedService?.price ?? 0) -
                        appliedPromotion.discountAmount,
                    ),
                  )}
                </>
              ) : (
                formatCurrency(selectedService?.price ?? 0)
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {requiredDeposit > 0 ? (
                <span className="rounded-full bg-amber-500/15 px-3 py-1 font-bold text-amber-300">
                  Deposit due: {formatCurrency(requiredDeposit)}
                </span>
              ) : (
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 font-bold text-emerald-300">
                  No deposit required
                </span>
              )}
              <span className="rounded-full bg-white/5 px-3 py-1 text-violet-200">
                Balance:{" "}
                {formatCurrency(Math.max(0, selectedTotal - requiredDeposit))}
              </span>
            </div>
          </div>
          {requiredDeposit > 0 && (
            <section className="overflow-hidden rounded-xl border border-slate-700 bg-[#0c1b2e] light:border-slate-200 light:bg-white lg:col-span-2">
              <div className="flex items-center gap-2 border-b border-slate-700 px-4 py-3 light:border-slate-200">
                <DollarSign className="h-5 w-5 text-violet-400" />
                <h3 className="font-black">Choose payment amount</h3>
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setPaymentOption("deposit")}
                  className={`rounded-xl border p-4 text-left transition ${paymentOption === "deposit" ? "border-violet-400 bg-violet-600/20" : "border-slate-600 bg-[#091525] hover:border-violet-500 light:bg-slate-50"}`}
                >
                  <span className="block font-bold">Pay deposit</span>
                  <span className="mt-1 block text-sm text-slate-400 light:text-slate-600">
                    Pay {formatCurrency(requiredDeposit)} now. Remaining
                    balance:{" "}
                    {formatCurrency(
                      Math.max(0, selectedTotal - requiredDeposit),
                    )}
                    .
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentOption("full")}
                  className={`rounded-xl border p-4 text-left transition ${paymentOption === "full" ? "border-violet-400 bg-violet-600/20" : "border-slate-600 bg-[#091525] hover:border-violet-500 light:bg-slate-50"}`}
                >
                  <span className="block font-bold">Pay in full</span>
                  <span className="mt-1 block text-sm text-slate-400 light:text-slate-600">
                    Pay the full appointment total of{" "}
                    {formatCurrency(selectedTotal)}.
                  </span>
                </button>
              </div>
            </section>
          )}
          <section className="overflow-hidden rounded-xl border border-slate-700 bg-[#0c1b2e] light:border-slate-200 light:bg-white">
            <div className="flex items-center gap-2 border-b border-slate-700 px-4 py-3 light:border-slate-200">
              <User className="h-5 w-5 text-violet-400" />
              <h3 className="font-black">Customer Information</h3>
            </div>
            <div className="grid gap-4 p-4 sm:grid-cols-2">
              <Input
                label="Full Name"
                autoComplete="name"
                value={customer.name}
                maxLength={120}
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
                maxLength={320}
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
                maxLength={40}
                onChange={(event) =>
                  setCustomer((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
              />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">
                  Notes / Concerns (optional)
                </label>
                <textarea
                  value={concerns}
                  onChange={(event) => setConcerns(event.target.value)}
                  placeholder="Describe any concerns or special requests"
                  rows={2}
                  maxLength={2000}
                  className="w-full resize-none rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-500"
                />
              </div>
            </div>
          </section>
          <div className="rounded-xl border border-slate-700 bg-[#0c1b2e] p-4 light:border-slate-200 light:bg-white">
            <div className="mb-3 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-violet-400" />
              <h3 className="font-black">Booking Details</h3>
            </div>
            <div className="mb-3 rounded-xl border border-violet-500/25 bg-violet-500/10 p-3">
              <div className="flex items-start gap-3">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-violet-400/30 bg-slate-800">
                  <Image
                    src={selectedService?.image || PLACEHOLDER_IMG}
                    alt={selectedService?.name || "Selected service"}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </div>
                <div>
                  <p className="text-sm font-bold">
                    {selectedService?.name ?? "Selected service"}
                  </p>
                  <p className="mt-1 text-xs text-violet-300">
                    {selectedDate ? formatDate(selectedDate) : ""} at{" "}
                    {selectedTime} · {selectedService?.duration ?? 0} min
                  </p>
                </div>
                <span className="ml-auto shrink-0 font-black">
                  {formatCurrency(selectedTotal)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                <span className="rounded-full bg-amber-500/15 px-2.5 py-1 font-bold text-amber-300">
                  Deposit {formatCurrency(requiredDeposit)}
                </span>
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-slate-300">
                  Balance{" "}
                  {formatCurrency(Math.max(0, selectedTotal - requiredDeposit))}
                </span>
              </div>
            </div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">
              Discount Code (optional)
            </label>
            <div className="flex gap-2">
              <input
                value={promotionCode}
                maxLength={MAX_PROMOTION_CODE_LENGTH}
                onChange={(event) => {
                  setPromotionCode(normalizePromotionCode(event.target.value));
                  setAppliedPromotion(null);
                }}
                placeholder="WELCOME10"
                className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-500"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                loading={isApplyingPromotion}
                disabled={!selectedService || !promotionCode.trim()}
                onClick={() => void applyPromotion()}
              >
                Apply
              </Button>
            </div>
            {appliedPromotion && (
              <p className="mt-1.5 text-xs text-emerald-400">
                {appliedPromotion.name} applied · You save{" "}
                {formatCurrency(appliedPromotion.discountAmount)}
              </p>
            )}
          </div>
          <section className="overflow-hidden rounded-xl border border-slate-700 bg-[#0c1b2e] light:border-slate-200 light:bg-white">
            <div className="flex items-center gap-2 border-b border-slate-700 px-4 py-3 light:border-slate-200">
              <Landmark className="h-5 w-5 text-violet-400" />
              <h3 className="font-black">
                {requiredDeposit > 0 ? "Deposit Method" : "Payment Method"}
              </h3>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              {appointmentPaymentOptions.map((option) => {
                const selected = paymentMethod === option.method;
                const available = option.available !== false;
                const Icon =
                  option.method === "bank_transfer"
                    ? Landmark
                    : option.method === "payment_at_appointment"
                      ? Store
                      : DollarSign;
                const title =
                  option.method === "bank_transfer"
                    ? requiredDeposit > 0
                      ? selectedPaymentOption === "full"
                        ? "Pay in full by bank transfer"
                        : "Deposit by bank transfer"
                      : "Bank transfer"
                    : option.method === "payment_at_appointment"
                      ? requiredDeposit > 0
                        ? selectedPaymentOption === "full"
                          ? "Pay in full in person"
                          : "Pay deposit in person"
                        : "Pay at appointment"
                      : PAYMENT_METHOD_LABELS[option.method];
                return (
                  <button
                    key={option.method}
                    type="button"
                    disabled={paymentConfigurationLoading}
                    onClick={() => {
                      setPaymentMethod(option.method);
                      setBookingError("");
                    }}
                    className={`flex min-h-20 items-center gap-2 rounded-xl border p-2.5 text-left transition ${!available ? "cursor-not-allowed border-slate-700 bg-[#091525] opacity-55" : selected ? "border-violet-400 bg-violet-600/20" : "border-slate-600 bg-[#091525] hover:border-violet-500 light:bg-slate-50"}`}
                  >
                    <span className="rounded-xl border border-violet-500/40 bg-violet-500/10 p-2 text-violet-300">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">{title}</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-400 light:text-slate-600">
                        {option.method === "bank_transfer"
                          ? "Transfer to the business and upload your receipt."
                          : option.instructions ||
                            "Arrange payment directly with the business."}
                      </span>
                    </span>
                    <span
                      className={`h-5 w-5 shrink-0 rounded-full border ${selected ? "border-violet-300 bg-violet-600 ring-2 ring-violet-500/30" : "border-slate-500"}`}
                    />
                  </button>
                );
              })}
            </div>
            <p className="px-4 pb-3 text-xs text-slate-400">
              {appointmentPaymentOptions.find(
                (option) => option.method === paymentMethod,
              )?.instructions ||
                (paymentMethod === "bank_transfer"
                  ? `Transfer ${formatCurrency(selectedPaymentOption === "full" ? selectedTotal : requiredDeposit || selectedTotal)} directly to the business, then upload your receipt in Track Booking for approval.`
                  : requiredDeposit > 0
                    ? selectedPaymentOption === "full"
                      ? "Arrange the full payment directly with the business. The owner must record it before confirming your booking."
                      : "Arrange the deposit directly with the business. The owner must record it before confirming your booking."
                    : "Pay the business directly at your appointment.")}
            </p>
            {paymentConfigurationLoading && (
              <p className="px-4 pb-3 text-xs text-violet-300">
                Loading business payment options…
              </p>
            )}
            {paymentConfigurationError && (
              <p className="mt-2 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-300">
                {paymentConfigurationError}
              </p>
            )}
          </section>
          <section className="overflow-hidden rounded-xl border border-slate-700 bg-[#0c1b2e] light:border-slate-200 light:bg-white lg:col-start-2">
            <div className="flex items-center gap-2 border-b border-slate-700 px-4 py-3 light:border-slate-200">
              <ClipboardList className="h-5 w-5 text-violet-400" />
              <h3 className="font-black">Booking Summary</h3>
            </div>
            <div className="space-y-3 p-4 text-sm">
              <div className="flex justify-between gap-4 border-b border-slate-700 pb-3 light:border-slate-200">
                <div>
                  <p className="font-bold">
                    {selectedService?.name ?? "Selected service"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {selectedDate ? formatDate(selectedDate) : ""} at{" "}
                    {selectedTime}
                  </p>
                </div>
                <span className="font-black">
                  {formatCurrency(selectedTotal)}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>
                  {selectedPaymentOption === "full"
                    ? "Payment due now"
                    : "Deposit due"}
                </span>
                <span className="font-bold text-amber-300">
                  {formatCurrency(
                    selectedPaymentOption === "full"
                      ? selectedTotal
                      : requiredDeposit,
                  )}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Remaining balance</span>
                <span className="font-bold text-white light:text-slate-950">
                  {formatCurrency(
                    selectedPaymentOption === "full"
                      ? 0
                      : Math.max(0, selectedTotal - requiredDeposit),
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-violet-600/25 px-4 py-3 text-lg font-black text-violet-200 light:text-violet-800">
                <span>Total</span>
                <span>{formatCurrency(selectedTotal)}</span>
              </div>
            </div>
          </section>
          {bookingError && (
            <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300 lg:col-span-2">
              {bookingError}
            </p>
          )}
          <p className="text-xs leading-5 text-slate-400 lg:col-span-2">
            By requesting this appointment, you ask {tenant.name} to process
            your contact and booking details. See the{" "}
            <Link
              href="/privacy"
              target="_blank"
              className="font-semibold text-violet-300 underline underline-offset-2"
            >
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link
              href="/terms"
              target="_blank"
              className="font-semibold text-violet-300 underline underline-offset-2"
            >
              Terms of Service
            </Link>
            . The business&apos;s cancellation and refund terms also apply.
          </p>
        </div>
      </Modal>
      <Modal
        open={!!depositCheckout}
        onClose={() => !isUploadingDeposit && setDepositCheckout(null)}
        title={`Upload ${selectedPaymentOption === "full" ? "full payment" : "deposit"} receipt`}
        maxWidth="max-w-2xl"
        contentClassName="p-4 sm:p-5"
        footer={
          <Button
            type="button"
            loading={isUploadingDeposit}
            disabled={!depositReceipt || !selectedDepositBankId}
            onClick={() => void uploadDepositReceipt()}
            className="min-h-12 w-full justify-center"
          >
            Submit{" "}
            {selectedPaymentOption === "full" ? "Full Payment" : "Deposit"}{" "}
            Receipt
          </Button>
        }
      >
        {depositCheckout && (
          <div className="grid gap-4 sm:grid-cols-2">
            <section className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-4 sm:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-violet-300">
                    Track Booking number
                  </p>
                  <p className="font-black">
                    {depositCheckout.appointmentNumber}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void navigator.clipboard.writeText(
                      depositCheckout.appointmentNumber,
                    )
                  }
                  className="flex items-center gap-2 rounded-lg border border-violet-400 px-3 py-2 text-sm font-bold text-violet-200"
                >
                  <Copy className="h-4 w-4" /> Copy
                </button>
                <div className="text-right">
                  <p className="text-xs text-slate-400">
                    {selectedPaymentOption === "full"
                      ? "Full payment due"
                      : "Deposit due"}
                  </p>
                  <p className="font-black text-amber-300">
                    {formatCurrency(depositCheckout.amount)}
                  </p>
                </div>
              </div>
            </section>
            <section className="rounded-xl border border-slate-700 bg-[#0c1b2e] p-4">
              <label className="mb-2 block text-sm font-bold">
                {selectedPaymentOption === "full" ? "Pay to" : "Deposit to"}
              </label>
              <select
                value={selectedDepositBankId}
                onChange={(event) =>
                  setSelectedDepositBankId(event.target.value)
                }
                className="w-full rounded-xl border border-violet-500/50 bg-[#091525] px-3 py-3 text-sm text-white outline-none"
              >
                {depositCheckout.bankAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.bankName} — {account.label}
                  </option>
                ))}
              </select>
              {depositCheckout.bankAccounts
                .filter((account) => account.id === selectedDepositBankId)
                .map((account) => (
                  <dl key={account.id} className="mt-3 space-y-2 text-sm">
                    <div>
                      <dt className="text-xs text-slate-400">Account name</dt>
                      <dd className="font-bold">{account.accountHolder}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-400">Account number</dt>
                      <dd className="font-bold">{account.accountNumber}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-400">
                        Reference / Memo
                      </dt>
                      <dd className="font-bold">
                        {depositCheckout.appointmentNumber}
                      </dd>
                    </div>
                  </dl>
                ))}
            </section>
            <section className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed border-violet-500/60 bg-[#0c1b2e] p-5 text-center">
              <UploadCloud className="mb-3 h-9 w-9 text-violet-400" />
              <p className="font-bold">Upload your transfer receipt</p>
              <p className="mt-1 text-xs text-slate-400">
                JPG, PNG, or PDF · maximum 5 MB
              </p>
              <label className="mt-4 cursor-pointer rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-500">
                Choose receipt
                <input
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  className="sr-only"
                  onChange={(event) => {
                    setDepositReceipt(event.target.files?.[0] ?? null);
                    setDepositUploadError("");
                  }}
                />
              </label>
              {depositReceipt && (
                <p className="mt-3 max-w-full truncate text-xs text-emerald-300">
                  {depositReceipt.name}
                </p>
              )}
            </section>
            {depositUploadError && (
              <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300 sm:col-span-2">
                {depositUploadError}
              </p>
            )}
            <p className="text-xs leading-5 text-slate-400 sm:col-span-2">
              Your booking remains pending until the business verifies this
              receipt and confirms the appointment. Keep the Track Booking
              number to view details, pay the remaining balance, or cancel.
            </p>
          </div>
        )}
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
