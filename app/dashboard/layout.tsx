"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/app/components/Sidebar";
import { SubscriptionRequired } from "@/app/components/SubscriptionRequired";
import { TrialStatusBanner } from "@/app/components/TrialStatusBanner";
import { PlanUsageBanner } from "@/app/components/PlanUsageBanner";
import { useAuth } from "@/app/contexts/auth";
import { getTenantEntitlement } from "@/app/lib/subscription";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, tenant, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isStaffRouteBlocked =
    user?.role === "staff" && tenant
      ? ![
          "/dashboard",
          tenant.businessType === "appointment"
            ? "/dashboard/appointments"
            : "/dashboard/orders",
        ].some(
          (allowedPath) =>
            pathname === allowedPath ||
            (allowedPath !== "/dashboard" &&
              pathname.startsWith(`${allowedPath}/`)),
        )
      : false;
  const isOwnerRouteBlocked = Boolean(
    user &&
    user.role !== "owner" &&
    (pathname.startsWith("/dashboard/settings") ||
      pathname.startsWith("/dashboard/tools")),
  );

  useEffect(() => {
    if (!isLoading && !user) {
      const loginUrl = new URL("/login", window.location.origin);
      loginUrl.searchParams.set("next", "/dashboard");
      router.replace(loginUrl.pathname + loginUrl.search);
      return;
    }

    if (user?.role === "superadmin") {
      const adminUrl = new URL("/admin", window.location.origin);
      router.replace(adminUrl.pathname + adminUrl.search);
      return;
    }

    if (isStaffRouteBlocked || isOwnerRouteBlocked) {
      router.replace("/dashboard");
    }
  }, [user, isLoading, router, isStaffRouteBlocked, isOwnerRouteBlocked]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!tenant) return null;

  if (isStaffRouteBlocked || isOwnerRouteBlocked) return null;

  const entitlement = getTenantEntitlement(tenant);
  if (!entitlement.hasAccess) {
    return (
      <SubscriptionRequired tenant={tenant} user={user} onLogout={logout} />
    );
  }

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-[#f8fafc] dark:bg-[#08111f]">
      <Sidebar tenant={tenant} user={user} />
      <main className="pwa-shell-safe flex min-w-0 flex-1 flex-col overflow-hidden bg-[#f8fafc] text-[#14213a] dark:bg-[#08111f] dark:text-white">
        <TrialStatusBanner tenant={tenant} />
        <PlanUsageBanner tenant={tenant} />
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </main>
    </div>
  );
}
