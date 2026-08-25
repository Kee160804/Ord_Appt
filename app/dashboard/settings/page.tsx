"use client";

import { TopBar } from "@/app/components/TopBar";
import { SettingsView } from "@/app/components/SettingsView";
import { useAuth } from "@/app/contexts/auth";

export default function SettingsPage() {
  const { tenant, updateTenant } = useAuth();
  if (!tenant) return null;

  return (
    <>
      <TopBar title="Settings" />
      <SettingsView tenant={tenant} onTenantUpdated={updateTenant} />
    </>
  );
}
