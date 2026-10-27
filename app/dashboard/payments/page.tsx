"use client";

import { PaymentFulfillmentView } from "@/app/components/PaymentFulfillmentView";
import { TopBar } from "@/app/components/TopBar";
import { useAuth } from "@/app/contexts/auth";

export default function PaymentsPage() {
  const { tenant, user } = useAuth();
  if (!tenant || !user) return null;
  return (
    <>
      <TopBar title="Customer Payments & Fulfillment" />
      <PaymentFulfillmentView tenant={tenant} />
    </>
  );
}
