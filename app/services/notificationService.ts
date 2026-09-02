import { getSupabaseBrowserClient } from "@/app/lib/supabase/client";

export interface BusinessNotification {
  id: string;
  type: "ORDER" | "APPOINTMENT" | "CANCELLATION" | "LOW_INVENTORY" | "SYSTEM";
  title: string;
  message: string;
  href: string;
  isRead: boolean;
  createdAt: string;
}

type NotificationRow = {
  id: string; type: BusinessNotification["type"]; title: string; message: string;
  href: string | null; is_read: boolean; created_at: string;
};

function client() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export async function listNotifications(tenantId: string) {
  const { data, error } = await client().from("business_notifications").select("id,type,title,message,href,is_read,created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(30);
  if (error) throw error;
  return ((data ?? []) as NotificationRow[]).map((row) => ({ id: row.id, type: row.type, title: row.title, message: row.message, href: row.href ?? "/dashboard", isRead: row.is_read, createdAt: row.created_at }));
}

export async function markNotificationRead(tenantId: string, id: string) {
  const { error } = await client().from("business_notifications").update({ is_read: true, read_at: new Date().toISOString() }).eq("tenant_id", tenantId).eq("id", id);
  if (error) throw error;
}

export async function markAllNotificationsRead(tenantId: string) {
  const { error } = await client().from("business_notifications").update({ is_read: true, read_at: new Date().toISOString() }).eq("tenant_id", tenantId).eq("is_read", false);
  if (error) throw error;
}
