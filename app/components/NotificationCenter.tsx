"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  Calendar,
  CheckCheck,
  CreditCard,
  Package,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Tag,
  Users,
  X,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/app/lib/supabase/client";
import { isSupabaseConfigured } from "@/app/lib/supabase/config";
import {
  deleteNotification,
  getNotificationSnapshot,
  mapNotificationRow,
  markAllNotificationsRead,
  markNotificationRead,
  type BusinessNotification,
  type NotificationRow,
  type NotificationType,
} from "@/app/services/notificationService";
import { useAuth } from "@/app/contexts/auth";

interface NotificationCenterProps {
  tenantId?: string;
  userId?: string;
}

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 30) return "Just now";
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return "Yesterday";
    if (diffInDays < 7) return `${diffInDays}d ago`;

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case "ORDER":
      return (
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400 light:bg-emerald-50 light:text-emerald-600">
          <ShoppingBag className="h-4 w-4" />
        </div>
      );
    case "APPOINTMENT":
      return (
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400 light:bg-blue-50 light:text-blue-600">
          <Calendar className="h-4 w-4" />
        </div>
      );
    case "CANCELLATION":
      return (
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-rose-500/15 text-rose-400 light:bg-rose-50 light:text-rose-600">
          <AlertTriangle className="h-4 w-4" />
        </div>
      );
    case "RESCHEDULE":
      return (
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400 light:bg-amber-50 light:text-amber-600">
          <RotateCcw className="h-4 w-4" />
        </div>
      );
    case "CUSTOMER":
      return (
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-400 light:bg-cyan-50 light:text-cyan-700">
          <Users className="h-4 w-4" />
        </div>
      );
    case "LOW_INVENTORY":
      return (
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400 light:bg-amber-50 light:text-amber-600">
          <Package className="h-4 w-4" />
        </div>
      );
    case "SUBSCRIPTION":
    case "TRIAL":
      return (
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-400 light:bg-violet-50 light:text-violet-600">
          <CreditCard className="h-4 w-4" />
        </div>
      );
    case "PROMOTION":
      return (
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-pink-500/15 text-pink-400 light:bg-pink-50 light:text-pink-600">
          <Tag className="h-4 w-4" />
        </div>
      );
    case "SYSTEM":
    default:
      return (
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-400 light:bg-indigo-50 light:text-indigo-600">
          <Sparkles className="h-4 w-4" />
        </div>
      );
  }
}

export function NotificationCenter({
  tenantId: propTenantId,
  userId: propUserId,
}: NotificationCenterProps) {
  const router = useRouter();
  const { user, tenant } = useAuth();
  const tenantId = propTenantId ?? tenant?.id;
  const userId = propUserId ?? user?.id;
  const scopeKey = `${tenantId ?? ""}:${userId ?? ""}`;

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<BusinessNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState("");
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const locallyReadIdsRef = useRef(new Set<string>());
  const locallyDeletedIdsRef = useRef(new Set<string>());
  const activeScopeRef = useRef(scopeKey);
  activeScopeRef.current = scopeKey;

  const refresh = useCallback(async () => {
    if (!tenantId || !userId || !isSupabaseConfigured()) return;
    const requestedScope = `${tenantId}:${userId}`;
    try {
      const snapshot = await getNotificationSnapshot(tenantId, userId);
      if (activeScopeRef.current !== requestedScope) return;
      setItems(snapshot.items);
      setUnreadCount(snapshot.unreadCount);
      setError("");
    } catch (loadError) {
      if (activeScopeRef.current !== requestedScope) return;
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load notifications.",
      );
    }
  }, [tenantId, userId]);

  useEffect(() => {
    setItems([]);
    setUnreadCount(0);
    setError("");
    locallyReadIdsRef.current.clear();
    locallyDeletedIdsRef.current.clear();
  }, [scopeKey]);

  // Initial load and real-time subscription
  useEffect(() => {
    const initialLoad = window.setTimeout(() => void refresh(), 0);
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !tenantId || !userId) {
      return () => window.clearTimeout(initialLoad);
    }

    const channel = supabase
      .channel(`business-notifications-${tenantId}-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "business_notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const eventType = payload.eventType;
          const next = payload.new as NotificationRow;
          const previous = payload.old as NotificationRow;
          const row = eventType === "DELETE" ? previous : next;

          // Realtime is recipient-filtered and RLS-protected. This final tenant
          // check also prevents a multi-business session from mixing rows.
          if (
            eventType === "DELETE" &&
            (!row?.tenant_id || !row?.recipient_id)
          ) {
            void refresh();
            return;
          }
          if (
            !row ||
            row.tenant_id !== tenantId ||
            row.recipient_id !== userId
          ) {
            return;
          }

          if (eventType === "INSERT") {
            const notification = mapNotificationRow(next);
            setItems((current) =>
              [
                notification,
                ...current.filter((item) => item.id !== notification.id),
              ].slice(0, 50),
            );
            if (!notification.isRead) {
              setUnreadCount((current) => current + 1);
            }
            return;
          }

          if (eventType === "UPDATE") {
            const notification = mapNotificationRow(next);
            setItems((current) =>
              current.map((item) =>
                item.id === notification.id ? notification : item,
              ),
            );
            const wasAppliedLocally = locallyReadIdsRef.current.delete(next.id);
            if (!wasAppliedLocally && previous.is_read !== next.is_read) {
              setUnreadCount((current) =>
                Math.max(0, current + (next.is_read ? -1 : 1)),
              );
            }
            return;
          }

          if (eventType === "DELETE") {
            setItems((current) =>
              current.filter((item) => item.id !== previous.id),
            );
            const wasAppliedLocally = locallyDeletedIdsRef.current.delete(
              previous.id,
            );
            if (!wasAppliedLocally && !previous.is_read) {
              setUnreadCount((current) => Math.max(0, current - 1));
            }
          }
        },
      )
      .subscribe();

    return () => {
      window.clearTimeout(initialLoad);
      void supabase.removeChannel(channel);
    };
  }, [refresh, tenantId, userId]);

  // Handle outside click and Escape key to close
  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleMarkAllRead = async () => {
    if (!tenantId || !userId || unreadCount === 0 || isMarkingAll) return;
    setIsMarkingAll(true);
    const unreadIds = items
      .filter((item) => !item.isRead)
      .map((item) => item.id);
    unreadIds.forEach((id) => locallyReadIdsRef.current.add(id));
    try {
      await markAllNotificationsRead(tenantId, userId);
      setItems((current) => current.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
      setError("");
      window.setTimeout(() => {
        unreadIds.forEach((id) => locallyReadIdsRef.current.delete(id));
      }, 15_000);
    } catch (err) {
      unreadIds.forEach((id) => locallyReadIdsRef.current.delete(id));
      setError(
        err instanceof Error
          ? err.message
          : "Unable to mark notifications as read.",
      );
      void refresh();
    } finally {
      setIsMarkingAll(false);
    }
  };

  const handleNotificationClick = (item: BusinessNotification) => {
    setOpen(false);
    if (!item.isRead && tenantId && userId) {
      locallyReadIdsRef.current.add(item.id);
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, isRead: true } : entry,
        ),
      );
      setUnreadCount((current) => Math.max(0, current - 1));
      void markNotificationRead(tenantId, userId, item.id)
        .then(() =>
          window.setTimeout(
            () => locallyReadIdsRef.current.delete(item.id),
            15_000,
          ),
        )
        .catch(() => {
          locallyReadIdsRef.current.delete(item.id);
          void refresh();
        });
    }
    if (item.href) {
      router.push(item.href);
    }
  };

  const handleDelete = async (
    event: React.MouseEvent,
    notificationId: string,
  ) => {
    event.stopPropagation();
    if (!tenantId || !userId) return;

    const removed = items.find((item) => item.id === notificationId);
    locallyDeletedIdsRef.current.add(notificationId);
    setItems((current) => current.filter((item) => item.id !== notificationId));
    if (removed && !removed.isRead) {
      setUnreadCount((current) => Math.max(0, current - 1));
    }
    try {
      await deleteNotification(tenantId, userId, notificationId);
      setError("");
      window.setTimeout(
        () => locallyDeletedIdsRef.current.delete(notificationId),
        15_000,
      );
    } catch (err) {
      locallyDeletedIdsRef.current.delete(notificationId);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to dismiss the notification.",
      );
      void refresh();
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell Button */}
      <button
        onClick={() => setOpen((value) => !value)}
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
        title="Notifications"
        className="relative flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white light:hover:bg-slate-100 light:hover:text-slate-900 sm:h-9 sm:w-9"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white shadow-sm ring-2 ring-[#0b1424] light:ring-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div className="fixed inset-x-3 top-[68px] z-50 flex max-h-[75dvh] flex-col overflow-hidden rounded-xl border border-slate-700 bg-[#0e172a] shadow-2xl light:border-[#e3e8f0] light:bg-white sm:absolute sm:inset-x-auto sm:right-0 sm:top-10 sm:w-96">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-700/80 px-4 py-3 light:border-slate-200">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white light:text-slate-900">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-semibold text-violet-400 light:bg-violet-100 light:text-violet-700">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  disabled={isMarkingAll}
                  className="flex items-center gap-1 text-[11px] font-medium text-violet-400 transition-colors hover:text-violet-300 disabled:opacity-50 light:text-violet-600 light:hover:text-violet-700"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
                className="rounded p-1 text-slate-400 hover:text-white light:hover:text-slate-900 sm:hidden"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body / List */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {error && (
              <div className="m-3 flex items-center gap-2 rounded-lg bg-rose-500/10 p-3 text-[11px] text-rose-400">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {!error && items.length === 0 && (
              <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-slate-500 light:bg-slate-100 light:text-slate-400">
                  <Bell className="h-5 w-5" />
                </div>
                <p className="mt-3 text-xs font-medium text-slate-300 light:text-slate-700">
                  All caught up!
                </p>
                <p className="mt-1 text-[11px] text-slate-500 light:text-slate-400">
                  New orders, bookings, and alerts will appear here in real
                  time.
                </p>
              </div>
            )}

            {items.map((item) => (
              <div
                key={item.id}
                onClick={() => handleNotificationClick(item)}
                className={`group relative flex cursor-pointer items-start gap-3 border-b border-slate-800/80 px-4 py-3 transition-colors hover:bg-slate-800/50 light:border-slate-100 light:hover:bg-slate-50 ${
                  item.isRead
                    ? "opacity-80 hover:opacity-100"
                    : "bg-violet-500/[0.07] light:bg-violet-50/50"
                }`}
              >
                {/* Icon */}
                {getNotificationIcon(item.type)}

                {/* Content */}
                <div className="min-w-0 flex-1 pr-6">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-xs font-semibold text-white light:text-slate-900">
                      {item.title}
                    </p>
                    {!item.isRead && (
                      <span className="h-1.5 w-1.5 flex-none rounded-full bg-violet-400 light:bg-violet-600" />
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-300 light:text-slate-600">
                    {item.message}
                  </p>
                  <time
                    dateTime={item.createdAt}
                    title={new Date(item.createdAt).toLocaleString()}
                    className="mt-1 block text-[10px] font-medium text-slate-500 light:text-slate-400"
                  >
                    {formatRelativeTime(item.createdAt)}
                  </time>
                </div>

                {/* Dismiss button */}
                <button
                  type="button"
                  onClick={(e) => handleDelete(e, item.id)}
                  aria-label="Dismiss notification"
                  title="Dismiss"
                  className="absolute right-3 top-3.5 rounded p-1 text-slate-500 opacity-0 transition-opacity hover:bg-slate-700/50 hover:text-slate-300 group-hover:opacity-100 light:hover:bg-slate-200 light:hover:text-slate-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Footer if there are items */}
          {items.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-700/80 bg-slate-950/40 px-4 py-2 text-[10px] text-slate-400 light:border-slate-200 light:bg-slate-50">
              <span>{items.length} notifications</span>
              <span className="text-[9px] text-slate-500">
                Live updates active
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
