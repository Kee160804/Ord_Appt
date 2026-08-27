"use client";

import Link from "next/link";
import { Clock3 } from "lucide-react";
import { getTenantEntitlement } from "@/app/lib/subscription";
import type { Tenant } from "@/app/types";

export function TrialStatusBanner({ tenant }: { tenant: Tenant }) {
  const entitlement = getTenantEntitlement(tenant);
  if (entitlement.state !== "trial") return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-500/25 bg-amber-500/10 px-4 py-2 text-center text-[11px] text-amber-200 light:border-amber-200 light:bg-amber-50 light:text-amber-800">
      <Clock3 className="h-3.5 w-3.5" />
      <span>
        Your free trial has <strong>{entitlement.daysRemaining} day{entitlement.daysRemaining === 1 ? "" : "s"}</strong> remaining.
      </span>
      <Link href="/home#pricing" className="font-bold underline decoration-amber-400/60 underline-offset-2 hover:text-white light:hover:text-amber-950">
        View plans
      </Link>
    </div>
  );
}

