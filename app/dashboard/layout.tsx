"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/app/components/Sidebar";
import { useAuth } from "@/app/contexts/auth";
// NEW: Import useRealtime to find dynamic tenants created via signup
import { useRealtime } from "@/app/contexts/realtime";
import { mockTenants } from "@/app/data/mock";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  // NEW: Get dynamic tenants from realtime context
  const realtime = useRealtime();
  const dynamicTenants = useMemo(() => realtime.getTenantTenants(), [realtime]);
  const allTenants = useMemo(() => [...mockTenants, ...dynamicTenants], [dynamicTenants]);
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
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  // ENHANCED: Find tenant from both mock and dynamic tenants
  const tenant = allTenants.find(t => t.id === user.tenantId) || null;
  if (!tenant) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-[#070b14]">
      <Sidebar tenant={tenant} user={user} />
      <main className="flex-1 overflow-y-auto bg-[#0a0f1a] light:bg-white text-white light:text-gray-900">
        {children}
      </main>
    </div>
  );
}