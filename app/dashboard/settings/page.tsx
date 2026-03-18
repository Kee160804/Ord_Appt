// "use client";

// import { TopBar } from "@/app/components/TopBar";
// import { SettingsView } from "@/app/components/SettingsView";
// import { useAuth } from "@/app/contexts/auth";
// import { mockTenants } from "@/app/data/mock";

// export default function SettingsPage() {
//   const { user } = useAuth();
//   const tenant = mockTenants.find(t => t.id === user?.tenantId)!;

//   return (
//     <>
//       <TopBar title="Settings" />
//       <SettingsView tenant={tenant} />
//     </>
//   );
// }



"use client";
import { useAuth } from "@/app/contexts/auth";
import { TopBar } from "@/app/components/TopBar";
import { DashboardOverview } from "@/app/components/DashboardOverview";
import { mockTenants } from "@/app/data/mock";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardPage() {
  const { user, isLoading } = useAuth();
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

  // Find tenant based on user's tenantId
  const tenant = mockTenants.find(t => t.id === user.tenantId);

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