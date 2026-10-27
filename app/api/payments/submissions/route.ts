import { getSupabaseAdminClient } from "@/app/lib/supabase/admin";
import {
  isValidUuid,
  requestHasAllowedOrigin,
} from "@/app/lib/server/security";
import { requireTenantRole } from "@/app/lib/server/tenant-authorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tenantId = url.searchParams.get("tenantId")?.trim() ?? "";
  const status = url.searchParams.get("status")?.trim().toUpperCase() ?? "";
  if (!isValidUuid(tenantId)) {
    return Response.json({ error: "Invalid business." }, { status: 400 });
  }
  const authorization = await requireTenantRole(tenantId, [
    "OWNER",
    "ADMIN",
    "MANAGER",
  ]);
  if ("error" in authorization) {
    return Response.json(
      { error: authorization.error },
      { status: authorization.status },
    );
  }
  const admin = getSupabaseAdminClient();
  let query = admin
    .from("customer_payment_submissions")
    .select(
      "id,tenant_id,order_id,appointment_id,customer_name,customer_email,expected_amount,submitted_amount,payment_date,transaction_reference,receipt_path,receipt_mime_type,notes,status,rejection_reason,verified_by,verified_at,created_at",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (status && status !== "ALL") query = query.eq("status", status);
  const { data, error } = await query;
  if (
    error &&
    (error.code === "42P01" ||
      error.code === "PGRST205" ||
      /customer_payment_submissions/i.test(error.message))
  ) {
    return Response.json(
      {
        error:
          "Payment verification is pending the required Supabase migration.",
      },
      { status: 503 },
    );
  }
  if (error)
    return Response.json(
      { error: "Unable to load payment submissions." },
      { status: 500 },
    );

  const rows = await Promise.all(
    (data ?? []).map(async (submission) => {
      const targetTable = submission.order_id ? "orders" : "appointments";
      const targetId = submission.order_id ?? submission.appointment_id;
      const targetSelect = submission.order_id
        ? "order_number,total,payment_status,fulfillment_status"
        : "id,total,payment_status,status";
      const [target, signed] = await Promise.all([
        admin
          .from(targetTable)
          .select(targetSelect)
          .eq("id", targetId)
          .maybeSingle(),
        admin.storage
          .from("payment-receipts")
          .createSignedUrl(submission.receipt_path, 300),
      ]);
      return {
        ...submission,
        target: target.data,
        receiptUrl: signed.data?.signedUrl ?? null,
      };
    }),
  );
  return Response.json(
    { submissions: rows },
    { headers: { "Cache-Control": "no-store" } },
  );
}

interface VerificationRequest {
  tenantId?: string;
  submissionId?: string;
  action?: "verify" | "reject" | "request_resubmission";
  comment?: string;
}

export async function POST(request: Request) {
  if (!requestHasAllowedOrigin(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }
  let body: VerificationRequest;
  try {
    body = (await request.json()) as VerificationRequest;
  } catch {
    return Response.json(
      { error: "Invalid verification request." },
      { status: 400 },
    );
  }
  const tenantId = body.tenantId?.trim() ?? "";
  const submissionId = body.submissionId?.trim() ?? "";
  const comment = body.comment?.trim().slice(0, 1000) ?? "";
  if (!isValidUuid(tenantId) || !isValidUuid(submissionId) || !body.action) {
    return Response.json(
      { error: "Invalid verification request." },
      { status: 400 },
    );
  }
  if (body.action !== "verify" && !comment) {
    return Response.json(
      { error: "Provide a reason for the customer." },
      { status: 400 },
    );
  }
  const authorization = await requireTenantRole(tenantId, [
    "OWNER",
    "ADMIN",
    "MANAGER",
  ]);
  if ("error" in authorization) {
    return Response.json(
      { error: authorization.error },
      { status: authorization.status },
    );
  }
  const admin = getSupabaseAdminClient();
  const nextStatus =
    body.action === "verify"
      ? "VERIFIED"
      : body.action === "reject"
        ? "REJECTED"
        : "RESUBMISSION_REQUESTED";
  const review = await admin.rpc("review_customer_payment_submission", {
    p_tenant_id: tenantId,
    p_submission_id: submissionId,
    p_actor_id: authorization.userId,
    p_action: nextStatus,
    p_comment: comment || null,
  });
  if (review.error) {
    const alreadyProcessed = /already processed/i.test(review.error.message);
    return Response.json(
      {
        error: alreadyProcessed
          ? "This submission was already processed."
          : "Unable to update this submission.",
      },
      { status: alreadyProcessed ? 409 : 500 },
    );
  }
  return Response.json({ status: nextStatus });
}
