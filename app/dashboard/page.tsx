"use client";
import { useAuth } from "@/app/contexts/auth";
import { TopBar } from "@/app/components/TopBar";
import { DashboardOverview } from "@/app/components/DashboardOverview";

export default function DashboardPage() {
  const { user, tenant, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#070b14] light:bg-white">
        <div className="text-white light:text-gray-900">
          Loading dashboard...
        </div>
      </div>
    );
  }

  if (!user) {
    // DashboardLayout owns authentication redirects for every dashboard page.
    return null;
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
        subtitle={`${tenant.name} — ${tenant.businessType === "appointment" ? "Appointment" : tenant.businessType === "retail" ? "Retail" : "Ordering"} Business`}
      />
      <DashboardOverview tenant={tenant} />
    </>
  );
}
