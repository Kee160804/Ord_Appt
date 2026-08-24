"use client";

import { TopBar } from "@/app/components/TopBar";
import { OrdersView } from "@/app/components/OrdersView";
import { useAuth } from "@/app/contexts/auth";

export default function OrdersPage() {
  const { tenant } = useAuth();
  if (!tenant) return null;

  return (
    <>
      <TopBar title="Orders" />
      <OrdersView tenant={tenant} />
    </>
  );
}
