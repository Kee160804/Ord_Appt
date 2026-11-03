import "server-only";
import { getSupabaseAdminClient } from "@/app/lib/supabase/admin";
import { hashGuestAccessToken } from "@/app/lib/server/guest-access";

/** Tokens issued before email verification cannot read orders or upload receipts. */
export async function getVerifiedTrackingSession(
  tenantId: string,
  token: string,
) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const { data, error } = await getSupabaseAdminClient()
    .from("order_tracking_sessions")
    .select("order_id,appointment_id,customer_email,expires_at")
    .eq("tenant_id", tenantId)
    .eq("token_hash", hashGuestAccessToken(token))
    .not("verified_at", "is", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error || !data) return null;
  return data as {
    order_id: string | null;
    appointment_id: string | null;
    customer_email: string;
    expires_at: string;
  };
}
