"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Gauge } from "lucide-react";
import { isSupabaseConfigured } from "@/app/lib/supabase/config";
import { PLAN_DEFINITIONS } from "@/app/lib/plans";
import { getTenantMonthlyUsage, type MonthlyUsage } from "@/app/services/usageService";
import type { Tenant } from "@/app/types";

export function PlanUsageBanner({ tenant }: { tenant: Tenant }) {
  const [usage, setUsage] = useState<MonthlyUsage | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured() || tenant.plan === "enterprise") return;
    let active = true;

    getTenantMonthlyUsage(tenant.id)
      .then((result) => {
        if (active) setUsage(result);
      })
      .catch(() => {
        // The dashboard remains usable before the additive quota migration is applied.
        if (active) setUsage(null);
      });

    return () => {
      active = false;
    };
  }, [tenant.id, tenant.plan]);

  if (!usage || usage.activityLimit == null) return null;

  const percentage = Math.min(100, usage.usagePercent);
  const warningLevel = usage.isLimitReached ? 100 : usage.usagePercent >= 90 ? 90 : usage.usagePercent >= 80 ? 80 : 0;
  const containerClass = warningLevel === 100
    ? "border-red-500/30 bg-red-500/10 text-red-200 light:border-red-200 light:bg-red-50 light:text-red-800"
    : warningLevel >= 80
      ? "border-amber-500/30 bg-amber-500/10 text-amber-200 light:border-amber-200 light:bg-amber-50 light:text-amber-800"
      : "border-violet-500/20 bg-violet-500/10 text-violet-200 light:border-violet-200 light:bg-violet-50 light:text-violet-800";
  const planName = PLAN_DEFINITIONS[usage.plan].name;

  return (
    <div className={`border-b px-4 py-2 text-[11px] ${containerClass}`}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-2">
        {warningLevel >= 80 ? <AlertTriangle className="h-3.5 w-3.5" /> : <Gauge className="h-3.5 w-3.5" />}
        <span>
          <strong>{usage.activityCount} of {usage.activityLimit}</strong> monthly orders or appointments used on the {planName} plan.
        </span>
        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-black/15 light:bg-black/10" aria-hidden="true">
          <div className="h-full rounded-full bg-current transition-[width]" style={{ width: `${percentage}%` }} />
        </div>
        {warningLevel === 80 && <span className="font-semibold">You have used at least 80% of this month&apos;s allowance.</span>}
        {warningLevel === 90 && <span className="font-semibold">You are close to this month&apos;s limit.</span>}
        {warningLevel === 100 && <span className="font-semibold">New public activity is paused until next month or a plan change.</span>}
        {warningLevel >= 80 && (
          <Link href="/home#pricing" className="font-bold underline underline-offset-2">View plans</Link>
        )}
      </div>
    </div>
  );
}

