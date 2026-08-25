import { cn } from "../lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  change?: number;
  icon: React.ReactNode;
  iconBg?: string;
  chartColor?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  change,
  icon,
  iconBg = "bg-slate-700",
  chartColor = "text-violet-500",
  className,
}: StatCardProps) {
  const positive = change !== undefined && change >= 0;
  return (
    <div
      className={cn(
        "min-h-[126px] rounded-xl border border-slate-700/50 light:border-[#e4e9f1] bg-slate-900/70 light:bg-white p-4 shadow-sm light:shadow-[0_1px_3px_rgba(15,23,42,0.04)]",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-full", iconBg)}>
          {icon}
        </div>
        <p className="truncate text-xs font-medium text-slate-400 light:text-[#61708a]">{label}</p>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-2xl font-bold tracking-tight text-white light:text-[#101a2f]">{value}</p>
        <svg aria-hidden="true" viewBox="0 0 68 28" className={cn("h-7 w-[68px]", chartColor)}>
          <path
            d="M2 23 L12 18 L20 20 L29 7 L38 22 L48 13 L57 19 L66 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="2" cy="23" r="1.7" fill="currentColor" />
          <circle cx="29" cy="7" r="1.7" fill="currentColor" />
          <circle cx="66" cy="5" r="1.7" fill="currentColor" />
        </svg>
      </div>
      <p
        className={cn(
          "mt-2 text-[11px] font-medium",
          change === undefined
            ? "text-slate-500 light:text-[#8792a6]"
            : positive
              ? "text-emerald-400 light:text-emerald-600"
              : "text-red-400 light:text-red-600",
        )}
      >
        {change === undefined
          ? "No changes"
          : `${positive ? "↑" : "↓"} ${Math.abs(change)}% vs last month`}
      </p>
    </div>
  );
}
