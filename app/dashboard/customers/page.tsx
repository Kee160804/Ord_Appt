"use client";

import { TopBar } from "@/app/components/TopBar";
import { CustomersView } from "@/app/components/CustomersView";
import { useAuth } from "@/app/contexts/auth";

export default function CustomersPage() {
  const { tenant } = useAuth();
  if (!tenant) return null;

  return (
    <>
      <TopBar title="Customers" />
      <CustomersView tenant={tenant} />
    </>
  );
}
