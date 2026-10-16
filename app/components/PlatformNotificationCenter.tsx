"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Bell,
  Building2,
  CalendarDays,
  CheckCheck,
  CreditCard,
  FileLock2,
  ShoppingBag,
  Sparkles,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/app/lib/supabase/client";
import { isSupabaseConfigured } from "@/app/lib/supabase/config";
import {
  deletePlatformNotification,
  getPlatformNotificationSnapshot,
  markAllPlatformNotificationsRead,
  markPlatformNotificationRead,
  type PlatformNotification,
  type PlatformNotificationType,
} from "@/app/services/platformNotificationService";

function relativeTime(value: string) {
  const date = new Date(value);
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 1_000),
  );
  if (seconds < 30) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function NotificationIcon({ type }: { type: PlatformNotificationType }) {
  const iconClass = "h-4 w-4";
  const frameClass =
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg";

  switch (type) {
    case "ACCOUNT":
      return (
        <span className={`${frameClass} bg-cyan-500/15 text-cyan-400`}>
          <UserPlus className={iconClass} />
        </span>
      );
    case "TENANT":
      return (
        <span className={`${frameClass} bg-violet-500/15 text-violet-400`}>
          <Building2 className={iconClass} />
        </span>
      );
    case "TEAM":
      return (
        <span className={`${frameClass} bg-blue-500/15 text-blue-400`}>
          <UsersRound className={iconClass} />
        </span>
      );
    case "ORDER":
      return (
        <span className={`${frameClass} bg-emerald-500/15 text-emerald-400`}>
          <ShoppingBag className={iconClass} />
        </span>
      );
    case "APPOINTMENT":
      return (
        <span className={`${frameClass} bg-sky-500/15 text-sky-400`}>
          <CalendarDays className={iconClass} />
        </span>
      );
    case "PAYMENT":
    case "SUBSCRIPTION":
      return (
        <span className={`${frameClass} bg-amber-500/15 text-amber-400`}>
          <CreditCard className={iconClass} />
        </span>
      );
    case "PRIVACY":
      return (
        <span className={`${frameClass} bg-rose-500/15 text-rose-400`}>
          <FileLock2 className={iconClass} />
        </span>
      );
    default:
      return (
        <span className={`${frameClass} bg-indigo-500/15 text-indigo-400`}>
          <Sparkles className={iconClass} />
        </span>
      );
  }
}

export function PlatformNotificationCenter({ userId }: { userId?: string }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PlatformNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState("");
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId || !isSupabaseConfigured()) return;
    try {
      const snapshot = await getPlatformNotificationSnapshot(userId);
      setItems(snapshot.items);
      setUnreadCount(snapshot.unreadCount);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load platform notifications.",
      );
    }
  }, [userId]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void refresh(), 0);
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !userId) {
      return () => window.clearTimeout(initialLoad);
    }

    const channel = supabase
      .channel(`platform-notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "platform_notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      window.clearTimeout(initialLoad);
      void supabase.removeChannel(channel);
    };
  }, [refresh, userId]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("touchstart", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("touchstart", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const markAllRead = async () => {
    if (!userId || unreadCount === 0 || isMarkingAll) return;
    setIsMarkingAll(true);
    try {
      await markAllPlatformNotificationsRead(userId);
      setItems((current) => current.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
      setError("");
    } catch (markError) {
      setError(
        markError instanceof Error
          ? markError.message
          : "Unable to mark notifications as read.",
      );
      void refresh();
    } finally {
      setIsMarkingAll(false);
    }
  };

  const openNotification = (item: PlatformNotification) => {
    setOpen(false);
    if (!item.isRead && userId) {
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, isRead: true } : entry,
        ),
      );
      setUnreadCount((current) => Math.max(0, current - 1));
      void markPlatformNotificationRead(userId, item.id).catch(
        () => void refresh(),
      );
    }
    router.push(item.href || "/admin");
  };

  const dismiss = async (
    event: React.MouseEvent,
    item: PlatformNotification,
  ) => {
    event.stopPropagation();
    if (!userId) return;
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    if (!item.isRead) setUnreadCount((current) => Math.max(0, current - 1));
    try {
      await deletePlatformNotification(userId, item.id);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to dismiss this notification.",
      );
      void refresh();
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-label={`Platform notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        onClick={() => setOpen((value) => !value)}
        title="Platform notifications"
        className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/50 text-slate-400 transition hover:border-violet-500/50 hover:text-white light:border-slate-200 light:bg-white light:text-slate-600 light:hover:text-violet-700"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white ring-2 ring-[#070d19] light:ring-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-18 z-50 flex max-h-[78dvh] flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#0c1425] shadow-2xl light:border-slate-200 light:bg-white sm:absolute sm:inset-x-auto sm:right-0 sm:top-13 sm:w-105">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 light:border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white light:text-slate-900">
                  Platform Activity
                </h3>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-400">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[10px] text-slate-500">
                Live events across YuhBusiness
              </p>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  disabled={isMarkingAll}
                  onClick={() => void markAllRead()}
                  className="flex items-center gap-1 text-[10px] font-semibold text-violet-400 disabled:opacity-50"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all read
                </button>
              )}
              <button
                type="button"
                aria-label="Close platform notifications"
                onClick={() => setOpen(false)}
                className="rounded p-1 text-slate-500 hover:text-white light:hover:text-slate-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain">
            {error && (
              <div className="m-3 flex items-center gap-2 rounded-lg bg-rose-500/10 p-3 text-[11px] text-rose-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            {!error && items.length === 0 && (
              <div className="flex flex-col items-center px-6 py-12 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-slate-500 light:bg-slate-100">
                  <Bell className="h-5 w-5" />
                </span>
                <p className="mt-3 text-xs font-semibold text-slate-300 light:text-slate-700">
                  All caught up
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  New platform events will appear here in real time.
                </p>
              </div>
            )}
            {items.map((item) => (
              <div
                role="button"
                tabIndex={0}
                key={item.id}
                onClick={() => openNotification(item)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openNotification(item);
                  }
                }}
                className={`group relative flex w-full items-start gap-3 border-b border-slate-800/80 px-4 py-3 text-left transition hover:bg-slate-800/50 light:border-slate-100 light:hover:bg-slate-50 ${
                  item.isRead
                    ? "opacity-75 hover:opacity-100"
                    : "bg-violet-500/7"
                }`}
              >
                <NotificationIcon type={item.type} />
                <span className="min-w-0 flex-1 pr-6">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-xs font-semibold text-white light:text-slate-900">
                      {item.title}
                    </span>
                    {!item.isRead && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                    )}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-300 light:text-slate-600">
                    {item.message}
                  </span>
                  <time
                    dateTime={item.createdAt}
                    title={new Date(item.createdAt).toLocaleString()}
                    className="mt-1 block text-[10px] text-slate-500"
                  >
                    {relativeTime(item.createdAt)}
                  </time>
                </span>
                <button
                  type="button"
                  aria-label="Dismiss notification"
                  title="Dismiss"
                  onClick={(event) => void dismiss(event, item)}
                  className="absolute right-3 top-3 rounded p-1 text-slate-500 opacity-0 hover:bg-slate-700/50 hover:text-slate-300 group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          {items.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950/40 px-4 py-2 text-[10px] text-slate-500 light:border-slate-200 light:bg-slate-50">
              <span>{items.length} recent events</span>
              <span>Live monitoring active</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
