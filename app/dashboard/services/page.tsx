"use client";

import { TopBar } from "@/app/components/TopBar";
import { ServicesView } from "@/app/components/ServicesView";
import { useAuth } from "@/app/contexts/auth";

export default function ServicesPage() {
  const { tenant } = useAuth();
  if (!tenant) return null;

  return (
    <>
      <TopBar title="Services" />
      <ServicesView tenant={tenant} />
    </>
  );
}
