"use client";

import { TopBar } from "@/app/components/TopBar";
import { AppointmentsView } from "@/app/components/AppointmentsView";
import { useAuth } from "@/app/contexts/auth";

export default function AppointmentsPage() {
  const { tenant } = useAuth();
  if (!tenant) return null;

  return (
    <>
      <TopBar title="Appointments" />
      <AppointmentsView tenant={tenant} />
    </>
  );
}
