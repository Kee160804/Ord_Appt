"use client";

import { TopBar } from "@/app/components/TopBar";
import { OrdersView } from "@/app/components/OrdersView";
import { useAuth } from "@/app/contexts/auth";
import { getTenantById } from "@/app/lib/data";

export default function OrdersPage() {
  const { user } = useAuth();
  const tenant = getTenantById(user?.tenantId ?? "");
  if (!tenant) return null;

  return (
    <>
      <TopBar title="Orders" />
      <OrdersView tenant={tenant} />
    </>
  );
}