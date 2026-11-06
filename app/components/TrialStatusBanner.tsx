"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";
import { getTenantEntitlement, getTrialEndDate } from "@/app/lib/subscription";
import type { Tenant } from "@/app/types";

export function TrialStatusBanner({ tenant }: { tenant: Tenant }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const refresh = () => setNow(new Date());
    const interval = window.setInterval(refresh, 60_000);

    refresh();
    return () => window.clearInterval(interval);
  }, [
    tenant.id,
    tenant.createdAt,
    tenant.trialEndsAt,
    tenant.subscriptionStatus,
  ]);

  const entitlement = getTenantEntitlement(tenant, now);
  const trialEndsAt = getTrialEndDate(tenant);
  const remainingMs = trialEndsAt ? trialEndsAt.getTime() - now.getTime() : 0;
  const isTrial = entitlement.state === "trial";
  if (!isTrial || !trialEndsAt) return null;

  const daysRemaining = Math.max(1, Math.ceil(remainingMs / 86_400_000));

  const expirationLabel = trialEndsAt.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="trial-status-banner flex min-h-[56px] items-center justify-center gap-x-3 border-b px-4 py-2 text-[11px] md:min-h-[62px] md:text-[13px]">
      <CalendarDays className="h-[18px] w-[18px] shrink-0 text-violet-600 dark:text-violet-300" />
      <span>
        Free trial ends {expirationLabel ? `on ${expirationLabel}` : "soon"}{" "}
        with{" "}
        <strong>
          {daysRemaining} day
          {daysRemaining === 1 ? "" : "s"}
        </strong>{" "}
        remaining.
      </span>
      <Link
        href="/home#pricing"
        className="ml-auto inline-flex shrink-0 items-center gap-1.5 font-bold text-violet-700 underline decoration-violet-400/50 underline-offset-2 hover:text-violet-900 dark:text-violet-300 dark:hover:text-white md:ml-4"
      >
        View plans <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
