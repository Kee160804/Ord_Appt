import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}
export function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const value = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? `${dateStr}T12:00:00` : dateStr;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
export function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return "—";
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    pending: "bg-amber-500/20 light:bg-amber-50 text-amber-300 light:text-amber-700 border-amber-500/30 light:border-amber-300",
    confirmed: "bg-blue-500/20 light:bg-blue-50 text-blue-300 light:text-blue-700 border-blue-500/30 light:border-blue-300",
    preparing: "bg-violet-500/20 light:bg-violet-50 text-violet-300 light:text-violet-700 border-violet-500/30 light:border-violet-300",
    ready: "bg-emerald-500/20 light:bg-emerald-50 text-emerald-300 light:text-emerald-700 border-emerald-500/30 light:border-emerald-300",
    delivered: "bg-slate-500/20 light:bg-slate-100 text-slate-400 light:text-slate-600 border-slate-500/30 light:border-slate-300",
    completed: "bg-slate-500/20 light:bg-slate-100 text-slate-400 light:text-slate-600 border-slate-500/30 light:border-slate-300",
    cancelled: "bg-red-500/20 light:bg-red-50 text-red-400 light:text-red-700 border-red-500/30 light:border-red-300",
    no_show: "bg-red-500/20 light:bg-red-50 text-red-400 light:text-red-700 border-red-500/30 light:border-red-300",
    paid: "bg-emerald-500/20 light:bg-emerald-50 text-emerald-300 light:text-emerald-700 border-emerald-500/30 light:border-emerald-300",
    unpaid: "bg-amber-500/20 light:bg-amber-50 text-amber-300 light:text-amber-700 border-amber-500/30 light:border-amber-300",
    partial: "bg-blue-500/20 light:bg-blue-50 text-blue-300 light:text-blue-700 border-blue-500/30 light:border-blue-300",
    refunded: "bg-slate-500/20 light:bg-slate-100 text-slate-400 light:text-slate-600 border-slate-500/30 light:border-slate-300",
    active: "bg-emerald-500/20 light:bg-emerald-50 text-emerald-300 light:text-emerald-700 border-emerald-500/30 light:border-emerald-300",
    inactive: "bg-slate-500/20 light:bg-slate-100 text-slate-400 light:text-slate-600 border-slate-500/30 light:border-slate-300",
    trial: "bg-violet-500/20 light:bg-violet-50 text-violet-300 light:text-violet-700 border-violet-500/30 light:border-violet-300",
    past_due: "bg-red-500/20 light:bg-red-50 text-red-400 light:text-red-700 border-red-500/30 light:border-red-300",
  };
  return map[status] ?? "bg-slate-500/20 text-slate-400 border-slate-500/30";
}
export function capitalise(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, " ");
}
