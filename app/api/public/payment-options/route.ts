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

    const [methods, fulfillment] = await Promise.all([
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
    ]);
    if (methods.error || fulfillment.error) {
      throw methods.error ?? fulfillment.error;
    }
    const f = fulfillment.data;
    return Response.json(
      {
        methods: (methods.data ?? []).map((row) => ({
          method: row.method,
          enabled: true,
          modules: row.modules,
          instructions: row.instructions ?? "",
          externalUrl: row.external_url ?? undefined,
        })),
        // Account details are disclosed only after Track Order email
        // verification. Checkout needs the available method, not credentials.
        bankAccounts: [],
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
