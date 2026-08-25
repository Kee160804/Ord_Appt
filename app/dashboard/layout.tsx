"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/app/components/Sidebar";
import { useAuth } from "@/app/contexts/auth";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, tenant, isLoading } = useAuth();
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

  if (!tenant) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8fafc] dark:bg-[#08111f]">
      <Sidebar tenant={tenant} user={user} />
      <main className="flex-1 min-w-0 overflow-y-auto bg-[#f8fafc] text-[#14213a] dark:bg-[#08111f] dark:text-white">
        {children}
      </main>
    </div>
  );
}
