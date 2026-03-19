// "use client";

// import { useState } from "react";
// import { ShoppingBag, RefreshCw, XCircle, ChevronRight } from "lucide-react";
// import { Card } from "../components/Card";
// import { Button } from "../components/Button";
// import { StatusBadge } from "../components/Badge";
// import { getOrdersByTenant } from "../data/mock";
// import { formatCurrency, capitalise, cn } from "../lib/utils";
// import type { Order, OrderStatus, Tenant } from "../types/index";

// const STATUS_FLOW: OrderStatus[] = ["pending", "confirmed", "preparing", "ready", "delivered"];

// const STATUS_BG: Record<string, string> = {
//   pending:   "bg-amber-50 border-amber-200",
//   confirmed: "bg-blue-50 border-blue-200",
//   preparing: "bg-violet-50 border-violet-200",
//   ready:     "bg-green-50 border-green-200",
//   delivered: "bg-slate-50 border-slate-200",
//   cancelled: "bg-red-50 border-red-200",
// };

// interface Props { tenant: Tenant }

// export function OrdersView({ tenant }: Props) {
//   const [orders, setOrders] = useState<Order[]>(getOrdersByTenant(tenant.id));
//   const [selected, setSelected] = useState<Order | null>(null);
//   const [filter, setFilter] = useState<OrderStatus | "all">("all");

//   const filtered = filter === "all" ? orders : orders.filter(o => o.status === filter);

//   const advance = (id: string, status: OrderStatus) => {
//     setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
//     setSelected(prev => prev?.id === id ? { ...prev, status } : prev);
//   };

//   return (
//     <div className="p-8 space-y-6">
//       {/* Status summary */}
//       <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
//         {STATUS_FLOW.map(status => (
//           <button
//             key={status}
//             onClick={() => setFilter(status)}
//             className={cn(
//               "p-4 rounded-2xl border text-left transition-all hover:shadow-sm",
//               STATUS_BG[status],
//               filter === status && "ring-2 ring-slate-900 ring-offset-1",
//             )}
//           >
//             <p className="text-xs font-medium text-slate-500 capitalize">{status}</p>
//             <p className="text-2xl font-black text-slate-900 mt-1">
//               {orders.filter(o => o.status === status).length}
//             </p>
//           </button>
//         ))}
//       </div>

//       {/* Filter strip */}
//       <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit">
//         {(["all", ...STATUS_FLOW] as (OrderStatus | "all")[]).map(tab => (
//           <button
//             key={tab}
//             onClick={() => setFilter(tab)}
//             className={cn(
//               "px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all",
//               filter === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700",
//             )}
//           >
//             {tab}
//           </button>
//         ))}
//       </div>

//       <div className="grid lg:grid-cols-3 gap-6">
//         {/* List */}
//         <Card className="lg:col-span-2">
//           <div className="divide-y divide-slate-50">
//             {filtered.length === 0 && (
//               <div className="py-16 text-center text-slate-400">
//                 <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-40" />
//                 <p className="text-sm">No orders</p>
//               </div>
//             )}
//             {filtered.map(order => (
//               <button
//                 key={order.id}
//                 onClick={() => setSelected(order)}
//                 className={cn(
//                   "w-full px-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors text-left",
//                   selected?.id === order.id && "bg-violet-50",
//                 )}
//               >
//                 <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center border text-slate-500 text-sm font-bold flex-shrink-0", STATUS_BG[order.status])}>
//                   #
//                 </div>
//                 <div className="flex-1 min-w-0">
//                   <div className="flex items-center gap-2">
//                     <p className="text-sm font-bold text-slate-900">{order.orderNumber}</p>
//                     <StatusBadge status={order.status} />
//                   </div>
//                   <p className="text-xs text-slate-500 mt-0.5">
//                     {order.customerName} · {order.items.length} item{order.items.length !== 1 ? "s" : ""}
//                     {order.pickupTime && ` · Pickup ${order.pickupTime}`}
//                   </p>
//                 </div>
//                 <div className="text-right flex-shrink-0">
//                   <p className="text-sm font-bold text-slate-900">{formatCurrency(order.totalAmount)}</p>
//                   <StatusBadge status={order.paymentStatus} />
//                 </div>
//                 <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
//               </button>
//             ))}
//           </div>
//         </Card>

//         {/* Detail panel */}
//         <div>
//           {selected ? (
//             <Card className="sticky top-6">
//               <div className="p-5 space-y-4">
//                 <div className="flex items-center justify-between">
//                   <div>
//                     <h3 className="font-bold text-slate-900">{selected.orderNumber}</h3>
//                     <p className="text-xs text-slate-500">{selected.customerName}</p>
//                   </div>
//                   <StatusBadge status={selected.status} />
//                 </div>

//                 <div className="space-y-2.5">
//                   {selected.items.map(item => (
//                     <div key={item.id} className="flex items-center gap-3">
//                       <img src={item.productImage} alt={item.productName}
//                         className="w-10 h-10 rounded-xl object-cover bg-slate-100 flex-shrink-0" />
//                       <div className="flex-1 min-w-0">
//                         <p className="text-sm font-semibold text-slate-900 truncate">{item.productName}</p>
//                         <p className="text-xs text-slate-500">×{item.quantity}</p>
//                       </div>
//                       <span className="text-sm font-bold flex-shrink-0">
//                         {formatCurrency(item.price * item.quantity)}
//                       </span>
//                     </div>
//                   ))}
//                 </div>

//                 <div className="border-t border-slate-100 pt-3 flex justify-between text-sm">
//                   <span className="font-medium text-slate-600">Total</span>
//                   <span className="font-black text-slate-900 text-base">{formatCurrency(selected.totalAmount)}</span>
//                 </div>

//                 {selected.notes && (
//                   <div className="bg-amber-50 text-amber-800 text-xs rounded-xl p-3">
//                     <span className="font-semibold">Note: </span>{selected.notes}
//                   </div>
//                 )}

//                 {selected.status !== "delivered" && selected.status !== "cancelled" && (
//                   <div className="space-y-2 pt-1">
//                     <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Update Status</p>
//                     <div className="grid grid-cols-2 gap-2">
//                       {STATUS_FLOW.slice(STATUS_FLOW.indexOf(selected.status as OrderStatus) + 1).slice(0, 2).map(next => (
//                         <Button key={next} variant="outline" size="sm" className="justify-center"
//                           onClick={() => advance(selected.id, next)}>
//                           <RefreshCw className="w-3 h-3" />{capitalise(next)}
//                         </Button>
//                       ))}
//                     </div>
//                     <Button variant="danger" size="sm" className="w-full justify-center"
//                       onClick={() => advance(selected.id, "cancelled")}>
//                       <XCircle className="w-3.5 h-3.5" /> Cancel Order
//                     </Button>
//                   </div>
//                 )}
//               </div>
//             </Card>
//           ) : (
//             <div className="flex flex-col items-center justify-center h-48 text-slate-400
//                             bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
//               <ShoppingBag className="w-8 h-8 mb-2 opacity-40" />
//               <p className="text-sm">Select an order to view details</p>
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }





// // "use client";

// // import { useState } from "react";
// // import { Tenant } from "@/app/types/index";
// // import { mockOrders } from "@/app/data/mock";
// // import { cn } from "@/app/lib/utils";
// // import { Search, Filter } from "lucide-react";

// // interface OrdersViewProps {
// //   tenant: Tenant;
// // }

// // export function OrdersView({ tenant }: OrdersViewProps) {
// //   const orders = mockOrders.filter(o => o.tenantId === tenant.id);
// //   const [filter, setFilter] = useState<"all" | "pending" | "confirmed" | "preparing" | "delivered">("all");

// //   const filteredOrders = filter === "all" ? orders : orders.filter(o => o.status === filter);

// //   const statusColors = {
// //     pending: "bg-yellow-500/20 text-yellow-400 light:bg-yellow-100 light:text-yellow-700",
// //     confirmed: "bg-blue-500/20 text-blue-400 light:bg-blue-100 light:text-blue-700",
// //     preparing: "bg-purple-500/20 text-purple-400 light:bg-purple-100 light:text-purple-700",
// //     delivered: "bg-emerald-500/20 text-emerald-400 light:bg-emerald-100 light:text-emerald-700",
// //   };

// //   return (
// //     <div className="p-6">
// //       {/* Header with title and search */}
// //       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
// //         <h2 className="text-xl font-bold text-white light:text-gray-900">Orders</h2>
// //         <div className="flex items-center gap-2 w-full sm:w-auto">
// //           <div className="relative flex-1 sm:w-64">
// //             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 light:text-gray-500" />
// //             <input
// //               type="text"
// //               placeholder="Search orders..."
// //               className="w-full pl-9 pr-4 py-2 text-sm bg-slate-800 light:bg-gray-100 border border-slate-700 light:border-gray-300 rounded-xl
// //                          focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500
// //                          text-white light:text-gray-900 placeholder:text-slate-500 light:placeholder:text-gray-500"
// //             />
// //           </div>
// //           <button className="p-2 bg-slate-800 light:bg-gray-200 hover:bg-slate-700 light:hover:bg-gray-300 rounded-xl transition-colors">
// //             <Filter className="w-4 h-4 text-white light:text-gray-700" />
// //           </button>
// //         </div>
// //       </div>

// //       {/* Filter tabs */}
// //       <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
// //         {(["all", "pending", "confirmed", "preparing", "delivered"] as const).map((status) => (
// //           <button
// //             key={status}
// //             onClick={() => setFilter(status)}
// //             className={cn(
// //               "px-4 py-2 text-sm font-medium rounded-full capitalize whitespace-nowrap transition",
// //               filter === status
// //                 ? "bg-violet-600 text-white"
// //                 : "bg-slate-800 light:bg-gray-200 text-slate-300 light:text-gray-700 hover:bg-slate-700 light:hover:bg-gray-300"
// //             )}
// //           >
// //             {status}
// //           </button>
// //         ))}
// //       </div>

// //       {/* Orders list */}
// //       <div className="space-y-3">
// //         {filteredOrders.map((order) => (
// //           <div
// //             key={order.id}
// //             className="bg-slate-800/50 light:bg-white rounded-xl border border-slate-700 light:border-gray-200 p-4 hover:border-slate-600 light:hover:border-gray-300 transition"
// //           >
// //             <div className="flex flex-col sm:flex-row justify-between gap-4">
// //               <div className="flex-1">
// //                 <div className="flex items-center gap-3 mb-2">
// //                   <span className="text-sm font-semibold text-white light:text-gray-900">
// //                     {order.customerName}
// //                   </span>
// //                   <span className={cn("text-xs px-2 py-0.5 rounded-full", statusColors[order.status])}>
// //                     {order.status}
// //                   </span>
// //                 </div>
// //                 <div className="space-y-1">
// //                   {order.items.map((item) => (
// //                     <p key={item.id} className="text-xs text-slate-400 light:text-gray-600">
// //                       {item.quantity}x {item.productName}
// //                     </p>
// //                   ))}
// //                 </div>
// //                 <p className="text-xs text-slate-500 light:text-gray-500 mt-2">
// //                   {new Date(order.createdAt).toLocaleString()}
// //                 </p>
// //               </div>
// //               <div className="flex items-center justify-between sm:justify-end gap-4 sm:min-w-[140px]">
// //                 <div className="text-right">
// //                   <p className="text-lg font-bold text-white light:text-gray-900">
// //                     ${order.totalAmount.toFixed(2)}
// //                   </p>
// //                   <p className="text-xs text-slate-500 light:text-gray-600 capitalize">
// //                     {order.paymentStatus}
// //                   </p>
// //                 </div>
// //                 <button className="px-3 py-1 bg-slate-700 light:bg-gray-200 text-white light:text-gray-800 text-xs rounded-lg hover:bg-slate-600 light:hover:bg-gray-300 transition">
// //                   Details
// //                 </button>
// //               </div>
// //             </div>
// //           </div>
// //         ))}

// //         {filteredOrders.length === 0 && (
// //           <div className="text-center py-12">
// //             <p className="text-slate-400 light:text-gray-600">No orders found</p>
// //           </div>
// //         )}
// //       </div>
// //     </div>
// //   );
// // }








"use client";

import { useState } from "react";
import { ShoppingBag, RefreshCw, XCircle, ChevronRight } from "lucide-react";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { StatusBadge } from "../components/Badge";
import { getOrdersByTenant } from "../data/mock";
import { formatCurrency, capitalise, cn } from "../lib/utils";
import type { Order, OrderStatus, Tenant } from "../types/index";

const STATUS_FLOW: OrderStatus[] = ["pending", "confirmed", "preparing", "ready", "delivered"];

// Status background colors – default dark, light overrides
const STATUS_BG: Record<string, string> = {
  pending:   "bg-amber-500/20 light:bg-amber-50 border-amber-500/30 light:border-amber-200",
  confirmed: "bg-blue-500/20 light:bg-blue-50 border-blue-500/30 light:border-blue-200",
  preparing: "bg-violet-500/20 light:bg-violet-50 border-violet-500/30 light:border-violet-200",
  ready:     "bg-green-500/20 light:bg-green-50 border-green-500/30 light:border-green-200",
  delivered: "bg-slate-700/50 light:bg-slate-50 border-slate-600 light:border-slate-200",
  cancelled: "bg-red-500/20 light:bg-red-50 border-red-500/30 light:border-red-200",
};

interface Props { tenant: Tenant }

export function OrdersView({ tenant }: Props) {
  const [orders, setOrders] = useState<Order[]>(getOrdersByTenant(tenant.id));
  const [selected, setSelected] = useState<Order | null>(null);
  const [filter, setFilter] = useState<OrderStatus | "all">("all");

  const filtered = filter === "all" ? orders : orders.filter(o => o.status === filter);

  const advance = (id: string, status: OrderStatus) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    setSelected(prev => prev?.id === id ? { ...prev, status } : prev);
  };

  return (
    <div className="p-8 space-y-6 bg-[#0a0f1a] light:bg-white text-white light:text-gray-900 min-h-screen">
      {/* Status summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {STATUS_FLOW.map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={cn(
              "p-4 rounded-2xl border text-left transition-all hover:shadow-sm",
              STATUS_BG[status],
              filter === status && "ring-2 ring-violet-500 light:ring-violet-400 ring-offset-2 ring-offset-[#0a0f1a] light:ring-offset-white"
            )}
          >
            <p className="text-xs font-medium text-slate-400 light:text-slate-600 capitalize">{status}</p>
            <p className="text-2xl font-black text-white light:text-gray-900 mt-1">
              {orders.filter(o => o.status === status).length}
            </p>
          </button>
        ))}
      </div>

      {/* Filter strip */}
      <div className="flex items-center gap-1 bg-slate-800 light:bg-slate-100 p-1 rounded-xl w-fit">
        {(["all", ...STATUS_FLOW] as (OrderStatus | "all")[]).map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all",
              filter === tab
                ? "bg-violet-600 light:bg-white text-white light:text-gray-900 shadow-sm"
                : "text-slate-400 light:text-slate-600 hover:text-white light:hover:text-gray-900"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* List */}
        <Card className="lg:col-span-2 bg-slate-800/50 light:bg-white border-slate-700 light:border-gray-200">
          <div className="divide-y divide-slate-700 light:divide-slate-100">
            {filtered.length === 0 && (
              <div className="py-16 text-center text-slate-400 light:text-gray-500">
                <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No orders</p>
              </div>
            )}
            {filtered.map(order => (
              <button
                key={order.id}
                onClick={() => setSelected(order)}
                className={cn(
                  "w-full px-6 py-4 flex items-center gap-4 hover:bg-slate-700 light:hover:bg-slate-50 transition-colors text-left",
                  selected?.id === order.id && "bg-violet-900/30 light:bg-violet-50"
                )}
              >
                <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center border text-sm font-bold flex-shrink-0", STATUS_BG[order.status])}>
                  #
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-white light:text-gray-900">{order.orderNumber}</p>
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="text-xs text-slate-400 light:text-gray-600 mt-0.5">
                    {order.customerName} · {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                    {order.pickupTime && ` · Pickup ${order.pickupTime}`}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-white light:text-gray-900">{formatCurrency(order.totalAmount)}</p>
                  <StatusBadge status={order.paymentStatus} />
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 light:text-gray-400 flex-shrink-0" />
              </button>
            ))}
          </div>
        </Card>

        {/* Detail panel */}
        <div>
          {selected ? (
            <Card className="sticky top-6 bg-slate-800/50 light:bg-white border-slate-700 light:border-gray-200">
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-white light:text-gray-900">{selected.orderNumber}</h3>
                    <p className="text-xs text-slate-400 light:text-gray-600">{selected.customerName}</p>
                  </div>
                  <StatusBadge status={selected.status} />
                </div>

                <div className="space-y-2.5">
                  {selected.items.map(item => (
                    <div key={item.id} className="flex items-center gap-3">
                      <img src={item.productImage} alt={item.productName}
                        className="w-10 h-10 rounded-xl object-cover bg-slate-700 light:bg-slate-100 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white light:text-gray-900 truncate">{item.productName}</p>
                        <p className="text-xs text-slate-400 light:text-gray-600">×{item.quantity}</p>
                      </div>
                      <span className="text-sm font-bold text-white light:text-gray-900 flex-shrink-0">
                        {formatCurrency(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-700 light:border-slate-200 pt-3 flex justify-between text-sm">
                  <span className="font-medium text-slate-400 light:text-gray-600">Total</span>
                  <span className="font-black text-white light:text-gray-900 text-base">{formatCurrency(selected.totalAmount)}</span>
                </div>

                {selected.notes && (
                  <div className="bg-amber-500/20 light:bg-amber-50 text-amber-400 light:text-amber-800 text-xs rounded-xl p-3">
                    <span className="font-semibold">Note: </span>{selected.notes}
                  </div>
                )}

                {selected.status !== "delivered" && selected.status !== "cancelled" && (
                  <div className="space-y-2 pt-1">
                    <p className="text-xs font-semibold text-slate-400 light:text-gray-500 uppercase tracking-wide">Update Status</p>
                    <div className="grid grid-cols-2 gap-2">
                      {STATUS_FLOW.slice(STATUS_FLOW.indexOf(selected.status as OrderStatus) + 1).slice(0, 2).map(next => (
                        <Button key={next} variant="outline" size="sm" className="justify-center border-slate-600 light:border-slate-300 text-white light:text-gray-800 hover:bg-slate-700 light:hover:bg-slate-100"
                          onClick={() => advance(selected.id, next)}>
                          <RefreshCw className="w-3 h-3 mr-1" />{capitalise(next)}
                        </Button>
                      ))}
                    </div>
                    <Button variant="danger" size="sm" className="w-full justify-center bg-red-500/20 light:bg-red-50 text-red-400 light:text-red-700 border-red-500/30 light:border-red-200 hover:bg-red-500/30 light:hover:bg-red-100"
                      onClick={() => advance(selected.id, "cancelled")}>
                      <XCircle className="w-3.5 h-3.5 mr-1" /> Cancel Order
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 light:text-gray-500
                            bg-slate-800/50 light:bg-slate-50 rounded-2xl border-2 border-dashed border-slate-700 light:border-slate-200">
              <ShoppingBag className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">Select an order to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}