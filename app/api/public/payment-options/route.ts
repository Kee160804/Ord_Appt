import { getSupabaseAdminClient } from "@/app/lib/supabase/admin";
import {
  DEFAULT_FULFILLMENT_CONFIGURATION,
  DIRECT_PAYMENT_NOTICE,
  type BusinessModule,
} from "@/app/lib/business-payments";
import { isValidUuid } from "@/app/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tenantId = url.searchParams.get("tenantId")?.trim() ?? "";
  const businessModule = url.searchParams.get(
    "module",
  ) as BusinessModule | null;
  if (
    !isValidUuid(tenantId) ||
    !businessModule ||
    !["appointment", "ordering", "retail"].includes(businessModule)
  ) {
    return Response.json(
      { error: "Invalid payment options request." },
      { status: 400 },
    );
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id,is_active,status")
      .eq("id", tenantId)
      .maybeSingle();
    if (
      !tenant ||
      !tenant.is_active ||
      tenant.status?.toUpperCase() !== "ACTIVE"
    ) {
      return Response.json(
        { error: "Storefront was not found." },
        { status: 404 },
      );
    }

    const [methods, fulfillment, activeBankAccount] = await Promise.all([
      supabase
        .from("business_payment_methods")
        .select("method,instructions,external_url,modules")
        .eq("tenant_id", tenantId)
        .eq("enabled", true)
        .contains("modules", [businessModule]),
      supabase
        .from("business_fulfillment_settings")
        .select(
          "pickup_enabled,local_delivery_enabled,nationwide_delivery_enabled,manual_delivery_quote,pickup_location,pickup_instructions,delivery_notes,preparation_minutes,whatsapp_number,retail_reservations_enabled,email_verification_minutes,payment_window_minutes",
        )
        .eq("tenant_id", tenantId)
        .maybeSingle(),
      businessModule === "appointment"
        ? supabase.rpc("has_active_business_bank_account", {
            p_tenant_id: tenantId,
          })
        : Promise.resolve({ data: null, error: null }),
    ]);
    const missingBankAvailabilityFunction =
      activeBankAccount.error?.code === "PGRST202";
    if (
      methods.error ||
      fulfillment.error ||
      (activeBankAccount.error && !missingBankAvailabilityFunction)
    ) {
      throw methods.error ?? fulfillment.error ?? activeBankAccount.error;
    }
    const f = fulfillment.data;
    const configuredMethods = methods.data ?? [];
    // Compatibility for appointment businesses configured before appointment
    // payment modules existed. With no explicit appointment method choices,
    // an active bank account makes bank transfer available alongside the safe
    // in-person fallback. Once the owner saves appointment payment settings,
    // those explicit choices remain authoritative.
    const availableMethods =
      businessModule === "appointment" && configuredMethods.length === 0
        ? [
            ...(activeBankAccount.data === true
              ? [
                  {
                    method: "bank_transfer",
                    instructions:
                      "Transfer the required deposit to the business and upload your receipt in Track Booking.",
                    external_url: null,
                    modules: ["appointment"],
                  },
                ]
              : []),
            {
              method: "payment_at_appointment",
              instructions:
                "Arrange the deposit or payment directly with the business.",
              external_url: null,
              modules: ["appointment"],
            },
          ]
        : configuredMethods;
    return Response.json(
      {
        methods: availableMethods.map((row) => ({
          method: row.method,
          enabled: true,
          modules: row.modules,
          instructions: row.instructions ?? "",
          externalUrl: row.external_url ?? undefined,
        })),
        // Account details are disclosed only after Track Order email
        // verification. Checkout needs the available method, not credentials.
        bankAccounts: [],
        bankTransferAvailable:
          !missingBankAvailabilityFunction && activeBankAccount.data === true,
        fulfillment: f
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
          : DEFAULT_FULFILLMENT_CONFIGURATION,
        notice: DIRECT_PAYMENT_NOTICE,
      },
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  } catch (error) {
    console.error("[payment-options] Unable to load options.", error);
    return Response.json(
      { error: "Payment options are temporarily unavailable." },
      { status: 503 },
    );
  }
}
