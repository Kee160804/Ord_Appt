"use client";

import { TopBar } from "@/app/components/TopBar";
import { ServicesView } from "@/app/components/ServicesView";
import { useAuth } from "@/app/contexts/auth";
import { getTenantById } from "@/app/lib/data";

export default function ServicesPage() {
  const { user } = useAuth();
  const tenant = getTenantById(user?.tenantId ?? "");
  if (!tenant) return null;

  return (
    <>
      <TopBar title="Services" />
      <ServicesView tenant={tenant} />
    </>
  );
}