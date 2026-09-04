"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock3 } from "lucide-react";
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
  const isBeginnerTrialWindow = tenant.plan === "starter" && remainingMs > 0;
  const isTrial = entitlement.state === "trial" || isBeginnerTrialWindow;
  if (!isTrial || !trialEndsAt) return null;

  const daysRemaining = Math.max(1, Math.ceil(remainingMs / 86_400_000));

  const expirationLabel = trialEndsAt.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-500/25 bg-amber-500/10 px-4 py-2 text-center text-[11px] text-amber-200 light:border-amber-200 light:bg-amber-50 light:text-amber-800">
      <Clock3 className="h-3.5 w-3.5" />
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
        className="font-bold underline decoration-amber-400/60 underline-offset-2 hover:text-white light:hover:text-amber-950"
      >
        View plans
      </Link>
    </div>
  );
}
