// "use client";
// import { useState } from "react";
// import {
//   Building2,
//   Clock,
//   Users,
//   CreditCard,
//   Globe,
//   Bell,
//   ChevronRight,
// } from "lucide-react";
// import { Card, CardHeader, CardBody } from "../components/Card";
// import { Button } from "../components/Button";
// import { Input, Textarea } from "../components/input";
// import { getUsersByTenant } from "../data/mock";
// import { cn } from "../lib/utils";
// import type { Tenant } from "../types/index";

// type Tab =
//   | "business"
//   | "hours"
//   | "team"
//   | "payments"
//   | "storefront"
//   | "notifications";

// const TABS: { id: Tab; label: string; icon: typeof Building2 }[] = [
//   { id: "business", label: "Business Info", icon: Building2 },
//   { id: "hours", label: "Business Hours", icon: Clock },
//   { id: "team", label: "Team Members", icon: Users },
//   { id: "payments", label: "Payments", icon: CreditCard },
//   { id: "storefront", label: "Storefront", icon: Globe },
//   { id: "notifications", label: "Notifications", icon: Bell },
// ];

// interface Props {
//   tenant: Tenant;
// }

// export function SettingsView({ tenant }: Props) {
//   const [active, setActive] = useState<Tab>("business");
//   const [hours, setHours] = useState(tenant.businessHours);
//   const users = getUsersByTenant(tenant.id);

//   return (
//     <div className="p-8 space-y-6 bg-[#0a0f1a] light:bg-white min-h-screen text-white light:text-gray-900">
//       <div>
//         <h2 className="text-lg font-bold text-white light:text-gray-900">
//           Settings
//         </h2>
//         <p className="text-sm text-slate-400 light:text-gray-600">
//           Manage your business configuration
//         </p>
//       </div>

//       <div className="grid lg:grid-cols-4 gap-6 items-start">
//         {/* Nav */}
//         <Card className="lg:col-span-1 bg-slate-800/50 light:bg-white border-slate-700 light:border-gray-200">
//           <CardBody className="p-2 space-y-0.5">
//             {TABS.map((tab) => {
//               const Icon = tab.icon;
//               return (
//                 <button
//                   key={tab.id}
//                   onClick={() => setActive(tab.id)}
//                   className={cn(
//                     "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left",
//                     active === tab.id
//                       ? "bg-violet-600 light:bg-violet-100 text-white light:text-violet-900"
//                       : "text-slate-400 light:text-gray-600 hover:bg-slate-700 light:hover:bg-gray-100",
//                   )}
//                 >
//                   <Icon className="w-4 h-4 flex-shrink-0" />
//                   <span className="flex-1">{tab.label}</span>
//                   {active !== tab.id && (
//                     <ChevronRight className="w-3 h-3 text-slate-500 light:text-gray-400" />
//                   )}
//                 </button>
//               );
//             })}
//           </CardBody>
//         </Card>

//         {/* Content */}
//         <div className="lg:col-span-3 space-y-0">
//           {active === "business" && <BusinessTab tenant={tenant} />}
//           {active === "hours" && <HoursTab hours={hours} setHours={setHours} />}
//           {active === "team" && <TeamTab users={users} />}
//           {active === "payments" && <PaymentsTab tenant={tenant} />}
//           {active === "storefront" && <StorefrontTab tenant={tenant} />}
//           {active === "notifications" && <NotificationsTab />}
//         </div>
//       </div>
//     </div>
//   );
// }

// // ── Tabs ──────────────────────────────────────────────────────

// function BusinessTab({ tenant }: { tenant: Tenant }) {
//   return (
//     <Card className="bg-slate-800/50 light:bg-white border-slate-700 light:border-gray-200">
//       <CardHeader>
//         <h3 className="font-semibold text-white light:text-gray-900">
//           Business Information
//         </h3>
//       </CardHeader>
//       <CardBody className="space-y-5">
//         <div className="flex items-center gap-4">
//           <div
//             className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-xl flex-shrink-0"
//             style={{ backgroundColor: tenant.logoBg }}
//           >
//             {tenant.logo}
//           </div>
//           <div>
//             <Button
//               variant="outline"
//               size="sm"
//               className="border-slate-600 light:border-gray-300 text-white light:text-gray-800 hover:bg-slate-700 light:hover:bg-gray-100"
//             >
//               Upload Logo
//             </Button>
//             <p className="text-xs text-slate-400 light:text-gray-600 mt-1">
//               PNG or JPG, up to 2 MB
//             </p>
//           </div>
//         </div>
//         <div className="grid grid-cols-2 gap-4">
//           <Input
//             label="Business Name"
//             defaultValue={tenant.name}
//             className="col-span-2"
//           />
//           <Textarea
//             label="Description"
//             defaultValue={tenant.description}
//             rows={3}
//             className="col-span-2"
//           />
//           <Input label="Phone" defaultValue={tenant.phone} />
//           <Input label="Email" type="email" defaultValue={tenant.email} />
//           <Input label="Address" defaultValue={tenant.address} />
//           <Input label="City" defaultValue={tenant.city} />
//         </div>
//         <Button className="bg-violet-600 hover:bg-violet-500 light:bg-violet-600 light:hover:bg-violet-700 text-white">
//           Save Changes
//         </Button>
//       </CardBody>
//     </Card>
//   );
// }

// function HoursTab({
//   hours,
//   setHours,
// }: {
//   hours: Tenant["businessHours"];
//   setHours: React.Dispatch<React.SetStateAction<Tenant["businessHours"]>>;
// }) {
//   return (
//     <Card className="bg-slate-800/50 light:bg-white border-slate-700 light:border-gray-200">
//       <CardHeader>
//         <h3 className="font-semibold text-white light:text-gray-900">
//           Business Hours
//         </h3>
//       </CardHeader>
//       <CardBody className="space-y-3">
//         {hours.map((day, i) => (
//           <div key={day.day} className="flex items-center gap-4">
//             <span className="text-sm font-medium text-white light:text-gray-700 w-24 flex-shrink-0">
//               {day.day}
//             </span>
//             <input
//               type="checkbox"
//               checked={!day.closed}
//               className="w-4 h-4 accent-violet-600"
//               onChange={() =>
//                 setHours((prev) =>
//                   prev.map((d, idx) =>
//                     idx === i ? { ...d, closed: !d.closed } : d,
//                   ),
//                 )
//               }
//             />
//             {day.closed ? (
//               <span className="text-sm text-slate-400 light:text-gray-600">
//                 Closed
//               </span>
//             ) : (
//               <div className="flex items-center gap-2">
//                 <input
//                   title="Opening Time"
//                   type="time"
//                   defaultValue={day.open}
//                   className="px-2 py-1.5 bg-slate-700 light:bg-white border border-slate-600 light:border-gray-300 rounded-xl text-sm text-white light:text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
//                 />
//                 <span className="text-slate-400 light:text-gray-600">–</span>
//                 <input
//                   title="Closing Time"
//                   type="time"
//                   defaultValue={day.close}
//                   className="px-2 py-1.5 bg-slate-700 light:bg-white border border-slate-600 light:border-gray-300 rounded-xl text-sm text-white light:text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
//                 />
//               </div>
//             )}
//           </div>
//         ))}
//         <div className="pt-2">
//           <Button className="bg-violet-600 hover:bg-violet-500 light:bg-violet-600 light:hover:bg-violet-700 text-white">
//             Save Hours
//           </Button>
//         </div>
//       </CardBody>
//     </Card>
//   );
// }

// function TeamTab({ users }: { users: ReturnType<typeof getUsersByTenant> }) {
//   return (
//     <Card className="bg-slate-800/50 light:bg-white border-slate-700 light:border-gray-200">
//       <CardHeader className="flex justify-between items-center">
//         <h3 className="font-semibold text-white light:text-gray-900">
//           Team Members
//         </h3>
//         <Button
//           size="sm"
//           className="bg-violet-600 hover:bg-violet-500 light:bg-violet-600 light:hover:bg-violet-700 text-white"
//         >
//           <span>Invite Member</span>
//         </Button>
//       </CardHeader>
//       <div className="divide-y divide-slate-700 light:divide-slate-100">
//         {users.map((u) => (
//           <div key={u.id} className="px-6 py-4 flex items-center gap-4">
//             <div className="w-10 h-10 rounded-full bg-violet-600 light:bg-violet-300 flex items-center justify-center text-white light:text-violet-900 text-xs font-bold flex-shrink-0">
//               {u.avatar}
//             </div>
//             <div className="flex-1 min-w-0">
//               <p className="text-sm font-semibold text-white light:text-gray-900">
//                 {u.name}
//               </p>
//               <p className="text-xs text-slate-400 light:text-gray-600">
//                 {u.email}
//               </p>
//             </div>
//             <span
//               className={cn(
//                 "text-xs font-semibold px-2.5 py-1 rounded-full capitalize",
//                 u.role === "owner"
//                   ? "bg-violet-500/20 light:bg-violet-100 text-violet-400 light:text-violet-700"
//                   : u.role === "admin"
//                     ? "bg-blue-500/20 light:bg-blue-100 text-blue-400 light:text-blue-700"
//                     : "bg-slate-700 light:bg-slate-200 text-slate-300 light:text-slate-600",
//               )}
//             >
//               {u.role}
//             </span>
//           </div>
//         ))}
//       </div>
//     </Card>
//   );
// }

// function PaymentsTab({ tenant }: { tenant: Tenant }) {
//   return (
//     <Card className="bg-slate-800/50 light:bg-white border-slate-700 light:border-gray-200">
//       <CardHeader>
//         <h3 className="font-semibold text-white light:text-gray-900">
//           Payment Settings
//         </h3>
//       </CardHeader>
//       <CardBody className="space-y-5">
//         <div
//           className={cn(
//             "flex items-center justify-between p-4 rounded-xl border",
//             tenant.stripeConnected
//               ? "bg-emerald-500/20 light:bg-emerald-50 border-emerald-500/30 light:border-emerald-200"
//               : "bg-amber-500/20 light:bg-amber-50 border-amber-500/30 light:border-amber-200",
//           )}
//         >
//           <div className="flex items-center gap-3">
//             <div
//               className={cn(
//                 "w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg",
//                 tenant.stripeConnected
//                   ? "bg-emerald-500/30 light:bg-emerald-200 text-emerald-400 light:text-emerald-700"
//                   : "bg-amber-500/30 light:bg-amber-200 text-amber-400 light:text-amber-700",
//               )}
//             >
//               S
//             </div>
//             <div>
//               <p className="text-sm font-semibold text-white light:text-gray-900">
//                 Stripe
//               </p>
//               <p
//                 className={cn(
//                   "text-xs",
//                   tenant.stripeConnected
//                     ? "text-emerald-400 light:text-emerald-600"
//                     : "text-amber-400 light:text-amber-600",
//                 )}
//               >
//                 {tenant.stripeConnected ? "Connected & ready" : "Not connected"}
//               </p>
//             </div>
//           </div>
//           <Button
//             variant={tenant.stripeConnected ? "outline" : "primary"}
//             size="sm"
//             className={
//               tenant.stripeConnected
//                 ? "border-slate-600 light:border-gray-300 text-white light:text-gray-800 hover:bg-slate-700 light:hover:bg-gray-100"
//                 : "bg-violet-600 hover:bg-violet-500 light:bg-violet-600 light:hover:bg-violet-700 text-white"
//             }
//           >
//             {tenant.stripeConnected ? "Manage" : "Connect Stripe"}
//           </Button>
//         </div>

//         {tenant.businessType === "appointment" && (
//           <div className="space-y-3">
//             <p className="text-sm font-semibold text-white light:text-gray-700">
//               Deposit Settings
//             </p>
//             <div className="flex items-center gap-3 p-3 bg-slate-700 light:bg-gray-100 rounded-xl">
//               <input
//                 type="checkbox"
//                 id="req-deposit"
//                 className="w-4 h-4 accent-violet-600"
//               />
//               <label
//                 htmlFor="req-deposit"
//                 className="text-sm text-slate-300 light:text-gray-700"
//               >
//                 Require deposit for all bookings by default
//               </label>
//             </div>
//             <div className="grid grid-cols-2 gap-3">
//               <Input label="Deposit Type" />
//               <Input label="Amount" type="number" placeholder="25" />
//             </div>
//           </div>
//         )}
//         <Button className="bg-violet-600 hover:bg-violet-500 light:bg-violet-600 light:hover:bg-violet-700 text-white">
//           Save Payment Settings
//         </Button>
//       </CardBody>
//     </Card>
//   );
// }

// function StorefrontTab({ tenant }: { tenant: Tenant }) {
//   return (
//     <Card className="bg-slate-800/50 light:bg-white border-slate-700 light:border-gray-200">
//       <CardHeader>
//         <h3 className="font-semibold text-white light:text-gray-900">
//           Storefront Settings
//         </h3>
//       </CardHeader>
//       <CardBody className="space-y-4">
//         <div>
//           <label className="block text-sm font-medium text-slate-300 light:text-gray-700 mb-1.5">
//             Storefront URL
//           </label>
//           <div className="flex items-center">
//             <span className="text-sm text-slate-400 light:text-gray-600 bg-slate-700 light:bg-gray-100 border border-slate-600 light:border-gray-300 rounded-l-xl px-3 py-2.5 border-r-0 whitespace-nowrap">
//               platform.com/
//             </span>
//             <input
//               title="Storefront Slug"
//               defaultValue={tenant.slug}
//               className="flex-1 px-4 py-2.5 bg-slate-700 light:bg-white border border-slate-600 light:border-gray-300 rounded-r-xl text-sm text-white light:text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
//             />
//           </div>
//         </div>
//         <Input label="Cover Image URL" defaultValue={tenant.coverImage} />
//         <div className="grid grid-cols-2 gap-3">
//           <div>
//             <label className="block text-sm font-medium text-slate-300 light:text-gray-700 mb-1.5">
//               Primary Colour
//             </label>
//             <div className="flex items-center gap-2">
//               <input
//                 title="Primary Colour"
//                 type="color"
//                 defaultValue={tenant.primaryColor}
//                 className="w-10 h-10 rounded-xl border border-slate-600 light:border-gray-300 cursor-pointer p-1 bg-transparent"
//               />
//               <input
//                 title="Primary Colour"
//                 defaultValue={tenant.primaryColor}
//                 className="flex-1 px-3 py-2 bg-slate-700 light:bg-white border border-slate-600 light:border-gray-300 rounded-xl text-sm text-white light:text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
//               />
//             </div>
//           </div>
//           <div>
//             <label className="block text-sm font-medium text-slate-300 light:text-gray-700 mb-1.5">
//               Accent Colour
//             </label>
//             <div className="flex items-center gap-2">
//               <input
//                 title="Accent Colour"
//                 type="color"
//                 defaultValue={tenant.accentColor}
//                 className="w-10 h-10 rounded-xl border border-slate-600 light:border-gray-300 cursor-pointer p-1 bg-transparent"
//               />
//               <input
//                 title="Accent Colour"
//                 defaultValue={tenant.accentColor}
//                 className="flex-1 px-3 py-2 bg-slate-700 light:bg-white border border-slate-600 light:border-gray-300 rounded-xl text-sm text-white light:text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
//               />
//             </div>
//           </div>
//         </div>
//         <Button className="bg-violet-600 hover:bg-violet-500 light:bg-violet-600 light:hover:bg-violet-700 text-white">
//           Save Storefront
//         </Button>
//       </CardBody>
//     </Card>
//   );
// }

// function NotificationsTab() {
//   const NOTIFS = [
//     {
//       label: "New booking received",
//       detail: "Notify when a customer books an appointment",
//       on: true,
//     },
//     {
//       label: "Booking cancelled",
//       detail: "Alert when an appointment is cancelled",
//       on: true,
//     },
//     {
//       label: "Payment received",
//       detail: "Notify on successful payment",
//       on: true,
//     },
//     {
//       label: "Daily summary",
//       detail: "Receive a daily digest of business activity",
//       on: false,
//     },
//     {
//       label: "Low inventory alert",
//       detail: "Alert when product stock drops below limit",
//       on: false,
//     },
//   ];

//   const [states, setStates] = useState(NOTIFS.map((n) => n.on));

//   return (
//     <Card className="bg-slate-800/50 light:bg-white border-slate-700 light:border-gray-200">
//       <CardHeader>
//         <h3 className="font-semibold text-white light:text-gray-900">
//           Notification Preferences
//         </h3>
//       </CardHeader>
//       <div className="divide-y divide-slate-700 light:divide-slate-100">
//         {NOTIFS.map((n, i) => (
//           <div
//             key={i}
//             className="px-6 py-4 flex items-center justify-between gap-4"
//           >
//             <div>
//               <p className="text-sm font-semibold text-white light:text-gray-900">
//                 {n.label}
//               </p>
//               <p className="text-xs text-slate-400 light:text-gray-600 mt-0.5">
//                 {n.detail}
//               </p>
//             </div>
//             <button
//               title="Toggle Notification"
//               onClick={() =>
//                 setStates((prev) => prev.map((s, j) => (j === i ? !s : s)))
//               }
//               className={cn(
//                 "relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0",
//                 states[i]
//                   ? "bg-violet-600 light:bg-violet-500"
//                   : "bg-slate-600 light:bg-gray-300",
//               )}
//             >
//               <span
//                 className={cn(
//                   "inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform",
//                   states[i] ? "translate-x-6" : "translate-x-1",
//                 )}
//               />
//             </button>
//           </div>
//         ))}
//       </div>
//     </Card>
//   );
// }

























"use client";
import { useEffect, useRef, useState } from "react";
import {
  Building2,
  Clock,
  Globe,
  ChevronRight,
  ImageIcon,
  Upload,
  Users,
  X,
} from "lucide-react";
import { Card, CardHeader, CardBody } from "../components/Card";
import { Button } from "../components/Button";
import { Input, Textarea } from "../components/input";
import { cn } from "../lib/utils";
import { tenantHasFeature } from "../lib/plans";
import { PlanFeatureRequired } from "./PlanFeatureRequired";
import { TeamAccessView } from "./TeamAccessView";
import {
  updateBusinessDetails,
  updateBusinessHours,
  deleteStorefrontCoverImage,
  updateStorefrontSettings,
  uploadStorefrontCoverImage,
  validateStorefrontCoverImage,
} from "../services/settingsService";
import type { Tenant, User } from "../types/index";

type Tab =
  | "business"
  | "hours"
  | "team"
  | "payments"
  | "storefront"
  | "notifications";

const TABS: { id: Tab; label: string; icon: typeof Building2 }[] = [
  { id: "business", label: "Business Info", icon: Building2 },
  { id: "hours", label: "Business Hours", icon: Clock },
  { id: "team", label: "Team & Access", icon: Users },
  { id: "storefront", label: "Storefront", icon: Globe },
];

interface Props {
  tenant: Tenant;
  user: User;
  onTenantUpdated: (tenant: Tenant) => void;
}
export function SettingsView({ tenant, user, onTenantUpdated }: Props) {
  const [active, setActive] = useState<Tab>("business");
  const [hours, setHours] = useState(tenant.businessHours);
  return (
    <div className="min-h-full space-y-4 bg-[#08111f] light:bg-[#f8fafc] p-4 text-white light:text-[#14213a] md:p-5">
      <div className="sr-only">
        <h2 className="text-sm font-bold text-white light:text-[#17223a]">
          Settings
        </h2>
        <p className="text-sm text-slate-400 light:text-gray-600">
          Manage your business configuration
        </p>
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-4">
        {/* Nav */}
        <Card className="lg:col-span-1">
          <CardBody className="p-2 space-y-0.5">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActive(tab.id)}
                  className={cn(
                    "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-[10px] font-medium transition-colors",
                    active === tab.id
                      ? "bg-violet-600 text-white shadow-sm"
                      : "text-slate-400 light:text-gray-600 hover:bg-slate-700 light:hover:bg-gray-100",
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1">{tab.label}</span>
                  {active !== tab.id && (
                    <ChevronRight className="w-3 h-3 text-slate-500 light:text-gray-400" />
                  )}
                </button>
              );
            })}
          </CardBody>
        </Card>

        {/* Content */}
        <div className="lg:col-span-3 space-y-0">
          {active === "business" && (
            <BusinessTab tenant={tenant} onTenantUpdated={onTenantUpdated} />
          )}
          {active === "hours" && (
            <HoursTab
              tenant={tenant}
              hours={hours}
              setHours={setHours}
              onTenantUpdated={onTenantUpdated}
            />
          )}
          {active === "team" && (
            user.role === "owner"
              ? <TeamAccessView tenant={tenant} />
              : <Card><CardBody><p className="text-sm text-slate-400 light:text-slate-600">Only the business owner can manage team access.</p></CardBody></Card>
          )}
          {active === "storefront" && (
            tenantHasFeature(tenant, "storefront_branding")
              ? <StorefrontTab tenant={tenant} onTenantUpdated={onTenantUpdated} />
              : <PlanFeatureRequired
                  feature="storefront_branding"
                  title="Storefront branding controls are a Pro feature"
                  description="Your storefront remains published on Beginner with its current design. Upgrade to change its URL, cover image, and brand colours."
                />
          )}
        </div>
      </div>
    </div>
  );
}
// ── Tabs ──────────────────────────────────────────────────────

function BusinessTab({
  tenant,
  onTenantUpdated,
}: {
  tenant: Tenant;
  onTenantUpdated: (tenant: Tenant) => void;
}) {
  const [form, setForm] = useState({
    name: tenant.name,
    description: tenant.description,
    phone: tenant.phone,
    email: tenant.email,
    address: tenant.address,
    city: tenant.city,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const save = async () => {
    setIsSaving(true);
    setError("");
    setSuccess("");

    try {
      const saved = await updateBusinessDetails(tenant.id, form);
      onTenantUpdated({ ...tenant, ...saved });
      setSuccess("Business information saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save business information.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <h3 className="text-xs font-bold text-white light:text-[#17223a]">
          Business Information
        </h3>
      </CardHeader>
      <CardBody className="space-y-5">
        <div className="flex items-center gap-4">
          <div
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg text-sm font-black text-white"
            style={{ backgroundColor: tenant.logoBg }}
          >
            {tenant.logo}
          </div>
          <p className="text-[10px] text-slate-400 light:text-[#71809a]">
            Your business initial is used until image uploads are enabled.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Business Name"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            className="col-span-2"
          />
          <Textarea
            label="Description"
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({ ...current, description: event.target.value }))
            }
            rows={3}
            className="col-span-2"
          />
          <Input
            label="Phone"
            value={form.phone}
            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          />
          <Input
            label="Address"
            value={form.address}
            onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
          />
          <Input
            label="City"
            value={form.city}
            onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {success && <p className="text-sm text-emerald-400">{success}</p>}
        <Button
          type="button"
          loading={isSaving}
          onClick={save}
          className="bg-violet-600 hover:bg-violet-500 light:bg-violet-600 light:hover:bg-violet-700 text-white"
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </CardBody>
    </Card>
  );
}

function HoursTab({
  tenant,
  hours,
  setHours,
  onTenantUpdated,
}: {
  tenant: Tenant;
  hours: Tenant["businessHours"];
  setHours: React.Dispatch<React.SetStateAction<Tenant["businessHours"]>>;
  onTenantUpdated: (tenant: Tenant) => void;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const save = async () => {
    setIsSaving(true);
    setError("");
    setSuccess("");
    try {
      await updateBusinessHours(tenant.id, hours);
      onTenantUpdated({ ...tenant, businessHours: hours });
      setSuccess("Business hours saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save business hours.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <h3 className="text-xs font-bold text-white light:text-[#17223a]">
          Business Hours
        </h3>
      </CardHeader>
      <CardBody className="space-y-3">
        {hours.map((day, i) => (
          <div key={day.day} className="flex items-center gap-4">
            <span className="w-24 flex-shrink-0 text-xs font-medium text-white light:text-[#566681]">
              {day.day}
            </span>
            <input
              type="checkbox"
              checked={!day.closed}
              className="w-4 h-4 accent-violet-600"
              onChange={() =>
                setHours((prev) =>
                  prev.map((d, idx) =>
                    idx === i ? { ...d, closed: !d.closed } : d,
                  ),
                )
              }
            />
            {day.closed ? (
              <span className="text-sm text-slate-400 light:text-gray-600">
                Closed
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={day.open}
                  aria-label="Opening time"
                  onChange={(event) =>
                    setHours((current) =>
                      current.map((candidate, index) =>
                        index === i ? { ...candidate, open: event.target.value } : candidate,
                      ),
                    )
                  }
                  className="px-2 py-1.5 bg-slate-700 light:bg-white border border-slate-600 light:border-gray-300 rounded-xl text-sm text-white light:text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                />
                <span className="text-slate-400 light:text-gray-600">–</span>
                <input
                  type="time"
                  value={day.close}
                  aria-label="Closing time"
                  onChange={(event) =>
                    setHours((current) =>
                      current.map((candidate, index) =>
                        index === i ? { ...candidate, close: event.target.value } : candidate,
                      ),
                    )
                  }
                  className="px-2 py-1.5 bg-slate-700 light:bg-white border border-slate-600 light:border-gray-300 rounded-xl text-sm text-white light:text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                />
              </div>
            )}
          </div>
        ))}
        {error && <p className="text-sm text-red-400">{error}</p>}
        {success && <p className="text-sm text-emerald-400">{success}</p>}
        <div className="pt-2">
          <Button
            type="button"
            loading={isSaving}
            onClick={save}
            className="bg-violet-600 hover:bg-violet-500 light:bg-violet-600 light:hover:bg-violet-700 text-white"
          >
            {isSaving ? "Saving..." : "Save Hours"}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function StorefrontTab({
  tenant,
  onTenantUpdated,
}: {
  tenant: Tenant;
  onTenantUpdated: (tenant: Tenant) => void;
}) {
  const [slug, setSlug] = useState(tenant.slug);
  const [coverImage, setCoverImage] = useState(tenant.coverImage);
  const [primaryColor, setPrimaryColor] = useState(tenant.primaryColor);
  const [accentColor, setAccentColor] = useState(tenant.accentColor);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const previewUrlRef = useRef("");
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const clearSelectedFile = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = "";
    setCoverFile(null);
    setCoverPreview("");
    if (coverInputRef.current) coverInputRef.current.value = "";
  };

  const selectCoverFile = (file: File | null) => {
    if (!file) return;
    setError("");
    setSuccess("");
    try {
      validateStorefrontCoverImage(file);
      clearSelectedFile();
      const previewUrl = URL.createObjectURL(file);
      previewUrlRef.current = previewUrl;
      setCoverFile(file);
      setCoverPreview(previewUrl);
    } catch (selectionError) {
      if (coverInputRef.current) coverInputRef.current.value = "";
      setError(selectionError instanceof Error ? selectionError.message : "Unable to use this photo.");
    }
  };

  const removeCoverImage = () => {
    clearSelectedFile();
    setCoverImage("");
    setSuccess("");
  };

  const save = async () => {
    setIsSaving(true);
    setError("");
    setSuccess("");
    let uploadedCoverImage = "";

    try {
      if (coverFile) {
        uploadedCoverImage = await uploadStorefrontCoverImage(tenant.id, coverFile);
      }
      const saved = await updateStorefrontSettings(tenant.id, {
        slug,
        coverImage: uploadedCoverImage || coverImage,
        primaryColor,
        accentColor,
      });
      setSlug(saved.slug);
      setCoverImage(saved.coverImage);
      clearSelectedFile();
      onTenantUpdated({ ...tenant, ...saved });
      if (uploadedCoverImage && tenant.coverImage !== uploadedCoverImage) {
        await deleteStorefrontCoverImage(tenant.id, tenant.coverImage);
      }
      setSuccess("Storefront settings saved.");
    } catch (saveError) {
      if (uploadedCoverImage) {
        await deleteStorefrontCoverImage(tenant.id, uploadedCoverImage);
      }
      setError(saveError instanceof Error ? saveError.message : "Unable to save storefront settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <h3 className="text-xs font-bold text-white light:text-[#17223a]">
          Storefront Settings
        </h3>
      </CardHeader>
      <CardBody className="space-y-4">
        <div>
          <label
            htmlFor="storefront-slug"
            className="block text-sm font-medium text-slate-300 light:text-gray-700 mb-1.5"
          >
            Storefront URL
          </label>
          <div className="flex min-w-0 items-center">
            <span className="text-sm text-slate-400 light:text-gray-600 bg-slate-700 light:bg-gray-100 border border-slate-600 light:border-gray-300 rounded-l-xl px-3 py-2.5 border-r-0 whitespace-nowrap">
              platform.com/
            </span>
            <input
              id="storefront-slug"
              title="Storefront Slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              className="min-w-0 flex-1 px-3 py-2.5 bg-slate-700 light:bg-white border border-slate-600 light:border-gray-300 rounded-r-xl text-sm text-white light:text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/30 sm:px-4"
            />
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-medium text-slate-300 light:text-gray-700">
              Cover Image
            </label>
            {(coverPreview || coverImage) && (
              <button
                type="button"
                onClick={removeCoverImage}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 transition hover:text-red-400"
              >
                <X className="h-3.5 w-3.5" /> Remove
              </button>
            )}
          </div>

          <div
            className="relative flex min-h-36 items-center justify-center overflow-hidden rounded-2xl border border-slate-600 bg-slate-800 bg-cover bg-center light:border-slate-300 light:bg-slate-100"
            style={(coverPreview || coverImage) ? {
              backgroundImage: `linear-gradient(rgba(8,17,31,.12),rgba(8,17,31,.4)),url(${JSON.stringify(coverPreview || coverImage)})`,
            } : undefined}
          >
            {!coverPreview && !coverImage && (
              <div className="text-center text-slate-500">
                <ImageIcon className="mx-auto h-7 w-7" />
                <p className="mt-2 text-xs font-medium">No cover image selected</p>
              </div>
            )}
            {coverFile && (
              <span className="absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] truncate rounded-full bg-slate-950/75 px-3 py-1 text-[10px] font-bold text-white backdrop-blur">
                Ready to upload · {coverFile.name}
              </span>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,auto)_minmax(0,1fr)] sm:items-end">
            <div>
              <span className="mb-1.5 block text-xs font-semibold text-slate-300 light:text-slate-700">Upload a photo</span>
              <label
                htmlFor="storefront-cover-upload"
                className="inline-flex h-[42px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-violet-500/70 bg-violet-500/10 px-4 text-xs font-bold text-violet-300 transition hover:bg-violet-500/20 light:text-violet-700 sm:w-auto"
              >
                <Upload className="h-4 w-4" /> Choose photo
              </label>
              <input
                ref={coverInputRef}
                id="storefront-cover-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => selectCoverFile(event.target.files?.[0] ?? null)}
                className="sr-only"
              />
            </div>
            <Input
              label="Or paste an image URL"
              type="url"
              value={coverImage}
              onChange={(event) => {
                clearSelectedFile();
                setCoverImage(event.target.value);
                setSuccess("");
              }}
              placeholder="https://example.com/cover.jpg"
            />
          </div>
          <p className="text-[11px] text-slate-500 light:text-slate-600">
            JPG, PNG, or WebP · Maximum 5 MB. Recommended wide format: 1600 × 700.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="primary-color"
              className="block text-sm font-medium text-slate-300 light:text-gray-700 mb-1.5"
            >
              Primary Colour
            </label>
            <div className="flex items-center gap-2">
              <input
                id="primary-color"
                title="Primary Colour"
                type="color"
                value={primaryColor}
                onChange={(event) => setPrimaryColor(event.target.value)}
                className="w-10 h-10 rounded-xl border border-slate-600 light:border-gray-300 cursor-pointer p-1 bg-transparent"
              />
              <input
                title="Primary Colour"
                value={primaryColor}
                onChange={(event) => setPrimaryColor(event.target.value)}
                className="flex-1 px-3 py-2 bg-slate-700 light:bg-white border border-slate-600 light:border-gray-300 rounded-xl text-sm text-white light:text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="accent-color"
              className="block text-sm font-medium text-slate-300 light:text-gray-700 mb-1.5"
            >
              Accent Colour
            </label>
            <div className="flex items-center gap-2">
              <input
                id="accent-color"
                title="Accent Colour"
                type="color"
                value={accentColor}
                onChange={(event) => setAccentColor(event.target.value)}
                className="w-10 h-10 rounded-xl border border-slate-600 light:border-gray-300 cursor-pointer p-1 bg-transparent"
              />
              <input
                title="Accent Colour"
                value={accentColor}
                onChange={(event) => setAccentColor(event.target.value)}
                className="flex-1 px-3 py-2 bg-slate-700 light:bg-white border border-slate-600 light:border-gray-300 rounded-xl text-sm text-white light:text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              />
            </div>
          </div>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {success && <p className="text-sm text-emerald-400">{success}</p>}
        <Button
          type="button"
          loading={isSaving}
          onClick={save}
          className="bg-violet-600 hover:bg-violet-500 light:bg-violet-600 light:hover:bg-violet-700 text-white"
        >
          {isSaving ? "Saving..." : "Save Storefront"}
        </Button>
      </CardBody>
    </Card>
  );
}

