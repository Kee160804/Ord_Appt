import type { Metadata } from "next";

import DashboardShell from "@/app/dashboard/DashboardShell";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <DashboardShell>{children}</DashboardShell>;
}
