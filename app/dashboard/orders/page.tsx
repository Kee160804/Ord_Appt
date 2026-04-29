"use client";

import { TopBar } from "@/app/components/TopBar";
import { OrdersView } from "@/app/components/OrdersView";
import { useAuth } from "@/app/contexts/auth";
import { mockTenants } from "@/app/data/mock";

export default function OrdersPage() {
  const { user } = useAuth();
  const tenant = mockTenants.find(t => t.id === user?.tenantId)!;

  return (
    <>
      <TopBar title="Orders" />
      <OrdersView tenant={tenant} />
    </>
  );
}