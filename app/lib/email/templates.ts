import "server-only";

export type TransactionalEmailEvent =
  | "WELCOME_ACCOUNT"
  | "BUSINESS_CREATED"
  | "TEAM_INVITATION"
  | "ORDER_RECEIVED"
  | "ORDER_ACCEPTED"
  | "ORDER_PREPARING"
  | "ORDER_READY"
  | "ORDER_OUT_FOR_DELIVERY"
  | "ORDER_COMPLETED"
  | "ORDER_CANCELLED"
  | "APPOINTMENT_CONFIRMED"
  | "APPOINTMENT_CANCELLED"
  | "APPOINTMENT_REMINDER"
  | "CONTACT_FORM_MESSAGE"
  | "TRIAL_EXPIRING"
  | "TRIAL_EXPIRED"
  | "SUBSCRIPTION_ACTIVATED"
  | "SUBSCRIPTION_UPDATED"
  | "SUBSCRIPTION_PAYMENT_ISSUE"
  | "BUSINESS_ALERT";

export interface TransactionalEmailInput {
  eventType: TransactionalEmailEvent;
  recipientName?: string | null;
  subject?: string | null;
  payload?: Record<string, unknown> | null;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const PURPLE = "#7c3aed";

function stringValue(payload: Record<string, unknown>, key: string, fallback = "") {
  const value = payload[key];
  if (typeof value === "string") return value.trim() || fallback;
  if (typeof value === "number") return String(value);
  return fallback;
}

function numberValue(payload: Record<string, unknown>, key: string) {
  const value = Number(payload[key]);
  return Number.isFinite(value) ? value : 0;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(value: number) {
  return new Intl.NumberFormat("en-BZ", {
    style: "currency",
    currency: "BZD",
    minimumFractionDigits: 2,
  }).format(value);
}

function dateTime(value: string, timezone = "America/Belize") {
  if (!value) return "the scheduled time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  try {
    return new Intl.DateTimeFormat("en-BZ", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: timezone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-BZ", { dateStyle: "full", timeStyle: "short" }).format(date);
  }
}

function paragraph(value: string) {
  return `<p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.7">${escapeHtml(value)}</p>`;
}

function detailRows(rows: Array<[string, string]>) {
  const visible = rows.filter(([, value]) => Boolean(value));
  if (!visible.length) return "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden">${visible
    .map(
      ([label, value], index) =>
        `<tr><td style="padding:12px 14px;${index ? "border-top:1px solid #e2e8f0;" : ""}color:#64748b;font-size:13px;width:42%">${escapeHtml(label)}</td><td style="padding:12px 14px;${index ? "border-top:1px solid #e2e8f0;" : ""}color:#0f172a;font-size:13px;font-weight:700;text-align:right">${escapeHtml(value)}</td></tr>`,
    )
    .join("")}</table>`;
}

function action(label: string, href: string) {
  if (!/^https?:\/\//i.test(href)) return "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td style="border-radius:12px;background:${PURPLE}"><a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 20px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:800">${escapeHtml(label)}</a></td></tr></table>`;
}

function shell(title: string, preview: string, content: string, businessName?: string) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>
<style>@media(max-width:600px){.yb-card{border-radius:0!important}.yb-wrap{padding:0!important}.yb-body{padding:26px 20px!important}.yb-title{font-size:25px!important}}</style></head>
<body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9"><tr><td class="yb-wrap" align="center" style="padding:32px 12px">
<table role="presentation" class="yb-card" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,.08)">
<tr><td style="padding:22px 26px;background:#080d1a;color:#fff"><table role="presentation" width="100%"><tr><td style="font-size:19px;font-weight:900"><span style="display:inline-block;margin-right:10px;padding:7px 10px;border-radius:10px;background:${PURPLE}">✦</span>YuhBusiness</td><td align="right" style="font-size:11px;color:#a78bfa;text-transform:uppercase;letter-spacing:1.5px">${escapeHtml(businessName || "Platform")}</td></tr></table></td></tr>
<tr><td class="yb-body" style="padding:34px 38px"><h1 class="yb-title" style="margin:0 0 18px;color:#0f172a;font-size:30px;line-height:1.2">${escapeHtml(title)}</h1>${content}</td></tr>
<tr><td style="padding:20px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:11px;line-height:1.6">This transactional message was sent by YuhBusiness for ${escapeHtml(businessName || "your account")}. Please do not share private account or booking details.</td></tr>
</table></td></tr></table></body></html>`;
}

function orderItems(payload: Record<string, unknown>) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) return "";
  const rows = items.slice(0, 30).map((candidate) => {
    const item = candidate && typeof candidate === "object" ? candidate as Record<string, unknown> : {};
    const name = stringValue(item, "name", "Item");
    const quantity = numberValue(item, "quantity") || 1;
    const subtotal = numberValue(item, "subtotal");
    return `<tr><td style="padding:10px 0;color:#334155;font-size:13px">${escapeHtml(name)} × ${quantity}</td><td align="right" style="padding:10px 0;color:#0f172a;font-size:13px;font-weight:700">${money(subtotal)}</td></tr>`;
  }).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;border-bottom:1px solid #e2e8f0">${rows}</table>`;
}

const ORDER_HEADLINES: Partial<Record<TransactionalEmailEvent, string>> = {
  ORDER_RECEIVED: "We received your order",
  ORDER_ACCEPTED: "Your order was accepted",
  ORDER_PREPARING: "Your order is being prepared",
  ORDER_READY: "Your order is ready",
  ORDER_OUT_FOR_DELIVERY: "Your order is on the way",
  ORDER_COMPLETED: "Your order is complete",
  ORDER_CANCELLED: "Your order was cancelled",
};

export function buildTransactionalEmail(input: TransactionalEmailInput): RenderedEmail {
  const payload = input.payload ?? {};
  const name = input.recipientName?.trim() || "there";
  const business = stringValue(payload, "business_name", "YuhBusiness");
  const appUrl = stringValue(payload, "app_url", process.env.NEXT_PUBLIC_APP_URL || "");
  let subject = input.subject?.trim() || "An update from YuhBusiness";
  let title = subject;
  let preview = subject;
  let content = "";

  if (input.eventType === "WELCOME_ACCOUNT") {
    subject = input.subject?.trim() || "Welcome to YuhBusiness";
    title = `Welcome, ${name}`;
    preview = "Your YuhBusiness account is ready.";
    content = paragraph("Your account is ready. You can now manage each of your businesses securely from one login.") +
      action("Open your dashboard", `${appUrl}/dashboard`);
  } else if (input.eventType === "BUSINESS_CREATED") {
    subject = input.subject?.trim() || `${business} is ready on YuhBusiness`;
    title = `${business} is ready`;
    preview = "Your new business workspace was created.";
    content = paragraph(`Your separate workspace for ${business} has been created. Its customers, orders, appointments, settings, analytics, storefront, and subscription remain isolated from your other businesses.`) +
      action("Manage this business", `${appUrl}/dashboard`);
  } else if (input.eventType === "TEAM_INVITATION") {
    subject = input.subject?.trim() || `You were invited to ${business}`;
    title = `Join ${business}`;
    preview = "A business owner invited you to their YuhBusiness team.";
    content = paragraph(`${stringValue(payload, "inviter_name", "The business owner")} invited you as ${stringValue(payload, "role", "staff")}. Sign in with this email address to accept the invitation.`) +
      action("Accept invitation", stringValue(payload, "invitation_url"));
  } else if (ORDER_HEADLINES[input.eventType]) {
    const orderNumber = stringValue(payload, "order_number", "your order");
    subject = input.subject?.trim() || `${ORDER_HEADLINES[input.eventType]} · ${orderNumber}`;
    title = ORDER_HEADLINES[input.eventType] || subject;
    preview = `${orderNumber} has a new status.`;
    content = paragraph(`Hi ${name}, here is the latest update from ${business}.`) + orderItems(payload) + detailRows([
      ["Order", orderNumber],
      ["Order type", stringValue(payload, "order_type").replaceAll("_", " ")],
      ["Total", money(numberValue(payload, "total"))],
      ["Status", input.eventType.replace("ORDER_", "").replaceAll("_", " ")],
      ["Reason", stringValue(payload, "cancellation_reason")],
    ]);
  } else if (input.eventType === "APPOINTMENT_CONFIRMED") {
    subject = input.subject?.trim() || `Your appointment with ${business} is confirmed`;
    title = "Appointment confirmed";
    preview = `Your appointment with ${business} is confirmed.`;
    content = paragraph(`Hi ${name}, ${business} confirmed your appointment.`) + detailRows([
      ["Service", stringValue(payload, "service_name", "Appointment")],
      ["When", dateTime(stringValue(payload, "starts_at"), stringValue(payload, "timezone", "America/Belize"))],
      ["Provider", stringValue(payload, "provider_name")],
      ["Confirmation", stringValue(payload, "confirmation_code")],
    ]);
  } else if (input.eventType === "APPOINTMENT_CANCELLED") {
    subject = input.subject?.trim() || `Appointment cancelled · ${business}`;
    title = "Appointment cancelled";
    preview = `Your appointment with ${business} was cancelled.`;
    content = paragraph(`Hi ${name}, your appointment with ${business} has been cancelled.`) + detailRows([
      ["Service", stringValue(payload, "service_name", "Appointment")],
      ["Scheduled for", dateTime(stringValue(payload, "starts_at"), stringValue(payload, "timezone", "America/Belize"))],
      ["Reason", stringValue(payload, "cancellation_reason")],
    ]);
  } else if (input.eventType === "APPOINTMENT_REMINDER") {
    subject = input.subject?.trim() || `Reminder: your appointment with ${business}`;
    title = "Appointment reminder";
    preview = `Your appointment with ${business} is coming up.`;
    content = paragraph(`Hi ${name}, this is a reminder about your upcoming appointment.`) + detailRows([
      ["Business", business],
      ["Service", stringValue(payload, "service_name", "Appointment")],
      ["When", dateTime(stringValue(payload, "starts_at"), stringValue(payload, "timezone", "America/Belize"))],
      ["Provider", stringValue(payload, "provider_name")],
      ["Phone", stringValue(payload, "business_phone")],
    ]);
  } else if (input.eventType === "CONTACT_FORM_MESSAGE") {
    subject = input.subject?.trim() || `New storefront message from ${name}`;
    title = "New storefront message";
    preview = `${name} sent a message through your storefront.`;
    content = detailRows([["From", name], ["Email", stringValue(payload, "sender_email")], ["Subject", stringValue(payload, "message_subject")]]) +
      `<div style="margin-top:18px;padding:18px;border-radius:14px;background:#f8fafc;color:#334155;font-size:14px;line-height:1.7;white-space:pre-wrap">${escapeHtml(stringValue(payload, "message"))}</div>`;
  } else if (input.eventType === "TRIAL_EXPIRING" || input.eventType === "TRIAL_EXPIRED") {
    const expired = input.eventType === "TRIAL_EXPIRED";
    subject = input.subject?.trim() || (expired ? `${business}'s trial has ended` : `${business}'s trial is ending soon`);
    title = expired ? "Your trial has ended" : "Your trial is ending soon";
    preview = subject;
    content = paragraph(expired
      ? `The free trial for ${business} has ended. Select a plan to restore business access.`
      : `The free trial for ${business} ends on ${dateTime(stringValue(payload, "trial_ends_at"), stringValue(payload, "timezone", "America/Belize"))}. Select a plan to keep the business active.`) +
      action("View plans", `${appUrl}/#pricing`);
  } else if (input.eventType.startsWith("SUBSCRIPTION_")) {
    const plan = stringValue(payload, "plan", "Beginner");
    const status = stringValue(payload, "subscription_status", "updated").replaceAll("_", " ");
    subject = input.subject?.trim() || `${business} subscription ${status}`;
    title = input.eventType === "SUBSCRIPTION_PAYMENT_ISSUE" ? "Payment attention required" : "Subscription updated";
    preview = subject;
    content = paragraph(input.eventType === "SUBSCRIPTION_PAYMENT_ISSUE"
      ? `Access for ${business} may be limited until its payment is confirmed.`
      : `The subscription for ${business} has been updated successfully.`) + detailRows([
        ["Business", business], ["Plan", plan], ["Status", status],
      ]) + action("Review subscription", `${appUrl}/dashboard/settings`);
  } else {
    subject = input.subject?.trim() || stringValue(payload, "title", "Important business alert");
    title = stringValue(payload, "title", "Important business alert");
    preview = stringValue(payload, "message", subject);
    content = paragraph(stringValue(payload, "message", "There is important activity requiring your attention.")) +
      action("Open YuhBusiness", `${appUrl}${stringValue(payload, "href", "/dashboard")}`);
  }

  const html = shell(title, preview, content, business);
  const text = [title, preview, business, stringValue(payload, "message"), appUrl].filter(Boolean).join("\n\n");
  return { subject, html, text };
}
