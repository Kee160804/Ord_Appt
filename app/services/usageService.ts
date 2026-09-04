import { getSupabaseBrowserClient } from "@/app/lib/supabase/client";
import { PLAN_DEFINITIONS } from "@/app/lib/plans";
import type { PlanType } from "@/app/types";

interface MonthlyUsageRow {
  plan: string;
  activity_count: number | string;
  activity_limit: number | string | null;
  period_start: string;
  period_end: string;
  usage_percent: number | string;
  is_limit_reached: boolean;
}

export interface MonthlyUsage {
  plan: PlanType;
  activityCount: number;
  activityLimit: number | null;
  periodStart: string;
  periodEnd: string;
  usagePercent: number;
  isLimitReached: boolean;
}

function normalizePlan(value: string): PlanType {
  return value === "pro" || value === "enterprise" ? value : "starter";
}

export async function getTenantMonthlyUsage(
  tenantId: string,
): Promise<MonthlyUsage> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.rpc("get_tenant_monthly_usage", {
    p_tenant_id: tenantId,
  });
  if (error) throw error;

  const row = (Array.isArray(data) ? data[0] : data) as MonthlyUsageRow | null;
  if (!row) throw new Error("Monthly usage was not returned.");
  const plan = normalizePlan(row.plan);
  const fallbackLimit = PLAN_DEFINITIONS[plan].monthlyActivityLimit;

  return {
    plan,
    activityCount: Number(row.activity_count) || 0,
    activityLimit:
      row.activity_limit == null ? fallbackLimit : Number(row.activity_limit),
    periodStart: row.period_start,
    periodEnd: row.period_end,
    usagePercent: Math.max(0, Number(row.usage_percent) || 0),
    isLimitReached: Boolean(row.is_limit_reached),
  };
}
