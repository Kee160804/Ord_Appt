"use client";

import { TopBar } from "@/app/components/TopBar";
import { SettingsView } from "@/app/components/SettingsView";
import { useAuth } from "@/app/contexts/auth";
import { getTenantById } from "@/app/lib/data";

export default function SettingsPage() {
  const { user } = useAuth();
  const tenant = getTenantById(user?.tenantId ?? "");
  if (!tenant) return null;

  return (
    <>
      <TopBar title="Settings" />
      <SettingsView tenant={tenant} />
    </>
  );
}