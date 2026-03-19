// "use client";

// import { TopBar } from "@/app/components/TopBar";
// import { SettingsView } from "@/app/components/SettingsView";
// import { useAuth } from "@/app/contexts/auth";
// import { mockTenants } from "@/app/data/mock";

// export default function SettingsPage() {
//   const { user } = useAuth();
//   const tenant = mockTenants.find(t => t.id === user?.tenantId)!;

//   return (
//     <>
//       <TopBar title="Settings" />
//       <SettingsView tenant={tenant} />
//     </>
//   );
// }



"use client";

import { TopBar } from "@/app/components/TopBar";
import { SettingsView } from "@/app/components/SettingsView";
import { useAuth } from "@/app/contexts/auth";
import { mockTenants } from "@/app/data/mock";

export default function SettingsPage() {
  const { user } = useAuth();
  const tenant = mockTenants.find(t => t.id === user?.tenantId)!;

  return (
    <>
      <TopBar title="Settings" />
      <SettingsView tenant={tenant} />
    </>
  );
}