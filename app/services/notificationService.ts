import { getSupabaseBrowserClient } from "@/app/lib/supabase/client";

export type NotificationType =
  | "ORDER"
  | "APPOINTMENT"
  | "CANCELLATION"
  | "RESCHEDULE"
  | "LOW_INVENTORY"
  | "SUBSCRIPTION"
  | "PROMOTION"
  | "SYSTEM";

export interface BusinessNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  href: string;
  isRead: boolean;
  createdAt: string;
  recipientId?: string | null;
}

type NotificationRow = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  href: string | null;
  is_read: boolean;
  created_at: string;
  recipient_id?: string | null;
};

function client() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export async function listNotifications(
  tenantId: string,
  userId?: string,
): Promise<BusinessNotification[]> {
  const supabase = client();

  // Try querying with recipient_id included
  const enhanced = await supabase
    .from("business_notifications")
    .select("id,type,title,message,href,is_read,created_at,recipient_id")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(50);

  let rows: NotificationRow[];

  if (!enhanced.error) {
    rows = (enhanced.data ?? []) as NotificationRow[];
  } else {
    // Graceful backward-compatibility fallback if recipient_id column hasn't migrated yet
    const fallback = await supabase
      .from("business_notifications")
      .select("id,type,title,message,href,is_read,created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (fallback.error) throw fallback.error;
    rows = (fallback.data ?? []) as NotificationRow[];
  }

  // Client-side recipient filter safeguards in case recipient_id is populated
  const filtered = rows.filter((row) => {
    if (!row.recipient_id) return true;
    return userId ? row.recipient_id === userId : true;
  });

  return filtered.map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    href: row.href ?? "/dashboard",
    isRead: row.is_read,
    createdAt: row.created_at,
    recipientId: row.recipient_id ?? null,
  }));
}

export async function markNotificationRead(tenantId: string, id: string) {
  const { error } = await client()
    .from("business_notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", id);
  if (error) throw error;
}

export async function markAllNotificationsRead(tenantId: string) {
  const { error } = await client()
    .from("business_notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("is_read", false);
  if (error) throw error;
}

export async function deleteNotification(tenantId: string, id: string) {
  const { error } = await client()
    .from("business_notifications")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", id);
  if (error) throw error;
}

export async function getUnreadNotificationCount(
  tenantId: string,
): Promise<number> {
  const { count, error } = await client()
    .from("business_notifications")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("is_read", false);

  if (error) throw error;
  return count ?? 0;
}
