import { requireSupabaseBrowserClient as client } from "@/app/lib/supabase/client";

export type PlatformNotificationType =
  | "ACCOUNT"
  | "TENANT"
  | "TEAM"
  | "ORDER"
  | "APPOINTMENT"
  | "PAYMENT"
  | "SUBSCRIPTION"
  | "PRIVACY"
  | "SYSTEM";

export interface PlatformNotification {
  id: string;
  recipientId: string;
  tenantId?: string;
  type: PlatformNotificationType;
  title: string;
  message: string;
  href: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface PlatformNotificationRow {
  id: string;
  recipient_id: string;
  tenant_id: string | null;
  type: PlatformNotificationType;
  title: string;
  message: string;
  href: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

const COLUMNS =
  "id,recipient_id,tenant_id,type,title,message,href,is_read,read_at,created_at,metadata";

export function mapPlatformNotificationRow(
  row: PlatformNotificationRow,
): PlatformNotification {
  return {
    id: row.id,
    recipientId: row.recipient_id,
    tenantId: row.tenant_id ?? undefined,
    type: row.type,
    title: row.title,
    message: row.message,
    href: row.href,
    isRead: row.is_read,
    readAt: row.read_at ?? undefined,
    createdAt: row.created_at,
    metadata: row.metadata ?? {},
  };
}

export async function getPlatformNotificationSnapshot(recipientId: string) {
  const supabase = client();
  const [itemsResult, countResult] = await Promise.all([
    supabase
      .from("platform_notifications")
      .select(COLUMNS)
      .eq("recipient_id", recipientId)
      .order("created_at", { ascending: false })
      .limit(75),
    supabase
      .from("platform_notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", recipientId)
      .eq("is_read", false),
  ]);

  if (itemsResult.error) throw itemsResult.error;
  if (countResult.error) throw countResult.error;

  return {
    items: ((itemsResult.data ?? []) as PlatformNotificationRow[]).map(
      mapPlatformNotificationRow,
    ),
    unreadCount: countResult.count ?? 0,
  };
}

export async function markPlatformNotificationRead(
  recipientId: string,
  notificationId: string,
) {
  const { error } = await client()
    .from("platform_notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("recipient_id", recipientId)
    .eq("id", notificationId)
    .eq("is_read", false);
  if (error) throw error;
}

export async function markAllPlatformNotificationsRead(recipientId: string) {
  const { error } = await client()
    .from("platform_notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("recipient_id", recipientId)
    .eq("is_read", false);
  if (error) throw error;
}

export async function deletePlatformNotification(
  recipientId: string,
  notificationId: string,
) {
  const { error } = await client()
    .from("platform_notifications")
    .delete()
    .eq("recipient_id", recipientId)
    .eq("id", notificationId);
  if (error) throw error;
}
