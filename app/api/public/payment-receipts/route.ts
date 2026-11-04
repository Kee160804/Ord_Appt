import { getSupabaseAdminClient } from "@/app/lib/supabase/admin";
import { hashGuestAccessToken } from "@/app/lib/server/guest-access";
import { getVerifiedTrackingSession } from "@/app/lib/server/order-tracking";
import {
  enforcePublicRateLimit,
  isValidEmail,
  isValidUuid,
  rateLimitResponse,
  readFormDataBody,
  requestHasAllowedOrigin,
} from "@/app/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["application/pdf", "pdf"],
]);

function textValue(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  if (!requestHasAllowedOrigin(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }
  try {
    const form = await readFormDataBody(request);
    const tenantId = textValue(form, "tenantId");
    const targetType = textValue(form, "targetType");
    const targetId = textValue(form, "targetId");
    const accessToken = textValue(form, "accessToken");
    const customerEmail = textValue(form, "customerEmail").toLowerCase();
    const amount = Number(textValue(form, "amount"));
    const paymentDate = textValue(form, "paymentDate");
    const transactionReference = textValue(form, "transactionReference").slice(
      0,
      160,
    );
    const bankAccountId = textValue(form, "bankAccountId");
    const notes = textValue(form, "notes").slice(0, 2000);
    const file = form.get("receipt");

    if (
      !isValidUuid(tenantId) ||
      !isValidUuid(targetId) ||
      !["order", "appointment"].includes(targetType)
    ) {
      return Response.json(
        { error: "Invalid payment receipt request." },
        { status: 400 },
      );
    }
    if (!accessToken || !isValidEmail(customerEmail)) {
      return Response.json(
        { error: "The secure tracking link is invalid." },
        { status: 403 },
      );
    }
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)
    ) {
      return Response.json(
        { error: "Enter a valid payment amount and date." },
        { status: 400 },
      );
    }
    if (
      !(file instanceof File) ||
      !ALLOWED_TYPES.has(file.type) ||
      file.size <= 0 ||
      file.size > MAX_FILE_BYTES
    ) {
      return Response.json(
        { error: "Upload a JPG, PNG, or PDF receipt no larger than 5 MB." },
        { status: 400 },
      );
    }

    const rate = await enforcePublicRateLimit(
      request,
      "payment-receipt",
      tenantId,
      customerEmail,
      5,
      900,
    );
    if (!rate.allowed) return rateLimitResponse(rate.retryAfter);

    const supabase = getSupabaseAdminClient();
    const table = targetType === "order" ? "orders" : "appointments";
    let reservation: {
      customer_verification_status: string;
      inventory_reservation_status: string;
      inventory_reservation_expires_at: string | null;
    } | null = null;
    if (targetType === "order") {
      const expiration = await supabase.rpc(
        "expire_retail_purchase_reservations",
        {
          p_tenant_id: tenantId,
        },
      );
      if (expiration.error) throw expiration.error;
      const reservationResult = await supabase
        .from("orders")
        .select(
          "customer_verification_status,inventory_reservation_status,inventory_reservation_expires_at",
        )
        .eq("id", targetId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (reservationResult.error) throw reservationResult.error;
      reservation = reservationResult.data;
    }
    const targetQuery =
      targetType === "order"
        ? supabase
            .from("orders")
            .select(
              "id,tenant_id,customer_name,customer_email,total,payment_method,tracking_token_hash,tracking_token_expires_at,payment_status,status",
            )
        : supabase
            .from("appointments")
            .select(
              "id,tenant_id,customer_name,customer_email,total,deposit_required,outstanding_balance,payment_method,tracking_token_hash,tracking_token_expires_at,payment_status",
            );
    const { data: target, error: targetError } = await targetQuery
      .eq("id", targetId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    const trackingSession = await getVerifiedTrackingSession(
      tenantId,
      accessToken,
    );
    const verifiedTrackingAccess =
      (targetType === "order"
        ? trackingSession?.order_id === targetId
        : trackingSession?.appointment_id === targetId) &&
      trackingSession?.customer_email === customerEmail;
    const checkoutAccess =
      target?.tracking_token_hash === hashGuestAccessToken(accessToken) &&
      !!target?.tracking_token_expires_at &&
      new Date(target.tracking_token_expires_at).getTime() > Date.now();
    if (
      targetError ||
      !target ||
      (!checkoutAccess && !verifiedTrackingAccess) ||
      target.customer_email?.toLowerCase() !== customerEmail
    ) {
      return Response.json(
        { error: "The secure tracking link is invalid or expired." },
        { status: 403 },
      );
    }
    // Older checkout orders stored pay_later (or no method). A verified
    // customer may use the business's currently enabled bank-transfer option.
    let legacyBankTransfer = false;
    if (
      verifiedTrackingAccess &&
      (!target.payment_method || target.payment_method === "pay_later")
    ) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("business_type,is_active,status")
        .eq("id", tenantId)
        .maybeSingle();
      const { data: method } = await supabase
        .from("business_payment_methods")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("method", "bank_transfer")
        .eq("enabled", true)
        .contains("modules", [
          targetType === "appointment"
            ? "appointment"
            : tenant?.business_type === "retail"
              ? "retail"
              : "ordering",
        ])
        .maybeSingle();
      legacyBankTransfer =
        !!method && tenant?.is_active === true && tenant?.status === "ACTIVE";
    }
    if (target.payment_method !== "bank_transfer" && !legacyBankTransfer) {
      return Response.json(
        { error: "Receipt upload is only available for bank transfers." },
        { status: 409 },
      );
    }
    let selectedBankNote = "";
    if (target.payment_method === "bank_transfer" || legacyBankTransfer) {
      if (!isValidUuid(bankAccountId)) {
        return Response.json(
          { error: "Choose the bank account used for this transfer." },
          { status: 400 },
        );
      }
      const { data: bankAccount, error: bankAccountError } = await supabase
        .from("business_bank_accounts")
        .select("label,bank_name")
        .eq("id", bankAccountId)
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .maybeSingle();
      if (bankAccountError) throw bankAccountError;
      if (!bankAccount) {
        return Response.json(
          {
            error:
              "That bank account is no longer available. Refresh and choose another account.",
          },
          { status: 409 },
        );
      }
      selectedBankNote = `Customer selected destination bank: ${bankAccount.bank_name}${bankAccount.label && bankAccount.label !== bankAccount.bank_name ? ` (${bankAccount.label})` : ""}.`;
    }
    const submissionNotes = [selectedBankNote, notes]
      .filter(Boolean)
      .join("\n")
      .slice(0, 2000);
    if (
      reservation?.customer_verification_status === "PENDING" &&
      !verifiedTrackingAccess
    ) {
      return Response.json(
        { error: "Verify the email code before uploading a receipt." },
        { status: 403 },
      );
    }
    if (
      reservation &&
      (["EXPIRED", "CANCELLED"].includes(
        reservation.inventory_reservation_status,
      ) ||
        (reservation.inventory_reservation_expires_at &&
          Date.parse(reservation.inventory_reservation_expires_at) <=
            Date.now()))
    ) {
      return Response.json(
        {
          error:
            "This purchase reservation expired and its inventory was released.",
        },
        { status: 409 },
      );
    }
    if (
      (targetType === "order" &&
        "status" in target &&
        ["CANCELLED", "CANCELED"].includes(
          String(target.status).toUpperCase(),
        )) ||
      ["PAID", "REFUNDED", "CANCELED", "CANCELLED"].includes(
        String(target.payment_status).toUpperCase(),
      )
    ) {
      return Response.json(
        { error: "This transaction no longer accepts payment receipts." },
        { status: 409 },
      );
    }
    const foreignKey = targetType === "order" ? "order_id" : "appointment_id";
    const { data: openSubmission } = await supabase
      .from("customer_payment_submissions")
      .select("id")
      .eq(foreignKey, targetId)
      .in(
        "status",
        targetType === "appointment"
          ? ["AWAITING_VERIFICATION"]
          : ["AWAITING_VERIFICATION", "VERIFIED"],
      )
      .limit(1)
      .maybeSingle();
    if (openSubmission) {
      return Response.json(
        { error: "A receipt is already awaiting review for this transaction." },
        { status: 409 },
      );
    }

    const extension = ALLOWED_TYPES.get(file.type)!;
    const receiptId = crypto.randomUUID();
    const receiptPath = `${tenantId}/${targetType}/${targetId}/${receiptId}.${extension}`;
    const upload = await supabase.storage
      .from("payment-receipts")
      .upload(receiptPath, file, {
        contentType: file.type,
        upsert: false,
      });
    if (upload.error) throw upload.error;

    const expectedAmount =
      targetType === "appointment"
        ? Number(
            ("outstanding_balance" in target && target.outstanding_balance) ||
              ("deposit_required" in target && target.deposit_required) ||
              target.total ||
              0,
          )
        : Number(target.total ?? 0);
    const insert = verifiedTrackingAccess
      ? targetType === "order"
        ? await supabase.rpc("submit_tracked_order_receipt", {
            p_tenant_id: tenantId,
            p_order_id: targetId,
            p_token_hash: hashGuestAccessToken(accessToken),
            p_submission_id: receiptId,
            p_amount: amount,
            p_payment_date: paymentDate,
            p_receipt_path: receiptPath,
            p_mime_type: file.type,
            p_reference: transactionReference,
            p_notes: submissionNotes,
          })
        : await supabase.rpc("submit_tracked_appointment_receipt", {
            p_tenant_id: tenantId,
            p_appointment_id: targetId,
            p_token_hash: hashGuestAccessToken(accessToken),
            p_submission_id: receiptId,
            p_amount: amount,
            p_payment_date: paymentDate,
            p_receipt_path: receiptPath,
            p_mime_type: file.type,
            p_reference: transactionReference,
            p_notes: submissionNotes,
          })
      : await supabase
          .from("customer_payment_submissions")
          .insert({
            id: receiptId,
            tenant_id: tenantId,
            [foreignKey]: targetId,
            customer_name: target.customer_name || "Customer",
            customer_email: customerEmail,
            expected_amount: expectedAmount,
            submitted_amount: amount,
            payment_date: paymentDate,
            transaction_reference: transactionReference || null,
            receipt_path: receiptPath,
            receipt_mime_type: file.type,
            notes: submissionNotes || null,
          })
          .select("id")
          .single();
    if (insert.error) {
      await supabase.storage.from("payment-receipts").remove([receiptPath]);
      throw insert.error;
    }
    if (!verifiedTrackingAccess) {
      await supabase.from("payment_verification_events").insert({
        tenant_id: tenantId,
        submission_id: receiptId,
        actor_id: null,
        action: "SUBMITTED",
        comment: "Receipt submitted by customer.",
      });
      await supabase
        .from(table)
        .update({
          payment_status: "AWAITING_VERIFICATION",
          ...(legacyBankTransfer ? { payment_method: "bank_transfer" } : {}),
        })
        .eq("id", targetId)
        .eq("tenant_id", tenantId);
      if (targetType === "order" && reservation) {
        await supabase
          .from("orders")
          .update({
            inventory_reservation_status: "RECEIPT_AWAITING_VERIFICATION",
            inventory_reservation_expires_at: null,
          })
          .eq("id", targetId)
          .eq("tenant_id", tenantId);
      }
    }

    const { data: memberships } = await supabase
      .from("tenant_memberships")
      .select("profile_id")
      .eq("tenant_id", tenantId)
      .eq("is_active", true);
    if (memberships?.length) {
      await supabase.from("business_notifications").insert(
        memberships.map((membership) => ({
          tenant_id: tenantId,
          recipient_id: membership.profile_id,
          type: "SYSTEM",
          title: "Payment receipt awaiting verification",
          message: `${target.customer_name || "A customer"} submitted a payment receipt for review.`,
          source_table: "customer_payment_submissions",
          source_id: receiptId,
          event_key: "PAYMENT_RECEIPT_SUBMITTED",
          href: "/dashboard/payments",
          metadata: { targetType, targetId },
        })),
      );
    }

    return Response.json(
      { submissionId: receiptId, status: "AWAITING_VERIFICATION" },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "REQUEST_TOO_LARGE") {
      return Response.json(
        { error: "The receipt upload is too large." },
        { status: 413 },
      );
    }
    if (error instanceof Error && error.message === "INVALID_FORM_DATA") {
      return Response.json(
        { error: "Invalid receipt upload." },
        { status: 400 },
      );
    }
    console.error("[payment-receipt] Upload failed.", error);
    return Response.json(
      { error: "Unable to submit the receipt. Please try again." },
      { status: 400 },
    );
  }
}
