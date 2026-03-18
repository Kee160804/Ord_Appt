// import { type ClassValue, clsx } from "clsx";
// import { twMerge } from "tailwind-merge";

// export function cn(...inputs: ClassValue[]) {
//   return twMerge(clsx(inputs));
// }

// export function formatCurrency(amount: number): string {
//   return new Intl.NumberFormat("en-US", {
//     style: "currency",
//     currency: "USD",
//   }).format(amount);
// }

// export function formatDate(dateStr: string): string {
//   return new Date(dateStr).toLocaleDateString("en-US", {
//     month: "short",
//     day: "numeric",
//     year: "numeric",
//   });
// }

// export function formatTime(timeStr: string): string {
//   const [h, m] = timeStr.split(":").map(Number);
//   const period = h >= 12 ? "PM" : "AM";
//   const hour = h % 12 || 12;
//   return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
// }

// export function formatDuration(minutes: number): string {
//   if (minutes < 60) return `${minutes}m`;
//   const h = Math.floor(minutes / 60);
//   const m = minutes % 60;
//   return m > 0 ? `${h}h ${m}m` : `${h}h`;
// }

// export function formatRelativeTime(dateStr: string): string {
//   const date = new Date(dateStr);
//   const now = new Date();
//   const diff = now.getTime() - date.getTime();
//   const mins = Math.floor(diff / 60000);
//   if (mins < 60) return `${mins}m ago`;
//   const hrs = Math.floor(mins / 60);
//   if (hrs < 24) return `${hrs}h ago`;
//   const days = Math.floor(hrs / 24);
//   return `${days}d ago`;
// }

// export function getStatusColor(status: string): string {
//   const map: Record<string, string> = {
//     pending:   "bg-amber-100 text-amber-700 border-amber-200",
//     confirmed: "bg-blue-100 text-blue-700 border-blue-200",
//     preparing: "bg-violet-100 text-violet-700 border-violet-200",
//     ready:     "bg-green-100 text-green-700 border-green-200",
//     delivered: "bg-slate-100 text-slate-600 border-slate-200",
//     completed: "bg-slate-100 text-slate-600 border-slate-200",
//     cancelled: "bg-red-100 text-red-700 border-red-200",
//     no_show:   "bg-red-100 text-red-700 border-red-200",
//     paid:      "bg-emerald-100 text-emerald-700 border-emerald-200",
//     unpaid:    "bg-amber-100 text-amber-700 border-amber-200",
//     partial:   "bg-blue-100 text-blue-700 border-blue-200",
//     refunded:  "bg-slate-100 text-slate-600 border-slate-200",
//     active:    "bg-emerald-100 text-emerald-700 border-emerald-200",
//     inactive:  "bg-slate-100 text-slate-600 border-slate-200",
//   };
//   return map[status] ?? "bg-slate-100 text-slate-600 border-slate-200";
// }

// export function capitalise(str: string): string {
//   return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, " ");
// }





// import { type ClassValue, clsx } from "clsx";
// import { twMerge } from "tailwind-merge";

// export function cn(...inputs: ClassValue[]) {
//   return twMerge(clsx(inputs));
// }

// export function formatCurrency(amount: number): string {
//   return new Intl.NumberFormat("en-US", {
//     style: "currency",
//     currency: "USD",
//   }).format(amount);
// }

// export function formatDate(dateStr: string): string {
//   return new Date(dateStr).toLocaleDateString("en-US", {
//     month: "short",
//     day: "numeric",
//     year: "numeric",
//   });
// }

// export function formatTime(timeStr: string): string {
//   const [h, m] = timeStr.split(":").map(Number);
//   const period = h >= 12 ? "PM" : "AM";
//   const hour = h % 12 || 12;
//   return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
// }

// export function formatDuration(minutes: number): string {
//   if (minutes < 60) return `${minutes}m`;
//   const h = Math.floor(minutes / 60);
//   const m = minutes % 60;
//   return m > 0 ? `${h}h ${m}m` : `${h}h`;
// }

// export function formatRelativeTime(dateStr: string): string {
//   const date = new Date(dateStr);
//   const now = new Date();
//   const diff = now.getTime() - date.getTime();
//   const mins = Math.floor(diff / 60000);
//   if (mins < 60) return `${mins}m ago`;
//   const hrs = Math.floor(mins / 60);
//   if (hrs < 24) return `${hrs}h ago`;
//   const days = Math.floor(hrs / 24);
//   return `${days}d ago`;
// }

// export function getStatusColor(status: string): string {
//   const map: Record<string, string> = {
//     pending:   "bg-amber-100 text-amber-700 border-amber-200",
//     confirmed: "bg-blue-100 text-blue-700 border-blue-200",
//     preparing: "bg-violet-100 text-violet-700 border-violet-200",
//     ready:     "bg-green-100 text-green-700 border-green-200",
//     delivered: "bg-slate-100 text-slate-600 border-slate-200",
//     completed: "bg-slate-100 text-slate-600 border-slate-200",
//     cancelled: "bg-red-100 text-red-700 border-red-200",
//     no_show:   "bg-red-100 text-red-700 border-red-200",
//     paid:      "bg-emerald-100 text-emerald-700 border-emerald-200",
//     unpaid:    "bg-amber-100 text-amber-700 border-amber-200",
//     partial:   "bg-blue-100 text-blue-700 border-blue-200",
//     refunded:  "bg-slate-100 text-slate-600 border-slate-200",
//     active:    "bg-emerald-100 text-emerald-700 border-emerald-200",
//     inactive:  "bg-slate-100 text-slate-600 border-slate-200",
//   };
//   return map[status] ?? "bg-slate-100 text-slate-600 border-slate-200";
// }

// export function capitalise(str: string): string {
//   return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, " ");
// }
















import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
export function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number);
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
    pending: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    confirmed: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    preparing: "bg-violet-500/20 text-violet-300 border-violet-500/30",
    ready: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    delivered: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    completed: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
    no_show: "bg-red-500/20 text-red-400 border-red-500/30",
    paid: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    unpaid: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    partial: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    refunded: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    active: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    inactive: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    trial: "bg-violet-500/20 text-violet-300 border-violet-500/30",
    past_due: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return map[status] ?? "bg-slate-500/20 text-slate-400 border-slate-500/30";
}
export function capitalise(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, " ");
}