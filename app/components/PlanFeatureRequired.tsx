"use client";

import Link from "next/link";
import { LockKeyhole, Sparkles } from "lucide-react";
import { requiredPlanForFeature, type PlanFeature } from "@/app/lib/plans";

export function PlanFeatureRequired({
  feature,
  title,
  description,
}: {
  feature: PlanFeature;
  title: string;
  description: string;
}) {
  const requiredPlan = requiredPlanForFeature(feature);

  return (
    <div className="m-4 flex min-h-[420px] items-center justify-center rounded-2xl border border-violet-500/25 bg-violet-500/5 p-8 text-center light:border-violet-200 light:bg-violet-50/60 md:m-5">
      <div className="max-w-md">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-400 light:text-violet-700">
          <LockKeyhole className="h-6 w-6" />
        </div>
        <h2 className="mt-5 text-xl font-black text-white light:text-slate-950">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-400 light:text-slate-600">{description}</p>
        <Link href="/home#pricing" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-xs font-bold text-white hover:bg-violet-500">
          <Sparkles className="h-4 w-4" /> Available on {requiredPlan.name}
        </Link>
      </div>
    </div>
  );
}

