"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/app/components/Sidebar";
import { SubscriptionRequired } from "@/app/components/SubscriptionRequired";
import { TrialStatusBanner } from "@/app/components/TrialStatusBanner";
import { PlanUsageBanner } from "@/app/components/PlanUsageBanner";
import { useAuth } from "@/app/contexts/auth";
import { getTenantEntitlement } from "@/app/lib/subscription";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, tenant, isLoading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
    if (user?.role === "superadmin") {
      router.push("/admin");
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return <div className="flex min-h-dvh items-center justify-center">Loading...</div>;
  }

  if (!tenant) return null;

  const entitlement = getTenantEntitlement(tenant);
  if (!entitlement.hasAccess) {
    return <SubscriptionRequired tenant={tenant} user={user} onLogout={logout} />;
  }

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-[#f8fafc] dark:bg-[#08111f]">
      <Sidebar tenant={tenant} user={user} />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#f8fafc] text-[#14213a] dark:bg-[#08111f] dark:text-white">
        <TrialStatusBanner tenant={tenant} />
        <PlanUsageBanner tenant={tenant} />
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </main>
    </div>
  );
}
