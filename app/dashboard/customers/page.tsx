"use client";

import { useState } from "react";
import { TopBar } from "@/app/components/TopBar";
import { CustomersView } from "@/app/components/CustomersView";
import { useAuth } from "@/app/contexts/auth";

export default function CustomersPage() {
  const { tenant } = useAuth();
  const [search, setSearch] = useState("");
  if (!tenant) return null;

  return (
    <>
      <TopBar
        title="Customers"
        searchValue={search}
        searchPlaceholder="Search customers..."
        onSearchChange={setSearch}
      />
      <CustomersView tenant={tenant} searchInput={search} />
    </>
  );
}
