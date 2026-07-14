"use client";

import { TopBar } from "@/app/components/TopBar";
import { AppointmentsView } from "@/app/components/AppointmentsView";
import { useAuth } from "@/app/contexts/auth";
import { getTenantById } from "@/app/lib/data";

export default function AppointmentsPage() {
  const { user } = useAuth();
  const tenant = getTenantById(user?.tenantId ?? "");
  if (!tenant) return null;

  return (
    <>
      <TopBar title="Appointments" />
      <AppointmentsView tenant={tenant} />
    </>
  );
}