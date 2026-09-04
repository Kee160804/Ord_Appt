"use client";

import { BusinessToolsView } from "@/app/components/BusinessToolsView";
import { TopBar } from "@/app/components/TopBar";
import { useAuth } from "@/app/contexts/auth";

export default function BusinessToolsPage() {
  const { tenant, user } = useAuth();
  if (!tenant || !user || user.role !== "owner") return null;
  return (
    <>
      <TopBar title="Business Tools" />
      <BusinessToolsView tenant={tenant} />
    </>
  );
}
