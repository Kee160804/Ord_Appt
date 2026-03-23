// "use client";

// import { useState } from "react";
// import Link from "next/link";
// import { usePathname } from "next/navigation";
// import {
//   LayoutDashboard, Calendar, Scissors, ShoppingBag, Package,
//   Users, BarChart3, Settings, LogOut, ExternalLink,
//   ChevronLeft, ChevronRight, Sparkles, ChevronDown,
// } from "lucide-react";
// import { cn } from "../lib/utils";
// import type { Tenant, User } from "../types/index";
// import { mockTenants } from "../data/mock";

// interface SidebarProps {
//   tenant: Tenant;
//   user: User;
//   allTenants?: Tenant[];
//   onTenantSwitch?: (t: Tenant) => void;
// }

// export function Sidebar({ tenant, user, allTenants = mockTenants, onTenantSwitch }: SidebarProps) {
//   const pathname = usePathname();
//   const [collapsed, setCollapsed] = useState(false);
//   const [tenantOpen, setTenantOpen] = useState(false);

//   const isAppt = tenant.businessType === "appointment";
//   const base = "/dashboard";

//   const navItems = [
//     { href: base,                  label: "Overview",      icon: LayoutDashboard },
//     ...(isAppt
//       ? [
//           { href: `${base}/appointments`, label: "Appointments", icon: Calendar,    badge: 3 },
//           { href: `${base}/services`,     label: "Services",     icon: Scissors },
//         ]
//       : [
//           { href: `${base}/orders`,       label: "Orders",       icon: ShoppingBag, badge: 2 },
//           { href: `${base}/products`,     label: "Products",     icon: Package },
//         ]),
//     { href: `${base}/customers`,   label: "Customers",    icon: Users },
//     { href: `${base}/analytics`,   label: "Analytics",    icon: BarChart3 },
//     { href: `${base}/settings`,    label: "Settings",     icon: Settings },
//   ];

//   return (
//     <aside
//       className={cn(
//         "relative flex flex-col h-screen bg-slate-950 text-white transition-all duration-300 ease-in-out flex-shrink-0",
//         collapsed ? "w-[68px]" : "w-64",
//       )}
//     >
//       {/* Collapse toggle */}
//       <button
//         onClick={() => setCollapsed(!collapsed)}
//         className="absolute -right-3 top-8 z-10 w-6 h-6 bg-white border border-slate-200 rounded-full shadow-md flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"
//       >
//         {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
//       </button>

//       {/* Brand */}
//       <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-800">
//         <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg">
//           <Sparkles className="w-4 h-4 text-white" />
//         </div>
//         {!collapsed && (
//           <div>
//             <p className="font-bold text-white text-sm tracking-tight">LocalSpace</p>
//             <p className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">Platform</p>
//           </div>
//         )}
//       </div>

//       {/* Tenant switcher */}
//       <div className={cn("relative border-b border-slate-800", collapsed ? "px-2 py-3" : "px-3 py-3")}>
//         <button
//           onClick={() => !collapsed && setTenantOpen(!tenantOpen)}
//           className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-800 transition-colors"
//         >
//           <div
//             className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
//             style={{ backgroundColor: tenant.logoBg }}
//           >
//             {tenant.logo}
//           </div>
//           {!collapsed && (
//             <>
//               <div className="flex-1 text-left min-w-0">
//                 <p className="text-sm font-semibold text-white truncate">{tenant.name}</p>
//                 <span className={cn(
//                   "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
//                   isAppt ? "bg-violet-900 text-violet-300" : "bg-orange-900 text-orange-300",
//                 )}>
//                   {isAppt ? "Bookings" : "Orders"}
//                 </span>
//               </div>
//               <ChevronDown className={cn("w-3.5 h-3.5 text-slate-400 transition-transform", tenantOpen && "rotate-180")} />
//             </>
//           )}
//         </button>

//         {/* Tenant dropdown */}
//         {tenantOpen && !collapsed && (
//           <div className="absolute left-3 right-3 top-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-20 overflow-hidden">
//             {allTenants.map(t => (
//               <button
//                 key={t.id}
//                 onClick={() => { onTenantSwitch?.(t); setTenantOpen(false); }}
//                 className={cn(
//                   "w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-800 transition-colors text-left",
//                   t.id === tenant.id && "bg-slate-800",
//                 )}
//               >
//                 <div
//                   className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
//                   style={{ backgroundColor: t.logoBg }}
//                 >
//                   {t.logo}
//                 </div>
//                 <div className="min-w-0">
//                   <p className="text-xs font-semibold text-white truncate">{t.name}</p>
//                   <p className="text-[10px] text-slate-400 capitalize">{t.businessType}</p>
//                 </div>
//               </button>
//             ))}
//           </div>
//         )}
//       </div>

//       {/* Nav */}
//       <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
//         {navItems.map(item => {
//           const Icon = item.icon;
//           const active = pathname === item.href || (item.href !== base && pathname.startsWith(item.href));
//           return (
//             <Link
//               key={item.href}
//               href={item.href}
//               className={cn(
//                 "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
//                 active
//                   ? "bg-white text-slate-900 shadow-sm"
//                   : "text-slate-400 hover:text-white hover:bg-slate-800",
//                 collapsed && "justify-center px-2",
//               )}
//             >
//               <Icon className="w-4 h-4 flex-shrink-0" />
//               {!collapsed && (
//                 <>
//                   <span className="flex-1">{item.label}</span>
//                   {"badge" in item && item.badge ? (
//                     <span className={cn(
//                       "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
//                       active ? "bg-slate-900 text-white" : "bg-violet-600 text-white",
//                     )}>
//                       {item.badge}
//                     </span>
//                   ) : null}
//                 </>
//               )}
//             </Link>
//           );
//         })}
//       </nav>

//       {/* Storefront link */}
//       {!collapsed && (
//         <div className="px-3 pb-2 border-t border-slate-800 pt-2">
//           <Link
//             href={`/store/${tenant.slug}`}
//             target="_blank"
//             className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
//           >
//             <ExternalLink className="w-4 h-4" />
//             View Storefront
//           </Link>
//         </div>
//       )}

//       {/* User */}
//       <div className={cn("border-t border-slate-800 p-3", collapsed && "px-2")}>
//         <div className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-800 cursor-pointer transition-colors">
//           <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
//             {user.avatar}
//           </div>
//           {!collapsed && (
//             <>
//               <div className="flex-1 min-w-0">
//                 <p className="text-sm font-semibold text-white truncate">{user.name}</p>
//                 <p className="text-xs text-slate-400 capitalize">{user.role}</p>
//               </div>
//               <LogOut className="w-4 h-4 text-slate-500" />
//             </>
//           )}
//         </div>
//       </div>
//     </aside>
//   );
// }








// "use client";

// import { useState } from "react";
// import Link from "next/link";
// import { usePathname, useRouter } from "next/navigation";
// import {
//   LayoutDashboard, Calendar, Scissors, ShoppingBag, Package,
//   Users, BarChart3, Settings, LogOut, ExternalLink,
//   ChevronLeft, ChevronRight, Sparkles, ChevronDown, Plus,
// } from "lucide-react";
// import { cn } from "../lib/utils";
// import type { Tenant, User } from "../types/index";
// import { useAuth } from "../contexts/auth"; // Import useAuth

// interface SidebarProps {
//   tenant: Tenant;
//   user: User;
// }

// export function Sidebar({ tenant, user }: SidebarProps) {
//   const pathname = usePathname();
//   const router = useRouter();
//   const { logout } = useAuth(); // Get logout function
//   const [collapsed, setCollapsed] = useState(false);
//   const [tenantOpen, setTenantOpen] = useState(false);

//   const isAppt = tenant.businessType === "appointment";
//   const base = "/dashboard";

//   const navItems = [
//     { href: base, label: "Overview", icon: LayoutDashboard },
//     ...(isAppt
//       ? [
//           { href: `${base}/appointments`, label: "Appointments", icon: Calendar, badge: 3 },
//           { href: `${base}/services`, label: "Services", icon: Scissors },
//         ]
//       : [
//           { href: `${base}/orders`, label: "Orders", icon: ShoppingBag, badge: 2 },
//           { href: `${base}/products`, label: "Products", icon: Package },
//         ]),
//     { href: `${base}/customers`, label: "Customers", icon: Users },
//     { href: `${base}/analytics`, label: "Analytics", icon: BarChart3 },
//     { href: `${base}/settings`, label: "Settings", icon: Settings },
//   ];

//   const handleLogout = () => {
//     logout(); // Clear user and redirect to /login
//   };

//   return (
//     <aside
//       className={cn(
//         "relative flex flex-col h-screen bg-slate-950 light:bg-white text-white light:text-gray-900 transition-all duration-300 ease-in-out flex-shrink-0",
//         collapsed ? "w-[68px]" : "w-64",
//       )}
//     >
//       {/* Collapse toggle */}
//       <button
//         onClick={() => setCollapsed(!collapsed)}
//         className="absolute -right-3 top-8 z-10 w-6 h-6 bg-white light:bg-gray-200 border border-slate-200 light:border-gray-300 rounded-full shadow-md flex items-center justify-center text-slate-500 light:text-gray-600 hover:text-slate-800 light:hover:text-gray-900 transition-colors"
//       >
//         {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
//       </button>

//       {/* Brand */}
//       <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-800 light:border-gray-200">
//         <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg">
//           <Sparkles className="w-4 h-4 text-white" />
//         </div>
//         {!collapsed && (
//           <div>
//             <p className="font-bold text-white light:text-gray-900 text-sm tracking-tight">LocalSpace</p>
//             <p className="text-[10px] text-slate-400 light:text-gray-600 uppercase tracking-widest font-medium">Platform</p>
//           </div>
//         )}
//       </div>

//       {/* Tenant switcher – now only shows "Add another business" */}
//       <div className={cn("relative border-b border-slate-800 light:border-gray-200", collapsed ? "px-2 py-3" : "px-3 py-3")}>
//         <button
//           onClick={() => !collapsed && setTenantOpen(!tenantOpen)}
//           className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-800 light:hover:bg-gray-100 transition-colors"
//         >
//           <div
//             className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
//             style={{ backgroundColor: tenant.logoBg }}
//           >
//             {tenant.logo}
//           </div>
//           {!collapsed && (
//             <>
//               <div className="flex-1 text-left min-w-0">
//                 <p className="text-sm font-semibold text-white light:text-gray-900 truncate">{tenant.name}</p>
//                 <span className={cn(
//                   "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
//                   isAppt
//                     ? "bg-violet-900 light:bg-violet-100 text-violet-300 light:text-violet-700"
//                     : "bg-orange-900 light:bg-orange-100 text-orange-300 light:text-orange-700",
//                 )}>
//                   {isAppt ? "Bookings" : "Orders"}
//                 </span>
//               </div>
//               <ChevronDown className={cn("w-3.5 h-3.5 text-slate-400 light:text-gray-500 transition-transform", tenantOpen && "rotate-180")} />
//             </>
//           )}
//         </button>

//         {/* Dropdown – only "Add another business" */}
//         {tenantOpen && !collapsed && (
//           <div className="absolute left-3 right-3 top-full mt-1 bg-slate-900 light:bg-white border border-slate-700 light:border-gray-200 rounded-xl shadow-xl z-20 overflow-hidden">
//             <Link
//               href="/"
//               className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-800 light:hover:bg-gray-100 transition-colors text-left"
//               onClick={() => setTenantOpen(false)}
//             >
//               <div className="w-7 h-7 rounded-lg bg-violet-600/20 light:bg-violet-100 flex items-center justify-center flex-shrink-0">
//                 <Plus className="w-3.5 h-3.5 text-violet-400 light:text-violet-600" />
//               </div>
//               <div className="min-w-0">
//                 <p className="text-xs font-semibold text-white light:text-gray-900 truncate">Add another business</p>
//                 <p className="text-[10px] text-slate-400 light:text-gray-600">New subscription</p>
//               </div>
//             </Link>
//           </div>
//         )}
//       </div>

//       {/* Nav */}
//       <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
//         {navItems.map(item => {
//           const Icon = item.icon;
//           const active = pathname === item.href || (item.href !== base && pathname.startsWith(item.href));
//           return (
//             <Link
//               key={item.href}
//               href={item.href}
//               className={cn(
//                 "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
//                 active
//                   ? "bg-white light:bg-violet-100 text-slate-900 light:text-violet-900 shadow-sm"
//                   : "text-slate-400 light:text-gray-600 hover:text-white light:hover:text-gray-900 hover:bg-slate-800 light:hover:bg-gray-100",
//                 collapsed && "justify-center px-2",
//               )}
//             >
//               <Icon className="w-4 h-4 flex-shrink-0" />
//               {!collapsed && (
//                 <>
//                   <span className="flex-1">{item.label}</span>
//                   {"badge" in item && item.badge ? (
//                     <span className={cn(
//                       "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
//                       active
//                         ? "bg-slate-900 light:bg-violet-200 text-white light:text-violet-900"
//                         : "bg-violet-600 light:bg-violet-500 text-white",
//                     )}>
//                       {item.badge}
//                     </span>
//                   ) : null}
//                 </>
//               )}
//             </Link>
//           );
//         })}
//       </nav>

//       {/* Storefront link */}
//       {!collapsed && (
//         <div className="px-3 pb-2 border-t border-slate-800 light:border-gray-200 pt-2">
//           <Link
//             href={`/store-front/${tenant.slug}`}
//             target="_blank"
//             className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-400 light:text-gray-600 hover:text-white light:hover:text-gray-900 hover:bg-slate-800 light:hover:bg-gray-100 transition-colors"
//           >
//             <ExternalLink className="w-4 h-4" />
//             View Storefront
//           </Link>
//         </div>
//       )}

//       {/* User & Logout */}
//       <div className={cn("border-t border-slate-800 light:border-gray-200 p-3", collapsed && "px-2")}>
//         <button
//           onClick={handleLogout}
//           className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-800 light:hover:bg-gray-100 transition-colors group"
//         >
//           <div className="w-8 h-8 rounded-full bg-violet-600 light:bg-violet-300 flex items-center justify-center text-white light:text-violet-900 text-xs font-bold flex-shrink-0">
//             {user.avatar}
//           </div>
//           {!collapsed && (
//             <>
//               <div className="flex-1 min-w-0 text-left">
//                 <p className="text-sm font-semibold text-white light:text-gray-900 truncate">{user.name}</p>
//                 <p className="text-xs text-slate-400 light:text-gray-600 capitalize">{user.role}</p>
//               </div>
//               <LogOut className="w-4 h-4 text-slate-500 light:text-gray-500 group-hover:text-white light:group-hover:text-gray-900 transition-colors" />
//             </>
//           )}
//         </button>
//       </div>
//     </aside>
//   );
// }








































// "use client";

// import { useState } from "react";
// import Link from "next/link";
// import { usePathname, useRouter } from "next/navigation";
// import {
//   LayoutDashboard, Calendar, Scissors, ShoppingBag, Package,
//   Users, BarChart3, Settings, LogOut, ExternalLink,
//   ChevronLeft, ChevronRight, Sparkles, ChevronDown, Plus,
// } from "lucide-react";
// import { cn } from "../lib/utils";
// import type { Tenant, User } from "../types/index";
// import { useAuth } from "../contexts/auth"; // Import useAuth

// interface SidebarProps {
//   tenant: Tenant;
//   user: User;
// }

// export function Sidebar({ tenant, user }: SidebarProps) {
//   const pathname = usePathname();
//   const router = useRouter();
//   const { logout } = useAuth(); // Get logout function
//   const [collapsed, setCollapsed] = useState(false);
//   const [tenantOpen, setTenantOpen] = useState(false);

//   const isAppt = tenant.businessType === "appointment";
//   const base = "/dashboard";

//   const navItems = [
//     { href: base, label: "Overview", icon: LayoutDashboard },
//     ...(isAppt
//       ? [
//           { href: `${base}/appointments`, label: "Appointments", icon: Calendar, badge: 3 },
//           { href: `${base}/services`, label: "Services", icon: Scissors },
//         ]
//       : [
//           { href: `${base}/orders`, label: "Orders", icon: ShoppingBag, badge: 2 },
//           { href: `${base}/products`, label: "Products", icon: Package },
//         ]),
//     { href: `${base}/customers`, label: "Customers", icon: Users },
//     { href: `${base}/analytics`, label: "Analytics", icon: BarChart3 },
//     { href: `${base}/settings`, label: "Settings", icon: Settings },
//   ];

//   const handleLogout = () => {
//     logout(); // Clear user and redirect to /login
//   };

//   return (
//     <aside
//       className={cn(
//         "relative flex flex-col h-screen bg-slate-950 light:bg-white text-white light:text-gray-900 transition-all duration-300 ease-in-out flex-shrink-0",
//         collapsed ? "w-[68px]" : "w-64",
//       )}
//     >
//       {/* Collapse toggle */}
//       <button
//         onClick={() => setCollapsed(!collapsed)}
//         className="absolute -right-3 top-8 z-10 w-6 h-6 bg-white light:bg-gray-200 border border-slate-200 light:border-gray-300 rounded-full shadow-md flex items-center justify-center text-slate-500 light:text-gray-600 hover:text-slate-800 light:hover:text-gray-900 transition-colors"
//       >
//         {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
//       </button>

//       {/* Brand */}
//       <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-800 light:border-gray-200">
//         <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg">
//           <Sparkles className="w-4 h-4 text-white" />
//         </div>
//         {!collapsed && (
//           <div>
//             <p className="font-bold text-white light:text-gray-900 text-sm tracking-tight">LocalSpace</p>
//             <p className="text-[10px] text-slate-400 light:text-gray-600 uppercase tracking-widest font-medium">Platform</p>
//           </div>
//         )}
//       </div>

//       {/* Tenant switcher – now only shows "Add another business" */}
//       <div className={cn("relative border-b border-slate-800 light:border-gray-200", collapsed ? "px-2 py-3" : "px-3 py-3")}>
//         <button
//           onClick={() => !collapsed && setTenantOpen(!tenantOpen)}
//           className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-800 light:hover:bg-gray-100 transition-colors"
//         >
//           <div
//             className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
//             style={{ backgroundColor: tenant.logoBg }}
//           >
//             {tenant.logo}
//           </div>
//           {!collapsed && (
//             <>
//               <div className="flex-1 text-left min-w-0">
//                 <p className="text-sm font-semibold text-white light:text-gray-900 truncate">{tenant.name}</p>
//                 <span className={cn(
//                   "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
//                   isAppt
//                     ? "bg-violet-900 light:bg-violet-100 text-violet-300 light:text-violet-700"
//                     : "bg-orange-900 light:bg-orange-100 text-orange-300 light:text-orange-700",
//                 )}>
//                   {isAppt ? "Bookings" : "Orders"}
//                 </span>
//               </div>
//               <ChevronDown className={cn("w-3.5 h-3.5 text-slate-400 light:text-gray-500 transition-transform", tenantOpen && "rotate-180")} />
//             </>
//           )}
//         </button>

//         {/* Dropdown – only "Add another business" */}
//         {tenantOpen && !collapsed && (
//           <div className="absolute left-3 right-3 top-full mt-1 bg-slate-900 light:bg-white border border-slate-700 light:border-gray-200 rounded-xl shadow-xl z-20 overflow-hidden">
//             <Link
//               href="/"
//               className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-800 light:hover:bg-gray-100 transition-colors text-left"
//               onClick={() => setTenantOpen(false)}
//             >
//               <div className="w-7 h-7 rounded-lg bg-violet-600/20 light:bg-violet-100 flex items-center justify-center flex-shrink-0">
//                 <Plus className="w-3.5 h-3.5 text-violet-400 light:text-violet-600" />
//               </div>
//               <div className="min-w-0">
//                 <p className="text-xs font-semibold text-white light:text-gray-900 truncate">Add another business</p>
//                 <p className="text-[10px] text-slate-400 light:text-gray-600">New subscription</p>
//               </div>
//             </Link>
//           </div>
//         )}
//       </div>

//       {/* Nav */}
//       <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
//         {navItems.map(item => {
//           const Icon = item.icon;
//           const active = pathname === item.href || (item.href !== base && pathname.startsWith(item.href));
//           return (
//             <Link
//               key={item.href}
//               href={item.href}
//               className={cn(
//                 "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
//                 active
//                   ? "bg-white light:bg-violet-100 text-slate-900 light:text-violet-900 shadow-sm"
//                   : "text-slate-400 light:text-gray-600 hover:text-white light:hover:text-gray-900 hover:bg-slate-800 light:hover:bg-gray-100",
//                 collapsed && "justify-center px-2",
//               )}
//             >
//               <Icon className="w-4 h-4 flex-shrink-0" />
//               {!collapsed && (
//                 <>
//                   <span className="flex-1">{item.label}</span>
//                   {"badge" in item && item.badge ? (
//                     <span className={cn(
//                       "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
//                       active
//                         ? "bg-slate-900 light:bg-violet-200 text-white light:text-violet-900"
//                         : "bg-violet-600 light:bg-violet-500 text-white",
//                     )}>
//                       {item.badge}
//                     </span>
//                   ) : null}
//                 </>
//               )}
//             </Link>
//           );
//         })}
//       </nav>

//       {/* Storefront link – corrected route */}
//       {!collapsed && (
//         <div className="px-3 pb-2 border-t border-slate-800 light:border-gray-200 pt-2">
//           <Link
//             href={`/store/${tenant.slug}`}
//             target="_blank"
//             className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-400 light:text-gray-600 hover:text-white light:hover:text-gray-900 hover:bg-slate-800 light:hover:bg-gray-100 transition-colors"
//           >
//             <ExternalLink className="w-4 h-4" />
//             View Storefront
//           </Link>
//         </div>
//       )}

//       {/* User & Logout */}
//       <div className={cn("border-t border-slate-800 light:border-gray-200 p-3", collapsed && "px-2")}>
//         <button
//           onClick={handleLogout}
//           className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-800 light:hover:bg-gray-100 transition-colors group"
//         >
//           <div className="w-8 h-8 rounded-full bg-violet-600 light:bg-violet-300 flex items-center justify-center text-white light:text-violet-900 text-xs font-bold flex-shrink-0">
//             {user.avatar}
//           </div>
//           {!collapsed && (
//             <>
//               <div className="flex-1 min-w-0 text-left">
//                 <p className="text-sm font-semibold text-white light:text-gray-900 truncate">{user.name}</p>
//                 <p className="text-xs text-slate-400 light:text-gray-600 capitalize">{user.role}</p>
//               </div>
//               <LogOut className="w-4 h-4 text-slate-500 light:text-gray-500 group-hover:text-white light:group-hover:text-gray-900 transition-colors" />
//             </>
//           )}
//         </button>
//       </div>
//     </aside>
//   );
// }

















































// app/components/Sidebar.tsx (full updated version)
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Calendar, Scissors, ShoppingBag, Package,
  Users, BarChart3, Settings, LogOut, ExternalLink,
  ChevronLeft, ChevronRight, Sparkles, ChevronDown, Plus,
} from "lucide-react";
import { cn } from "../lib/utils";
import type { Tenant, User } from "../types/index";
import { useAuth } from "../contexts/auth";

interface SidebarProps {
  tenant: Tenant;
  user: User;
}

export function Sidebar({ tenant, user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [tenantOpen, setTenantOpen] = useState(false);

  const isAppt = tenant.businessType === "appointment";
  const base = "/dashboard";

  const navItems = [
    { href: base, label: "Overview", icon: LayoutDashboard },
    ...(isAppt
      ? [
          { href: `${base}/appointments`, label: "Appointments", icon: Calendar, badge: 3 },
          { href: `${base}/services`, label: "Services", icon: Scissors },
        ]
      : [
          { href: `${base}/orders`, label: "Orders", icon: ShoppingBag, badge: 2 },
          { href: `${base}/products`, label: "Products", icon: Package },
        ]),
    { href: `${base}/customers`, label: "Customers", icon: Users },
    { href: `${base}/analytics`, label: "Analytics", icon: BarChart3 },
    { href: `${base}/settings`, label: "Settings", icon: Settings },
  ];

  const handleLogout = () => {
    logout();
  };

  return (
    <aside
      className={cn(
        "relative flex flex-col h-screen bg-slate-950 light:bg-white text-white light:text-gray-900 transition-all duration-300 ease-in-out flex-shrink-0",
        collapsed ? "w-[68px]" : "w-64",
      )}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-8 z-10 w-6 h-6 bg-white light:bg-gray-200 border border-slate-200 light:border-gray-300 rounded-full shadow-md flex items-center justify-center text-slate-500 light:text-gray-600 hover:text-slate-800 light:hover:text-gray-900 transition-colors"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>

      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-800 light:border-gray-200">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div>
            <p className="font-bold text-white light:text-gray-900 text-sm tracking-tight">LocalSpace</p>
            <p className="text-[10px] text-slate-400 light:text-gray-600 uppercase tracking-widest font-medium">Platform</p>
          </div>
        )}
      </div>

      {/* Tenant switcher */}
      <div className={cn("relative border-b border-slate-800 light:border-gray-200", collapsed ? "px-2 py-3" : "px-3 py-3")}>
        <button
          onClick={() => !collapsed && setTenantOpen(!tenantOpen)}
          className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-800 light:hover:bg-gray-100 transition-colors"
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
            style={{ backgroundColor: tenant.logoBg }}
          >
            {tenant.logo}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-semibold text-white light:text-gray-900 truncate">{tenant.name}</p>
                <span className={cn(
                  "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                  isAppt
                    ? "bg-violet-900 light:bg-violet-100 text-violet-300 light:text-violet-700"
                    : "bg-orange-900 light:bg-orange-100 text-orange-300 light:text-orange-700",
                )}>
                  {isAppt ? "Bookings" : "Orders"}
                </span>
              </div>
              <ChevronDown className={cn("w-3.5 h-3.5 text-slate-400 light:text-gray-500 transition-transform", tenantOpen && "rotate-180")} />
            </>
          )}
        </button>

        {/* Dropdown – "Add another business" */}
        {tenantOpen && !collapsed && (
          <div className="absolute left-3 right-3 top-full mt-1 bg-slate-900 light:bg-white border border-slate-700 light:border-gray-200 rounded-xl shadow-xl z-20 overflow-hidden">
            <Link
              href="/"
              className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-800 light:hover:bg-gray-100 transition-colors text-left"
              onClick={() => setTenantOpen(false)}
            >
              <div className="w-7 h-7 rounded-lg bg-violet-600/20 light:bg-violet-100 flex items-center justify-center flex-shrink-0">
                <Plus className="w-3.5 h-3.5 text-violet-400 light:text-violet-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white light:text-gray-900 truncate">Add another business</p>
                <p className="text-[10px] text-slate-400 light:text-gray-600">New subscription</p>
              </div>
            </Link>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== base && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                active
                  ? "bg-white light:bg-violet-100 text-slate-900 light:text-violet-900 shadow-sm"
                  : "text-slate-400 light:text-gray-600 hover:text-white light:hover:text-gray-900 hover:bg-slate-800 light:hover:bg-gray-100",
                collapsed && "justify-center px-2",
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1">{item.label}</span>
                  {"badge" in item && item.badge ? (
                    <span className={cn(
                      "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                      active
                        ? "bg-slate-900 light:bg-violet-200 text-white light:text-violet-900"
                        : "bg-violet-600 light:bg-violet-500 text-white",
                    )}>
                      {item.badge}
                    </span>
                  ) : null}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Storefront link – corrected route and opens in new tab */}
      {!collapsed && (
        <div className="px-3 pb-2 border-t border-slate-800 light:border-gray-200 pt-2">
          <Link
            href={`/store-front/${tenant.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-400 light:text-gray-600 hover:text-white light:hover:text-gray-900 hover:bg-slate-800 light:hover:bg-gray-100 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            View Storefront
          </Link>
        </div>
      )}

      {/* User & Logout */}
      <div className={cn("border-t border-slate-800 light:border-gray-200 p-3", collapsed && "px-2")}>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-800 light:hover:bg-gray-100 transition-colors group"
        >
          <div className="w-8 h-8 rounded-full bg-violet-600 light:bg-violet-300 flex items-center justify-center text-white light:text-violet-900 text-xs font-bold flex-shrink-0">
            {user.avatar}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold text-white light:text-gray-900 truncate">{user.name}</p>
                <p className="text-xs text-slate-400 light:text-gray-600 capitalize">{user.role}</p>
              </div>
              <LogOut className="w-4 h-4 text-slate-500 light:text-gray-500 group-hover:text-white light:group-hover:text-gray-900 transition-colors" />
            </>
          )}
        </button>
      </div>
    </aside>
  );
}