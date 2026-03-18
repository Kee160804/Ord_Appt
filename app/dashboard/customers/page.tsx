// "use client";

// import { TopBar } from "@/app/components/TopBar";
// import { CustomersView } from "@/app/components/CustomersView";
// import { useAuth } from "@/app/contexts/auth";
// import { mockTenants } from "@/app/data/mock";

// export default function CustomersPage() {
//   const { user } = useAuth();
//   const tenant = mockTenants.find(t => t.id === user?.tenantId)!;

//   return (
//     <>
//       <TopBar title="Customers" />
//       <CustomersView tenant={tenant} />
//     </>
//   );
// }




"use client";

import { TopBar } from "@/app/components/TopBar";
import { CustomersView } from "@/app/components/CustomersView";
import { useAuth } from "@/app/contexts/auth";
import { mockTenants } from "@/app/data/mock";

export default function CustomersPage() {
  const { user } = useAuth();
  const tenant = mockTenants.find(t => t.id === user?.tenantId)!;

  return (
    <>
      <TopBar title="Customers" />
      <CustomersView tenant={tenant} />
    </>
  );
}