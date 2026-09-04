import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.109.0";

type DeliveryStatus = "PENDING" | "PROCESSING" | "SENT" | "FAILED";

interface OrderEmailPayload {
  business_name: string;
  business_email?: string | null;
  business_phone?: string | null;
  order_number: string;
  order_type?: string | null;
  requested_time?: string | null;
  delivery_address?: string | null;
  delivery_area?: string | null;
  table_number?: string | null;
  subtotal?: number | null;
  tax_amount?: number | null;
  discount_amount?: number | null;
  delivery_fee?: number | null;
  total: number;
  cancellation_reason?: string | null;
  items?: {
    name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }[];
}

interface DeliveryRow {
  id: string;
  order_id: string;
  event_type: string;
  recipient_email: string;
  recipient_name: string;
  subject: string;
  payload: OrderEmailPayload;
  status: DeliveryStatus;
  attempt_count: number;
}

interface WebhookBody {
  type?: string;
  table?: string;
  schema?: string;
  record?: { id?: string };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function getSupabaseSecretKey() {
  const legacyKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (legacyKey) return legacyKey;
  const encodedKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!encodedKeys) throw new Error("A Supabase secret key is not available.");
  const keys = JSON.parse(encodedKeys) as Record<string, string>;
  const key = keys.default ?? Object.values(keys)[0];
  if (!key) throw new Error("A Supabase secret key is not available.");
  return key;
}

function safeEqual(actual: string, expected: string) {
  if (actual.length !== expected.length) return false;
  let result = 0;
  for (let index = 0; index < actual.length; index += 1) {
    result |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return result === 0;
}

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const money = (value: number | null | undefined) =>
  new Intl.NumberFormat("en-BZ", { style: "currency", currency: "BZD" }).format(
    Number(value ?? 0),
  );

const EVENT_COPY: Record<string, { heading: string; message: string }> = {
  ORDER_RECEIVED: {
    heading: "Order received",
    message: "We received your order and will review it shortly.",
  },
  ORDER_ACCEPTED: {
    heading: "Order accepted",
    message: "Your order has been accepted.",
  },
  ORDER_PREPARING: {
    heading: "Being prepared",
    message: "Your order is now being prepared.",
  },
  ORDER_READY: { heading: "Order ready", message: "Your order is ready." },
  ORDER_OUT_FOR_DELIVERY: {
    heading: "Out for delivery",
    message: "Your order is on its way.",
  },
  ORDER_COMPLETED: {
    heading: "Order complete",
    message: "Your order has been completed. Thank you!",
  },
  ORDER_CANCELLED: {
    heading: "Order cancelled",
    message: "This order was cancelled.",
  },
};

function buildEmail(delivery: DeliveryRow) {
  const payload = delivery.payload;
  const copy = EVENT_COPY[delivery.event_type] ?? EVENT_COPY.ORDER_RECEIVED;
  const items = (payload.items ?? [])
    .map(
      (item) =>
        `<tr><td style="padding:8px 0;color:#334155">${escapeHtml(item.name)} × ${item.quantity}</td><td style="padding:8px 0;text-align:right;font-weight:600">${escapeHtml(money(item.subtotal))}</td></tr>`,
    )
    .join("");
  const fulfillment = [
    payload.order_type ? payload.order_type.replaceAll("_", " ") : "",
    payload.table_number ? `Table ${payload.table_number}` : "",
    payload.delivery_area,
    payload.delivery_address,
    payload.requested_time
      ? new Date(payload.requested_time).toLocaleString("en-BZ", {
          timeZone: "America/Belize",
        })
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const cancellation =
    delivery.event_type === "ORDER_CANCELLED" && payload.cancellation_reason
      ? `<p style="padding:12px;background:#fef2f2;color:#991b1b;border-radius:8px"><strong>Reason:</strong> ${escapeHtml(payload.cancellation_reason)}</p>`
      : "";

  const html = `<!doctype html><html lang="en"><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a"><div style="max-width:600px;margin:0 auto;padding:32px 16px"><div style="overflow:hidden;border:1px solid #e2e8f0;border-radius:16px;background:#fff"><div style="background:#6d28d9;padding:28px 32px;color:#fff"><div style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">${escapeHtml(copy.heading)}</div><h1 style="margin:8px 0 0;font-size:25px">${escapeHtml(payload.order_number)} · ${escapeHtml(payload.business_name)}</h1></div><div style="padding:30px 32px"><p style="font-size:16px;line-height:1.6">Hi ${escapeHtml(delivery.recipient_name)}, ${escapeHtml(copy.message)}</p>${fulfillment ? `<p style="color:#475569">${escapeHtml(fulfillment)}</p>` : ""}<table role="presentation" style="width:100%;border-collapse:collapse;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0">${items}</table>${cancellation}<p style="text-align:right;font-size:19px;font-weight:700">Total: ${escapeHtml(money(payload.total))}</p></div></div><p style="text-align:center;color:#94a3b8;font-size:12px">Sent by YuhBusiness on behalf of ${escapeHtml(payload.business_name)}.</p></div></body></html>`;
  const text = [
    `Hi ${delivery.recipient_name},`,
    copy.message,
    `Order: ${payload.order_number}`,
    fulfillment ? `Fulfillment: ${fulfillment}` : "",
    ...(payload.items ?? []).map(
      (item) => `${item.quantity} × ${item.name}: ${money(item.subtotal)}`,
    ),
    `Total: ${money(payload.total)}`,
    payload.cancellation_reason ? `Reason: ${payload.cancellation_reason}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return { html, text };
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST")
      return json({ error: "Method not allowed." }, 405);
    try {
      const providedSecret = request.headers.get("x-webhook-secret") ?? "";
      if (
        !safeEqual(providedSecret, requiredEnv("NOTIFICATION_WEBHOOK_SECRET"))
      ) {
        return json({ error: "Unauthorized." }, 401);
      }
      const body = (await request.json()) as WebhookBody;
      if (
        body.type !== "INSERT" ||
        body.schema !== "public" ||
        body.table !== "order_email_deliveries" ||
        !body.record?.id
      ) {
        return json({ error: "Unsupported webhook payload." }, 400);
      }

      const supabase = createClient(
        requiredEnv("SUPABASE_URL"),
        getSupabaseSecretKey(),
        {
          auth: { persistSession: false, autoRefreshToken: false },
        },
      );
      const columns =
        "id, order_id, event_type, recipient_email, recipient_name, subject, payload, status, attempt_count";
      const { data: currentData, error: readError } = await supabase
        .from("order_email_deliveries")
        .select(columns)
        .eq("id", body.record.id)
        .single();
      const current = currentData as DeliveryRow | null;
      if (readError || !current)
        throw readError ?? new Error("Email delivery was not found.");
      if (current.status === "SENT")
        return json({ delivered: true, duplicate: true });

      const { data: claimedData, error: claimError } = await supabase
        .from("order_email_deliveries")
        .update({
          status: "PROCESSING",
          attempt_count: current.attempt_count + 1,
          processing_started_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", current.id)
        .in("status", ["PENDING", "FAILED"])
        .select(columns)
        .maybeSingle();
      const delivery = claimedData as DeliveryRow | null;
      if (claimError) throw claimError;
      if (!delivery) return json({ delivered: false, duplicate: true }, 202);

      const email = buildEmail(delivery);
      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${requiredEnv("RESEND_API_KEY")}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `order/${delivery.order_id}/${delivery.event_type}`,
        },
        body: JSON.stringify({
          from: requiredEnv("RESEND_FROM_EMAIL"),
          to: [delivery.recipient_email],
          subject: delivery.subject,
          html: email.html,
          text: email.text,
          reply_to: delivery.payload.business_email || undefined,
        }),
      });
      const result = (await resendResponse.json()) as {
        id?: string;
        message?: string;
      };
      if (!resendResponse.ok || !result.id) {
        const providerError =
          result.message || `Resend returned ${resendResponse.status}.`;
        await supabase
          .from("order_email_deliveries")
          .update({
            status: "FAILED",
            last_error: providerError.slice(0, 1000),
          })
          .eq("id", delivery.id);
        return json({ error: providerError }, 502);
      }
      const { error: sentError } = await supabase
        .from("order_email_deliveries")
        .update({
          status: "SENT",
          provider_message_id: result.id,
          sent_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", delivery.id);
      if (sentError) throw sentError;
      return json({ delivered: true, id: result.id });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to send order email.";
      console.error(message);
      return json({ error: message }, 500);
    }
  },
};
