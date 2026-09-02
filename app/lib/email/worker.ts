import "server-only";

import { getSupabaseAdminClient } from "@/app/lib/supabase/admin";
import { isValidEmailAddress, sendTransactionalEmail } from "./resend";
import type { TransactionalEmailEvent } from "./templates";

interface ClaimedEmailJob {
  queue_name: "transactional" | "order" | "appointment" | "reminder";
  id: string;
  tenant_id: string;
  source_table: string;
  source_id: string;
  event_type: TransactionalEmailEvent;
  recipient_email: string;
  recipient_name: string;
  subject: string;
  payload: Record<string, unknown> | null;
  idempotency_key: string;
  attempt_count: number;
}

export interface EmailQueueResult {
  claimed: number;
  sent: number;
  failed: number;
  skipped: number;
}

function stringValue(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value : "";
}

async function validateTenant(job: ClaimedEmailJob) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("id, business_name, email, phone, address, city, is_active, status")
    .eq("id", job.tenant_id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("The tenant for this email no longer exists.");
  return data;
}

async function validateMembershipRecipient(job: ClaimedEmailJob) {
  const supabase = getSupabaseAdminClient();
  const { data: membership, error: membershipError } = await supabase
    .from("tenant_memberships")
    .select("profile_id")
    .eq("id", job.source_id)
    .eq("tenant_id", job.tenant_id)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership) throw new Error("The membership for this email no longer exists.");
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", membership.profile_id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile?.email || profile.email.toLowerCase() !== job.recipient_email.toLowerCase()) {
    throw new Error("The membership recipient no longer matches the queued email.");
  }
}

async function validateOwnerRecipient(job: ClaimedEmailJob) {
  const supabase = getSupabaseAdminClient();
  const { data: memberships, error: membershipError } = await supabase
    .from("tenant_memberships")
    .select("profile_id, roles(name)")
    .eq("tenant_id", job.tenant_id)
    .eq("is_active", true);
  if (membershipError) throw membershipError;
  const ownerMembership = (memberships ?? []).find((membership) => {
    const roles = membership.roles as unknown as { name?: string } | Array<{ name?: string }> | null;
    return (Array.isArray(roles) ? roles[0]?.name : roles?.name)?.toUpperCase() === "OWNER";
  });
  if (!ownerMembership) throw new Error("The business owner membership no longer exists.");
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", ownerMembership.profile_id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile?.email || profile.email.toLowerCase() !== job.recipient_email.toLowerCase()) {
    throw new Error("The business owner recipient no longer matches the queued email.");
  }
}

async function validateJob(job: ClaimedEmailJob) {
  if (!isValidEmailAddress(job.recipient_email)) throw new Error("Invalid recipient email.");
  const supabase = getSupabaseAdminClient();
  const tenant = await validateTenant(job);
  let replyTo: string | null = null;
  let payload: Record<string, unknown> = {
    ...(job.payload ?? {}),
    business_name: tenant.business_name,
    business_email: tenant.email,
    business_phone: tenant.phone,
    business_address: tenant.address,
    business_city: tenant.city,
    app_url: process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "",
  };

  if (job.queue_name === "order") {
    const { data, error } = await supabase
      .from("orders")
      .select("id, customer_email")
      .eq("id", job.source_id)
      .eq("tenant_id", job.tenant_id)
      .maybeSingle();
    if (error) throw error;
    if (!data || data.customer_email?.toLowerCase() !== job.recipient_email.toLowerCase()) {
      throw new Error("The order recipient no longer matches the queued email.");
    }
    replyTo = tenant.email;
  } else if (job.queue_name === "appointment" || job.queue_name === "reminder" || job.event_type === "APPOINTMENT_CANCELLED") {
    const { data, error } = await supabase
      .from("appointments")
      .select("id, customer_email, status, starts_at, customer_name, staff_id, appointment_services(service_name), staff(display_name)")
      .eq("id", job.source_id)
      .eq("tenant_id", job.tenant_id)
      .maybeSingle();
    if (error) throw error;
    if (!data || data.customer_email?.toLowerCase() !== job.recipient_email.toLowerCase()) {
      throw new Error("The appointment recipient no longer matches the queued email.");
    }
    if (job.queue_name === "reminder" && (data.status?.toUpperCase() !== "CONFIRMED" || !data.starts_at || new Date(data.starts_at) <= new Date())) {
      throw new Error("The appointment is no longer eligible for this reminder.");
    }
    if (job.event_type === "APPOINTMENT_CONFIRMED" && data.status?.toUpperCase() === "CANCELLED") {
      throw new Error("The appointment was cancelled before its confirmation email was sent.");
    }
    if (job.event_type === "APPOINTMENT_CANCELLED" && data.status?.toUpperCase() !== "CANCELLED") {
      throw new Error("The appointment is no longer cancelled.");
    }
    const services = data.appointment_services as unknown as Array<{ service_name?: string }> | null;
    const staff = data.staff as unknown as { display_name?: string } | Array<{ display_name?: string }> | null;
    const providerName = Array.isArray(staff) ? staff[0]?.display_name : staff?.display_name;
    payload = {
      ...payload,
      starts_at: data.starts_at,
      service_name: services?.[0]?.service_name || stringValue(payload, "service_name"),
      provider_name: providerName || stringValue(payload, "provider_name"),
    };
    replyTo = tenant.email;
  } else if (job.source_table === "storefront_contact_messages") {
    const { data, error } = await supabase
      .from("storefront_contact_messages")
      .select("sender_email")
      .eq("id", job.source_id)
      .eq("tenant_id", job.tenant_id)
      .maybeSingle();
    if (error) throw error;
    if (!data || tenant.email?.toLowerCase() !== job.recipient_email.toLowerCase()) {
      throw new Error("The contact message recipient no longer matches this business.");
    }
    replyTo = data.sender_email;
  } else if (job.source_table === "tenant_memberships") {
    await validateMembershipRecipient(job);
  } else if (job.source_table === "business_notifications") {
    const { data, error } = await supabase
      .from("business_notifications")
      .select("id")
      .eq("id", job.source_id)
      .eq("tenant_id", job.tenant_id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("The business alert no longer exists.");
    await validateOwnerRecipient(job);
  } else if (job.source_table === "tenants" && job.source_id !== job.tenant_id) {
    throw new Error("The subscription email is not scoped to its tenant.");
  } else if (job.source_table === "tenants") {
    await validateOwnerRecipient(job);
  }

  return { payload, replyTo };
}

async function markResult(
  job: ClaimedEmailJob,
  status: "SENT" | "FAILED" | "CANCELLED",
  providerMessageId?: string,
  errorMessage?: string,
) {
  const { error } = await getSupabaseAdminClient().rpc("mark_email_job_result", {
    p_queue_name: job.queue_name,
    p_job_id: job.id,
    p_status: status,
    p_provider_message_id: providerMessageId ?? null,
    p_error: errorMessage?.slice(0, 1000) ?? null,
  });
  if (error) throw error;
}

export async function processTransactionalEmailQueue(limit = 30): Promise<EmailQueueResult> {
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 100));
  const supabase = getSupabaseAdminClient();
  const { error: trialError } = await supabase.rpc("enqueue_due_trial_emails");
  if (trialError) console.error("[email-worker] Unable to enqueue trial emails:", trialError.message);

  const { data, error } = await supabase.rpc("claim_email_jobs", { p_limit: safeLimit });
  if (error) throw new Error(`Unable to claim email jobs: ${error.message}`);
  const jobs = (data ?? []) as ClaimedEmailJob[];
  const result: EmailQueueResult = { claimed: jobs.length, sent: 0, failed: 0, skipped: 0 };

  for (const job of jobs) {
    try {
      const { payload, replyTo } = await validateJob(job);
      const sent = await sendTransactionalEmail({
        eventType: job.event_type,
        recipientName: job.recipient_name,
        subject: job.subject,
        payload,
        to: job.recipient_email,
        replyTo,
        idempotencyKey: job.idempotency_key,
      });
      await markResult(job, "SENT", sent.providerMessageId);
      result.sent += 1;
    } catch (jobError) {
      const message = jobError instanceof Error ? jobError.message : "Unknown email delivery error.";
      const invalidRecord = message.includes("no longer") || message.includes("not scoped") || message.includes("Invalid recipient");
      try {
        await markResult(job, invalidRecord ? "CANCELLED" : "FAILED", undefined, message);
      } catch (markError) {
        console.error("[email-worker] Could not record email result", job.id, markError);
      }
      if (invalidRecord) result.skipped += 1;
      else result.failed += 1;
      console.error("[email-worker] Delivery failed", { jobId: job.id, eventType: job.event_type, error: message });
    }
  }

  return result;
}
