"use client";

import { TopBar } from "@/app/components/TopBar";
import { AppointmentsView } from "@/app/components/AppointmentsView";
import { useAuth } from "@/app/contexts/auth";
import { mockTenants } from "@/app/data/mock";

export default function AppointmentsPage() {
  const { user } = useAuth();
  const tenant = mockTenants.find(t => t.id === user?.tenantId)!;

  return (
    <>
      <TopBar title="Appointments" />
      <AppointmentsView tenant={tenant} />
    </>
  );
}