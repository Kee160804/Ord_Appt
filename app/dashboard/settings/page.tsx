"use client";

import { TopBar } from "@/app/components/TopBar";
import { SettingsView } from "@/app/components/SettingsView";
import { useAuth } from "@/app/contexts/auth";

export default function SettingsPage() {
  const { tenant, user, updateTenant } = useAuth();
  if (!tenant || !user) return null;

  if (user.role !== "owner") {
    return (
      <>
        <TopBar title="Settings" />
        <div className="p-5">
          <div className="mx-auto max-w-lg rounded-2xl border border-slate-700 bg-slate-900/50 p-6 text-sm text-slate-300 light:border-slate-200 light:bg-white light:text-slate-700">
            Business settings and team access are managed by the business owner.
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Settings" />
      <SettingsView tenant={tenant} user={user} onTenantUpdated={updateTenant} />
    </>
  );
}
