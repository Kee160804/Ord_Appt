"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/contexts/auth";
import { TopBar } from "@/app/components/TopBar";
import { DashboardOverview } from "@/app/components/DashboardOverview";

export default function DashboardPage() {
  const { user, tenant, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#070b14] light:bg-white">
        <div className="text-white light:text-gray-900">Loading dashboard...</div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect via useEffect
  }

  if (!tenant) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#070b14] light:bg-white">
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
