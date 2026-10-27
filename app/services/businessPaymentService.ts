import { requireSupabaseBrowserClient as client } from "@/app/lib/supabase/client";
import {
  DEFAULT_FULFILLMENT_CONFIGURATION,
  type BankAccountConfiguration,
  type BusinessPaymentMethod,
  type FulfillmentConfiguration,
  type PaymentMethodConfiguration,
} from "@/app/lib/business-payments";

const METHODS: BusinessPaymentMethod[] = [
  "bank_transfer",
  "cash_on_delivery",
  "payment_on_pickup",
  "payment_at_appointment",
  "external_link",
];

export async function loadBusinessPaymentSettings(tenantId: string) {
  const supabase = client();
  const [methodsResult, accountsResult, fulfillmentResult] = await Promise.all([
    supabase
      .from("business_payment_methods")
      .select("id,method,enabled,modules,instructions,external_url")
      .eq("tenant_id", tenantId),
    supabase
      .from("business_bank_accounts")
      .select(
        "id,label,bank_name,account_holder,account_number,account_type,currency,instructions,is_active,sort_order",
      )
      .eq("tenant_id", tenantId)
      .order("sort_order"),
    supabase
      .from("business_fulfillment_settings")
      .select(
        "pickup_enabled,local_delivery_enabled,nationwide_delivery_enabled,manual_delivery_quote,pickup_location,pickup_instructions,delivery_notes,preparation_minutes,whatsapp_number,retail_reservations_enabled,email_verification_minutes,payment_window_minutes",
      )
      .eq("tenant_id", tenantId)
      .maybeSingle(),
  ]);

  const settingsError =
    methodsResult.error ?? accountsResult.error ?? fulfillmentResult.error;
  if (settingsError) {
    if (
      settingsError.code === "42P01" ||
      settingsError.code === "PGRST205" ||
      /business_payment_methods|business_bank_accounts|business_fulfillment_settings/i.test(
        settingsError.message,
      )
    ) {
      throw new Error(
        "Payment & Fulfillment setup is pending the required Supabase migration. Existing dashboard features remain available.",
      );
    }
    throw settingsError;
  }

  const storedMethods = new Map(
    (methodsResult.data ?? []).map((row) => [row.method, row]),
  );
  const methods: PaymentMethodConfiguration[] = METHODS.map((method) => {
    const row = storedMethods.get(method);
    return {
      id: row?.id,
      method,
      enabled: row?.enabled === true,
      modules: (row?.modules ?? []) as PaymentMethodConfiguration["modules"],
      instructions: row?.instructions ?? "",
      externalUrl: row?.external_url ?? undefined,
    };
  });
  const bankAccounts: BankAccountConfiguration[] = (
    accountsResult.data ?? []
  ).map((row) => ({
    id: row.id,
    label: row.label,
    bankName: row.bank_name,
    accountHolder: row.account_holder,
    accountNumber: row.account_number,
    accountType: row.account_type ?? "",
    currency: row.currency,
    instructions: row.instructions ?? "",
    isActive: row.is_active,
    sortOrder: row.sort_order,
  }));
  const f = fulfillmentResult.data;
  const fulfillment: FulfillmentConfiguration = f
    ? {
        pickupEnabled: f.pickup_enabled,
        localDeliveryEnabled: f.local_delivery_enabled,
        nationwideDeliveryEnabled: f.nationwide_delivery_enabled,
        manualDeliveryQuote: f.manual_delivery_quote,
        pickupLocation: f.pickup_location ?? "",
        pickupInstructions: f.pickup_instructions ?? "",
        deliveryNotes: f.delivery_notes ?? "",
        preparationMinutes: f.preparation_minutes,
        whatsappNumber: f.whatsapp_number ?? "",
        retailReservationsEnabled: f.retail_reservations_enabled,
        emailVerificationMinutes: f.email_verification_minutes,
        paymentWindowMinutes: f.payment_window_minutes,
      }
    : DEFAULT_FULFILLMENT_CONFIGURATION;

  return { methods, bankAccounts, fulfillment };
}

export async function saveBusinessPaymentSettings(
  tenantId: string,
  methods: PaymentMethodConfiguration[],
  bankAccounts: BankAccountConfiguration[],
  fulfillment: FulfillmentConfiguration,
) {
  const supabase = client();
  const external = methods.find((method) => method.method === "external_link");
  if (external?.enabled && !external.externalUrl?.trim()) {
    throw new Error("Enter the business's HTTPS payment link.");
  }
  if (external?.enabled && external.externalUrl) {
    const parsed = new URL(external.externalUrl);
    if (parsed.protocol !== "https:")
      throw new Error("External payment links must use HTTPS.");
  }
  if (methods.some((method) => method.enabled && method.modules.length === 0)) {
    throw new Error(
      "Choose at least one module for every enabled payment method.",
    );
  }
  if (
    methods.some(
      (method) => method.method === "bank_transfer" && method.enabled,
    ) &&
    !bankAccounts.some((account) => account.isActive)
  ) {
    throw new Error(
      "Add an active bank account before enabling bank transfers.",
    );
  }
  if (
    !Number.isInteger(fulfillment.emailVerificationMinutes) ||
    fulfillment.emailVerificationMinutes < 2 ||
    fulfillment.emailVerificationMinutes > 30
  ) {
    throw new Error(
      "Email verification time must be between 2 and 30 minutes.",
    );
  }
  if (
    !Number.isInteger(fulfillment.paymentWindowMinutes) ||
    fulfillment.paymentWindowMinutes < 5 ||
    fulfillment.paymentWindowMinutes > 1440
  ) {
    throw new Error("Payment time must be between 5 minutes and 24 hours.");
  }

  const { error: methodError } = await supabase
    .from("business_payment_methods")
    .upsert(
      methods.map((method) => ({
        tenant_id: tenantId,
        method: method.method,
        enabled: method.enabled,
        modules: method.modules,
        instructions: method.instructions.trim() || null,
        external_url: method.externalUrl?.trim() || null,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "tenant_id,method" },
    );
  if (methodError) throw methodError;

  const existing = await supabase
    .from("business_bank_accounts")
    .select("id")
    .eq("tenant_id", tenantId);
  if (existing.error) throw existing.error;
  const retainedIds = new Set(
    bankAccounts.flatMap((account) => (account.id ? [account.id] : [])),
  );
  const removedIds = (existing.data ?? [])
    .map((row) => row.id)
    .filter((id) => !retainedIds.has(id));
  if (removedIds.length) {
    const removed = await supabase
      .from("business_bank_accounts")
      .delete()
      .eq("tenant_id", tenantId)
      .in("id", removedIds);
    if (removed.error) throw removed.error;
  }
  for (const account of bankAccounts) {
    const values = {
      tenant_id: tenantId,
      label: account.label.trim() || "Bank account",
      bank_name: account.bankName.trim(),
      account_holder: account.accountHolder.trim(),
      account_number: account.accountNumber.trim(),
      account_type: account.accountType.trim() || null,
      currency: account.currency.trim().toUpperCase(),
      instructions: account.instructions.trim() || null,
      is_active: account.isActive,
      sort_order: account.sortOrder,
      updated_at: new Date().toISOString(),
    };
    if (!values.bank_name || !values.account_holder || !values.account_number) {
      throw new Error(
        "Complete the bank name, account holder, and account number.",
      );
    }
    const result = account.id
      ? await supabase
          .from("business_bank_accounts")
          .update(values)
          .eq("id", account.id)
          .eq("tenant_id", tenantId)
      : await supabase.from("business_bank_accounts").insert(values);
    if (result.error) throw result.error;
  }

  const { error: fulfillmentError } = await supabase
    .from("business_fulfillment_settings")
    .upsert(
      {
        tenant_id: tenantId,
        pickup_enabled: fulfillment.pickupEnabled,
        local_delivery_enabled: fulfillment.localDeliveryEnabled,
        nationwide_delivery_enabled: fulfillment.nationwideDeliveryEnabled,
        manual_delivery_quote: fulfillment.manualDeliveryQuote,
        pickup_location: fulfillment.pickupLocation.trim() || null,
        pickup_instructions: fulfillment.pickupInstructions.trim() || null,
        delivery_notes: fulfillment.deliveryNotes.trim() || null,
        preparation_minutes: fulfillment.preparationMinutes,
        whatsapp_number: fulfillment.whatsappNumber.trim() || null,
        retail_reservations_enabled: fulfillment.retailReservationsEnabled,
        email_verification_minutes: fulfillment.emailVerificationMinutes,
        payment_window_minutes: fulfillment.paymentWindowMinutes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id" },
    );
  if (fulfillmentError) throw fulfillmentError;
}
