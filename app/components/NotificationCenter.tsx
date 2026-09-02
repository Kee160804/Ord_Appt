"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { getSupabaseBrowserClient } from "@/app/lib/supabase/client";
import { isSupabaseConfigured } from "@/app/lib/supabase/config";
import { listNotifications, markAllNotificationsRead, markNotificationRead, type BusinessNotification } from "@/app/services/notificationService";

export function NotificationCenter({ tenantId }: { tenantId?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<BusinessNotification[]>([]);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!tenantId || !isSupabaseConfigured()) return;
    try {
      setItems(await listNotifications(tenantId));
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load notifications.");
    }
  }, [tenantId]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void refresh(), 0);
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !tenantId) return () => window.clearTimeout(initialLoad);
    const channel = supabase.channel(`business-notifications-${tenantId}`).on(
      "postgres_changes",
      { event: "*", schema: "public", table: "business_notifications", filter: `tenant_id=eq.${tenantId}` },
      () => void refresh(),
    ).subscribe();
    return () => { window.clearTimeout(initialLoad); void supabase.removeChannel(channel); };
  }, [refresh, tenantId]);

  const unread = items.filter((item) => !item.isRead).length;

  return (
    <div className="relative">
      <button onClick={() => setOpen((value) => !value)} aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} title="Notifications" className="relative flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white light:hover:bg-slate-100 light:hover:text-slate-900 sm:h-9 sm:w-9">
        <Bell className="h-4 w-4" />
        {unread > 0 && <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[8px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="fixed inset-x-3 top-[72px] z-50 max-h-[70dvh] overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl light:border-[#e3e8f0] light:bg-white sm:absolute sm:inset-x-auto sm:right-0 sm:top-10 sm:w-80">
          <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3 light:border-slate-200">
            <div><p className="text-xs font-semibold text-white light:text-slate-900">Notifications</p><p className="text-[10px] text-slate-400">{unread} unread</p></div>
            {unread > 0 && <button className="flex items-center gap-1 text-[10px] font-semibold text-violet-400" onClick={() => void markAllNotificationsRead(tenantId ?? "").then(() => setItems((current) => current.map((item) => ({ ...item, isRead: true }))))}><CheckCheck className="h-3 w-3" /> Mark all read</button>}
          </div>
          <div className="max-h-[55dvh] overflow-y-auto">
            {error && <p className="p-4 text-[11px] text-red-400">{error}</p>}
            {!error && items.length === 0 && <p className="p-6 text-center text-[11px] text-slate-400">No business activity yet.</p>}
            {items.map((item) => (
              <button key={item.id} className={`block w-full border-b border-slate-800 px-4 py-3 text-left light:border-slate-100 ${item.isRead ? "" : "bg-violet-500/10"}`} onClick={() => {
                setOpen(false);
                setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, isRead: true } : entry));
                if (!item.isRead) void markNotificationRead(tenantId ?? "", item.id);
                router.push(item.href);
              }}>
                <div className="flex items-start justify-between gap-2"><p className="text-[11px] font-semibold text-white light:text-slate-900">{item.title}</p>{!item.isRead && <span className="mt-1 h-2 w-2 flex-none rounded-full bg-violet-500" />}</div>
                <p className="mt-1 text-[10px] leading-4 text-slate-400 light:text-slate-600">{item.message}</p>
                <p className="mt-1 text-[9px] text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
