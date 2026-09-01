"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/contexts/auth";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "superadmin")) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return <div className="pwa-page-safe flex min-h-dvh items-center justify-center bg-[#070b14] text-white light:bg-white light:text-slate-900">Loading...</div>;
  }

  return (
    <div className="pwa-shell-safe min-h-dvh bg-slate-50 light:bg-white">
      {children}
    </div>
  );
}
