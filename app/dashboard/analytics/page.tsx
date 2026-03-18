// "use client";

// import { TopBar } from "@/app/components/TopBar";
// import { AnalyticsView } from "@/app/components/AnalyticsView";
// import { useAuth } from "@/app/contexts/auth";
// import { mockTenants } from "@/app/data/mock";

// export default function AnalyticsPage() {
//   const { user } = useAuth();
//   const tenant = mockTenants.find(t => t.id === user?.tenantId)!;

//   return (
//     <>
//       <TopBar title="Analytics" />
//       <AnalyticsView tenant={tenant} />
//     </>
//   );
// }




"use client";

import { TopBar } from "@/app/components/TopBar";
import { AnalyticsView } from "@/app/components/AnalyticsView";
import { useAuth } from "@/app/contexts/auth";
import { mockTenants } from "@/app/data/mock";

export default function AnalyticsPage() {
  const { user } = useAuth();
  const tenant = mockTenants.find(t => t.id === user?.tenantId)!;

  return (
    <>
      <TopBar title="Analytics" />
      <AnalyticsView tenant={tenant} />
    </>
  );
}