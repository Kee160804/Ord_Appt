import { cn, getStatusColor, capitalise } from "../lib/utils";

// ─── StatusBadge ──────────────────────────────────────────────
interface StatusBadgeProps {
  status: string;
  className?: string;
}
export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border",
        getStatusColor(status),
        className,
      )}
    >
      {capitalise(status)}
    </span>
  );
}

// ─── Badge ────────────────────────────────────────────────────
type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "purple";

const variants: Record<BadgeVariant, string> = {
  default: "bg-slate-700 light:bg-slate-100 text-slate-200 light:text-slate-600 border-slate-600 light:border-slate-200",
  success: "bg-emerald-900/50 light:bg-emerald-50 text-emerald-300 light:text-emerald-700 border-emerald-700 light:border-emerald-200",
  warning: "bg-amber-900/50 light:bg-amber-50 text-amber-300 light:text-amber-700 border-amber-700 light:border-amber-200",
  danger:  "bg-red-900/50 light:bg-red-50 text-red-300 light:text-red-700 border-red-700 light:border-red-200",
  info:    "bg-blue-900/50 light:bg-blue-50 text-blue-300 light:text-blue-700 border-blue-700 light:border-blue-200",
  purple:  "bg-violet-900/50 light:bg-violet-50 text-violet-300 light:text-violet-700 border-violet-700 light:border-violet-200",
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}
export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
