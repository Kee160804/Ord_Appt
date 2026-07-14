"use client";

import { TopBar } from "@/app/components/TopBar";
import { AnalyticsView } from "@/app/components/AnalyticsView";
import { useAuth } from "@/app/contexts/auth";
import { getTenantById } from "@/app/lib/data";

export default function AnalyticsPage() {
  const { user } = useAuth();
  const tenant = getTenantById(user?.tenantId ?? "");
  if (!tenant) return null;

  return (
    <>
      <TopBar title="Analytics" />
      <AnalyticsView tenant={tenant} />
    </>
  );
}