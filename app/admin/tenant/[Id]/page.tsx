// "use client";

// import { useParams } from "next/navigation";
// import Link from "next/link";
// import { mockTenants, mockAnalytics } from "@/app/data/mock";
// import { Card, CardHeader, CardBody } from "./../../../components/Card";
// import { formatCurrency } from "@/app/lib/utils";
// import { ArrowLeft } from "lucide-react";

// export default function TenantDetailPage() {
//   const { id } = useParams<{ id: string }>();
//   const tenant = mockTenants.find(t => t.id === id);
//   const analytics = mockAnalytics[id];

//   if (!tenant) return <div className="p-8">Tenant not found</div>;

//   return (
//     <div className="p-8 space-y-6">
//       <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-4">
//         <ArrowLeft className="w-4 h-4" /> Back to Admin
//       </Link>

//       <div className="flex items-center gap-4">
//         <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: tenant.logoBg }}>
//           {tenant.logo}
//         </div>
//         <div>
//           <h1 className="text-2xl font-black text-slate-900">{tenant.name}</h1>
//           <p className="text-slate-500">{tenant.businessType} · {tenant.city}</p>
//         </div>
//       </div>

//       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//         <StatCard label="Total Revenue" value={formatCurrency(analytics?.totalRevenue ?? 0)} />
//         <StatCard label="Total Transactions" value={analytics?.totalActivity.toString() ?? "0"} />
//         <StatCard label="New Customers" value={analytics?.newCustomers.toString() ?? "0"} />
//       </div>

//       <Card>
//         <CardHeader>
//           <h3 className="font-semibold text-slate-900">Top Items</h3>
//         </CardHeader>
//         <CardBody>
//           <div className="space-y-3">
//             {analytics?.topItems.map((item, i) => (
//               <div key={i} className="flex items-center justify-between">
//                 <span className="text-sm font-medium text-slate-700">{item.name}</span>
//                 <span className="text-sm text-slate-600">{item.count} × {formatCurrency(item.revenue)}</span>
//               </div>
//             ))}
//           </div>
//         </CardBody>
//       </Card>
//     </div>
//   );
// }

// function StatCard({ label, value }: { label: string; value: string }) {
//   return (
//     <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
//       <p className="text-sm font-medium text-slate-500">{label}</p>
//       <p className="text-2xl font-bold text-slate-900 mt-1.5">{value}</p>
//     </div>
//   );
// }