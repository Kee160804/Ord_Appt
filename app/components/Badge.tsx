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
  default: "bg-slate-700 text-slate-200 border-slate-600",
  success: "bg-emerald-900/50 text-emerald-300 border-emerald-700",
  warning: "bg-amber-900/50 text-amber-300 border-amber-700",
  danger:  "bg-red-900/50 text-red-300 border-red-700",
  info:    "bg-blue-900/50 text-blue-300 border-blue-700",
  purple:  "bg-violet-900/50 text-violet-300 border-violet-700",
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