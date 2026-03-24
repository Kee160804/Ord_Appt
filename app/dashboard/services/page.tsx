"use client";

import { TopBar } from "@/app/components/TopBar";
import { ServicesView } from "@/app/components/ServicesView";
import { useAuth } from "@/app/contexts/auth";
import { mockTenants } from "@/app/data/mock";

export default function ServicesPage() {
  const { user } = useAuth();
  const tenant = mockTenants.find(t => t.id === user?.tenantId)!;

  return (
    <>
      <TopBar title="Services" />
      <ServicesView tenant={tenant} />
    </>
  );
}