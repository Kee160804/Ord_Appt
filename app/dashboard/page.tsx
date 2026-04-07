"use client";
import { useAuth } from "@/app/contexts/auth";
// NEW: Import useRealtime to find dynamic tenants created via signup
import { useRealtime } from "@/app/contexts/realtime";
import { TopBar } from "@/app/components/TopBar";
import { DashboardOverview } from "@/app/components/DashboardOverview";
import { mockTenants } from "@/app/data/mock";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

export default function DashboardPage() {
  const { user, isLoading } = useAuth();
  // NEW: Get dynamic tenants from realtime context
  const realtime = useRealtime();
  // ENHANCED: Get dynamic tenants and combine with mock tenants
  const dynamicTenants = useMemo(() => realtime.getTenantTenants(), [realtime]);
  const allTenants = useMemo(() => [...mockTenants, ...dynamicTenants], [dynamicTenants]);
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#070b14] light:bg-white">
        <div className="text-white light:text-gray-900">Loading dashboard...</div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect via useEffect
  }

  // ENHANCED: Find tenant from both mock and dynamic tenants
  const tenant = allTenants.find(t => t.id === user.tenantId);

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#070b14] light:bg-white">
        <div className="text-white light:text-gray-900">Tenant not found</div>
      </div>
    );
  }

  return (
    <>
      <TopBar
        title="Dashboard"
        subtitle={`${tenant.name} — ${tenant.businessType === "appointment" ? "Appointment" : "Ordering"} Business`}
      />
      <DashboardOverview tenant={tenant} />
    </>
  );
}