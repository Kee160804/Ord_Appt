// "use client";

// import { useEffect } from "react";
// import { useRouter } from "next/navigation";
// import { Sidebar } from "@/app/components/Sidebar";
// import { useAuth } from "@/app/contexts/auth";
// import { mockTenants, mockUsers } from "@/app/data/mock";

// export default function DashboardLayout({ children }: { children: React.ReactNode }) {
//   const { user, isLoading } = useAuth();
//   const router = useRouter();

//   useEffect(() => {
//     if (!isLoading && !user) {
//       router.push("/login");
//     }
//     // If user is superadmin, redirect to admin panel
//     if (user?.role === "superadmin") {
//       router.push("/admin");
//     }
//   }, [user, isLoading, router]);

//   if (isLoading || !user) {
//     return <div className="flex items-center justify-center h-screen">Loading...</div>;
//   }

//   // Find the tenant for this user (if any)
//   const tenant = mockTenants.find(t => t.id === user.tenantId) || null;

//   // For superadmin, tenant might be null; but we already redirect, so this layout won't render for superadmin.
//   if (!tenant) return null;

//   return (
//     <div className="flex h-screen overflow-hidden bg-slate-50">
//       <Sidebar tenant={tenant} user={user} />
//       <main className="flex-1 overflow-y-auto">{children}</main>
//     </div>
//   );
// }








// "use client";

// import { useEffect } from "react";
// import { useRouter } from "next/navigation";
// import { Sidebar } from "@/app/components/Sidebar";
// import { useAuth } from "@/app/contexts/auth";
// import { mockTenants, mockUsers } from "@/app/data/mock";

// export default function DashboardLayout({ children }: { children: React.ReactNode }) {
//   const { user, isLoading } = useAuth();
//   const router = useRouter();

//   useEffect(() => {
//     if (!isLoading && !user) {
//       router.push("/login");
//     }
//     // If user is superadmin, redirect to admin panel
//     if (user?.role === "superadmin") {
//       router.push("/admin");
//     }
//   }, [user, isLoading, router]);

//   if (isLoading || !user) {
//     return <div className="flex items-center justify-center h-screen">Loading...</div>;
//   }

//   // Find the tenant for this user (if any)
//   const tenant = mockTenants.find(t => t.id === user.tenantId) || null;

//   // For superadmin, tenant might be null; but we already redirect, so this layout won't render for superadmin.
//   if (!tenant) return null;

//   return (
//     <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-[#070b14]">
//       <Sidebar tenant={tenant} user={user} />
//       {/* Main content area – now theme‑aware */}
//       <main className="flex-1 overflow-y-auto bg-[#0a0f1a] light:bg-white text-white light:text-gray-900">
//         {children}
//       </main>
//     </div>
//   );
// }

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/app/components/Sidebar";
import { useAuth } from "@/app/contexts/auth";
import { mockTenants } from "@/app/data/mock";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
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

  const tenant = mockTenants.find(t => t.id === user.tenantId) || null;
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