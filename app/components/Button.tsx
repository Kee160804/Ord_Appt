import { cn } from "../lib/utils";
import { ButtonHTMLAttributes } from "react";

type Variant =
  "primary" | "secondary" | "ghost" | "danger" | "outline" | "success";
type Size = "xs" | "sm" | "md" | "lg";

const variantCls: Record<Variant, string> = {
  primary:
    "bg-violet-600 text-white hover:bg-violet-700 shadow-sm shadow-violet-900/20",
  secondary:
    "bg-slate-700 light:bg-slate-100 text-slate-100 light:text-slate-700 hover:bg-slate-600 light:hover:bg-slate-200",
  ghost:
    "text-slate-400 light:text-slate-500 hover:bg-slate-800 light:hover:bg-slate-100 hover:text-slate-100 light:hover:text-slate-900",
  danger: "bg-red-600 text-white hover:bg-red-500",
  outline:
    "border border-slate-600 light:border-slate-300 text-slate-300 light:text-slate-700 hover:bg-slate-800 light:hover:bg-slate-50 hover:text-white light:hover:text-slate-900",
  success: "bg-emerald-600 text-white hover:bg-emerald-500",
};

const sizeCls: Record<Size, string> = {
  xs: "px-2.5 py-1 text-xs rounded-lg gap-1",
  sm: "px-3 py-1.5 text-xs rounded-lg gap-1.5",
  md: "px-4 py-2 text-sm rounded-lg gap-2",
  lg: "px-6 py-3 text-base rounded-lg gap-2",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center font-medium transition-all duration-150",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variantCls[variant],
        sizeCls[size],
        className,
      )}
      {...rest}
    >
      {loading && (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
}
