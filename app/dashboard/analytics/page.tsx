"use client";

import { TopBar } from "@/app/components/TopBar";
import { AnalyticsView } from "@/app/components/AnalyticsView";
import { useAuth } from "@/app/contexts/auth";

export default function AnalyticsPage() {
  const { tenant } = useAuth();
  if (!tenant) return null;

  return (
    <>
      <TopBar title="Analytics" />
      <AnalyticsView tenant={tenant} />
    </>
  );
}
