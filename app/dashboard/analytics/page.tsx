"use client";

import { TopBar } from "@/app/components/TopBar";
import { AnalyticsView } from "@/app/components/AnalyticsView";
import { useAuth } from "@/app/contexts/auth";
import { PlanFeatureRequired } from "@/app/components/PlanFeatureRequired";
import { tenantHasFeature } from "@/app/lib/plans";

export default function AnalyticsPage() {
  const { tenant } = useAuth();
  if (!tenant) return null;

  if (!tenantHasFeature(tenant, "detailed_analytics")) {
    return (
      <>
        <TopBar title="Analytics" />
        <PlanFeatureRequired
          feature="detailed_analytics"
          title="Detailed analytics are a Pro feature"
          description="Your overview still shows essential business totals. Upgrade to unlock deeper revenue, customer, and performance reporting."
        />
      </>
    );
  }

  return (
    <>
      <TopBar title="Analytics" />
      <AnalyticsView tenant={tenant} />
    </>
  );
}
