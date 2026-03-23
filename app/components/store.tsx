// "use client";

// import { useState } from "react";
// import Image from "next/image";
// import { ShoppingCart, X, Plus, Minus, Calendar, Clock, ArrowRight } from "lucide-react";
// import { Button } from "@/app/components/Button";
// import { Card } from "@/app/components/Card";
// import { Input } from "@/app/components/input";
// import { Modal } from "@/app/components/Modal";
// import { getServicesByTenant, getProductsByTenant } from "@/app/data/mock";
// import { formatCurrency, formatDuration } from "@/app/lib/utils";
// import type { Tenant, Service, Product } from "@/app/types/index";

// interface CartItem {
//   id: string;
//   name: string;
//   price: number;
//   quantity: number;
//   image?: string;
// }

// export default function StorefrontClient({ tenant }: { tenant: Tenant }) {
//   const isAppt = tenant.businessType === "appointment";
//   const services = isAppt ? getServicesByTenant(tenant.id).filter(s => s.isActive) : [];
//   const products = !isAppt ? getProductsByTenant(tenant.id).filter(p => p.isActive) : [];

//   const [cartOpen, setCartOpen] = useState(false);
//   const [cart, setCart] = useState<CartItem[]>([]);
//   const [checkoutOpen, setCheckoutOpen] = useState(false);
//   const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });

//   const addToCart = (item: Service | Product) => {
//     setCart(prev => {
//       const existing = prev.find(i => i.id === item.id);
//       if (existing) {
//         return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
//       }
//       return [...prev, {
//         id: item.id,
//         name: item.name,
//         price: 'price' in item ? item.price : (item as Service).price,
//         quantity: 1,
//         image: item.image,
//       }];
//     });
//   };

//   const updateQuantity = (id: string, delta: number) => {
//     setCart(prev => prev.map(item => {
//       if (item.id === id) {
//         const newQty = item.quantity + delta;
//         return newQty <= 0 ? null : { ...item, quantity: newQty };
//       }
//       return item;
//     }).filter(Boolean) as CartItem[]);
//   };

//   const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

//   const placeOrder = () => {
//     if (!customer.name || !customer.email || !customer.phone) {
//       alert("Please fill in all fields");
//       return;
//     }
//     alert(`Order placed! (Demo)\n\n${cart.map(i => `${i.name} x${i.quantity}`).join('\n')}\nTotal: ${formatCurrency(total)}`);
//     setCart([]);
//     setCartOpen(false);
//     setCheckoutOpen(false);
//     setCustomer({ name: "", email: "", phone: "" });
//   };

//   return (
//     <div className="min-h-screen bg-white">
//       {/* Header */}
//       <header className="border-b border-slate-100 sticky top-0 bg-white z-10">
//         <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
//           <div className="flex items-center gap-3">
//             <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ backgroundColor: tenant.logoBg }}>
//               {tenant.logo}
//             </div>
//             <div>
//               <h1 className="font-bold text-slate-900">{tenant.name}</h1>
//               <p className="text-xs text-slate-500">{tenant.city}</p>
//             </div>
//           </div>
//           <button
//             onClick={() => setCartOpen(true)}
//             className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
//           >
//             <ShoppingCart className="w-5 h-5" />
//             {cart.length > 0 && (
//               <span className="absolute -top-1 -right-1 w-5 h-5 bg-violet-600 text-white text-xs rounded-full flex items-center justify-center">
//                 {cart.reduce((sum, i) => sum + i.quantity, 0)}
//               </span>
//             )}
//           </button>
//         </div>
//       </header>

//       {/* Hero */}
//       <div className="relative h-64 md:h-80 overflow-hidden">
//         <img src={tenant.coverImage} alt={tenant.name} className="w-full h-full object-cover" />
//         <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
//           <div className="text-center text-white">
//             <h2 className="text-3xl md:text-4xl font-bold">{tenant.name}</h2>
//             <p className="mt-2 max-w-xl mx-auto px-4">{tenant.description}</p>
//           </div>
//         </div>
//       </div>

//       {/* Main content */}
//       <main className="max-w-6xl mx-auto px-4 py-12">
//         <h2 className="text-2xl font-bold text-slate-900 mb-8">
//           {isAppt ? "Our Services" : "Menu"}
//         </h2>
//         <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
//           {(isAppt ? services : products).map(item => (
//             <Card key={item.id} className="overflow-hidden group">
//               <div className="relative h-48 overflow-hidden">
//                 <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition" />
//               </div>
//               <div className="p-4">
//                 <h3 className="font-bold text-slate-900">{item.name}</h3>
//                 <p className="text-sm text-slate-500 mt-1 line-clamp-2">{item.description}</p>
//                 <div className="flex items-center justify-between mt-4">
//                   <span className="font-bold text-slate-900">{formatCurrency('price' in item ? item.price : (item as Service).price)}</span>
//                   {isAppt && (
//                     <span className="text-xs text-slate-500 flex items-center gap-1">
//                       <Clock className="w-3 h-3" /> {formatDuration((item as Service).duration)}
//                     </span>
//                   )}
//                 </div>
//                 <Button
//                   onClick={() => addToCart(item)}
//                   size="sm"
//                   className="w-full mt-4 justify-center"
//                 >
//                   {isAppt ? "Book Now" : "Add to Order"}
//                 </Button>
//               </div>
//             </Card>
//           ))}
//         </div>
//       </main>

//       {/* Cart sidebar */}
//       <div className={`fixed inset-0 bg-black/50 z-50 transition-opacity ${cartOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setCartOpen(false)} />
//       <div className={`fixed right-0 top-0 h-full w-80 bg-white shadow-xl z-50 transform transition-transform ${cartOpen ? 'translate-x-0' : 'translate-x-full'}`}>
//         <div className="p-4 border-b border-slate-100 flex items-center justify-between">
//           <h3 className="font-bold text-slate-900">Your Cart</h3>
//           <button onClick={() => setCartOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
//             <X className="w-5 h-5" />
//           </button>
//         </div>
//         <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(100vh-200px)]">
//           {cart.length === 0 ? (
//             <p className="text-center text-slate-400 py-8">Your cart is empty</p>
//           ) : (
//             cart.map(item => (
//               <div key={item.id} className="flex gap-3">
//                 <img src={item.image} alt={item.name} className="w-16 h-16 rounded-lg object-cover" />
//                 <div className="flex-1">
//                   <p className="font-medium text-slate-900">{item.name}</p>
//                   <p className="text-sm text-slate-500">{formatCurrency(item.price)}</p>
//                   <div className="flex items-center gap-2 mt-1">
//                     <button onClick={() => updateQuantity(item.id, -1)} className="p-1 rounded border border-slate-200 hover:bg-slate-50">
//                       <Minus className="w-3 h-3" />
//                     </button>
//                     <span className="text-sm w-6 text-center">{item.quantity}</span>
//                     <button onClick={() => updateQuantity(item.id, 1)} className="p-1 rounded border border-slate-200 hover:bg-slate-50">
//                       <Plus className="w-3 h-3" />
//                     </button>
//                   </div>
//                 </div>
//               </div>
//             ))
//           )}
//         </div>
//         {cart.length > 0 && (
//           <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-100 bg-white">
//             <div className="flex items-center justify-between mb-4">
//               <span className="font-medium">Total</span>
//               <span className="font-bold text-slate-900">{formatCurrency(total)}</span>
//             </div>
//             <Button onClick={() => { setCheckoutOpen(true); setCartOpen(false); }} className="w-full justify-center">
//               Proceed to Checkout <ArrowRight className="w-4 h-4 ml-1" />
//             </Button>
//           </div>
//         )}
//       </div>

//       {/* Checkout modal */}
//       <Modal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} title="Checkout">
//         <div className="space-y-4">
//           <Input label="Full Name" value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })} />
//           <Input label="Email" type="email" value={customer.email} onChange={e => setCustomer({ ...customer, email: e.target.value })} />
//           <Input label="Phone" value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })} />
//           <div className="bg-slate-50 p-4 rounded-xl space-y-2">
//             <p className="font-medium">Order Summary</p>
//             {cart.map(item => (
//               <div key={item.id} className="flex justify-between text-sm">
//                 <span>{item.name} x{item.quantity}</span>
//                 <span>{formatCurrency(item.price * item.quantity)}</span>
//               </div>
//             ))}
//             <div className="border-t pt-2 flex justify-between font-bold">
//               <span>Total</span>
//               <span>{formatCurrency(total)}</span>
//             </div>
//           </div>
//           <Button onClick={placeOrder} className="w-full justify-center">
//             Place Order (Demo)
//           </Button>
//         </div>
//       </Modal>
//     </div>
//   );
// }







// "use client";

// import { useState } from "react";
// import { ShoppingCart, X, Plus, Minus, Clock, ArrowRight } from "lucide-react";
// import { Button } from "@/app/components/Button";
// import { Card } from "@/app/components/Card";
// import { Input } from "@/app/components/input";
// import { Modal } from "@/app/components/Modal";
// import { getServicesByTenant, getProductsByTenant } from "@/app/data/mock";
// import { formatCurrency, formatDuration } from "@/app/lib/utils";
// import type { Tenant, Service, Product } from "@/app/types/index";

// interface CartItem {
//   id: string;
//   name: string;
//   price: number;
//   quantity: number;
//   image?: string;
// }

// export default function StorefrontClient({ tenant }: { tenant: Tenant }) {
//   const isAppt = tenant.businessType === "appointment";
//   const services = isAppt ? getServicesByTenant(tenant.id).filter(s => s.isActive) : [];
//   const products = !isAppt ? getProductsByTenant(tenant.id).filter(p => p.isActive) : [];

//   const [cartOpen, setCartOpen] = useState(false);
//   const [cart, setCart] = useState<CartItem[]>([]);
//   const [checkoutOpen, setCheckoutOpen] = useState(false);
//   const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });

//   const addToCart = (item: Service | Product) => {
//     setCart(prev => {
//       const existing = prev.find(i => i.id === item.id);
//       if (existing) {
//         return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
//       }
//       return [...prev, {
//         id: item.id,
//         name: item.name,
//         price: 'price' in item ? item.price : (item as Service).price,
//         quantity: 1,
//         image: item.image,
//       }];
//     });
//   };

//   const updateQuantity = (id: string, delta: number) => {
//     setCart(prev => prev.map(item => {
//       if (item.id === id) {
//         const newQty = item.quantity + delta;
//         return newQty <= 0 ? null : { ...item, quantity: newQty };
//       }
//       return item;
//     }).filter(Boolean) as CartItem[]);
//   };

//   const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

//   const placeOrder = () => {
//     if (!customer.name || !customer.email || !customer.phone) {
//       alert("Please fill in all fields");
//       return;
//     }
//     alert(`Order placed! (Demo)\n\n${cart.map(i => `${i.name} x${i.quantity}`).join('\n')}\nTotal: ${formatCurrency(total)}`);
//     setCart([]);
//     setCartOpen(false);
//     setCheckoutOpen(false);
//     setCustomer({ name: "", email: "", phone: "" });
//   };

//   return (
//     <div className="min-h-screen bg-white">
//       {/* Header */}
//       <header className="border-b border-slate-100 sticky top-0 bg-white z-10">
//         <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
//           <div className="flex items-center gap-3">
//             <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ backgroundColor: tenant.logoBg }}>
//               {tenant.logo}
//             </div>
//             <div>
//               <h1 className="font-bold text-slate-900">{tenant.name}</h1>
//               <p className="text-xs text-slate-500">{tenant.city}</p>
//             </div>
//           </div>
//           <button
//             onClick={() => setCartOpen(true)}
//             className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
//           >
//             <ShoppingCart className="w-5 h-5" />
//             {cart.length > 0 && (
//               <span className="absolute -top-1 -right-1 w-5 h-5 bg-violet-600 text-white text-xs rounded-full flex items-center justify-center">
//                 {cart.reduce((sum, i) => sum + i.quantity, 0)}
//               </span>
//             )}
//           </button>
//         </div>
//       </header>

//       {/* Hero */}
//       <div className="relative h-64 md:h-80 overflow-hidden">
//         <img src={tenant.coverImage} alt={tenant.name} className="w-full h-full object-cover" />
//         <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
//           <div className="text-center text-white">
//             <h2 className="text-3xl md:text-4xl font-bold">{tenant.name}</h2>
//             <p className="mt-2 max-w-xl mx-auto px-4">{tenant.description}</p>
//           </div>
//         </div>
//       </div>

//       {/* Main content */}
//       <main className="max-w-6xl mx-auto px-4 py-12">
//         <h2 className="text-2xl font-bold text-slate-900 mb-8">
//           {isAppt ? "Our Services" : "Menu"}
//         </h2>
//         <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
//           {(isAppt ? services : products).map(item => (
//             <Card key={item.id} className="overflow-hidden group">
//               <div className="relative h-48 overflow-hidden">
//                 <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition" />
//               </div>
//               <div className="p-4">
//                 <h3 className="font-bold text-slate-900">{item.name}</h3>
//                 <p className="text-sm text-slate-500 mt-1 line-clamp-2">{item.description}</p>
//                 <div className="flex items-center justify-between mt-4">
//                   <span className="font-bold text-slate-900">{formatCurrency('price' in item ? item.price : (item as Service).price)}</span>
//                   {isAppt && (
//                     <span className="text-xs text-slate-500 flex items-center gap-1">
//                       <Clock className="w-3 h-3" /> {formatDuration((item as Service).duration)}
//                     </span>
//                   )}
//                 </div>
//                 <Button
//                   onClick={() => addToCart(item)}
//                   size="sm"
//                   className="w-full mt-4 justify-center"
//                 >
//                   {isAppt ? "Book Now" : "Add to Order"}
//                 </Button>
//               </div>
//             </Card>
//           ))}
//         </div>
//       </main>

//       {/* Cart sidebar */}
//       <div className={`fixed inset-0 bg-black/50 z-50 transition-opacity ${cartOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setCartOpen(false)} />
//       <div className={`fixed right-0 top-0 h-full w-80 bg-white shadow-xl z-50 transform transition-transform ${cartOpen ? 'translate-x-0' : 'translate-x-full'}`}>
//         <div className="p-4 border-b border-slate-100 flex items-center justify-between">
//           <h3 className="font-bold text-slate-900">Your Cart</h3>
//           <button onClick={() => setCartOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
//             <X className="w-5 h-5" />
//           </button>
//         </div>
//         <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(100vh-200px)]">
//           {cart.length === 0 ? (
//             <p className="text-center text-slate-400 py-8">Your cart is empty</p>
//           ) : (
//             cart.map(item => (
//               <div key={item.id} className="flex gap-3">
//                 <img src={item.image} alt={item.name} className="w-16 h-16 rounded-lg object-cover" />
//                 <div className="flex-1">
//                   <p className="font-medium text-slate-900">{item.name}</p>
//                   <p className="text-sm text-slate-500">{formatCurrency(item.price)}</p>
//                   <div className="flex items-center gap-2 mt-1">
//                     <button onClick={() => updateQuantity(item.id, -1)} className="p-1 rounded border border-slate-200 hover:bg-slate-50">
//                       <Minus className="w-3 h-3" />
//                     </button>
//                     <span className="text-sm w-6 text-center">{item.quantity}</span>
//                     <button onClick={() => updateQuantity(item.id, 1)} className="p-1 rounded border border-slate-200 hover:bg-slate-50">
//                       <Plus className="w-3 h-3" />
//                     </button>
//                   </div>
//                 </div>
//               </div>
//             ))
//           )}
//         </div>
//         {cart.length > 0 && (
//           <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-100 bg-white">
//             <div className="flex items-center justify-between mb-4">
//               <span className="font-medium">Total</span>
//               <span className="font-bold text-slate-900">{formatCurrency(total)}</span>
//             </div>
//             <Button onClick={() => { setCheckoutOpen(true); setCartOpen(false); }} className="w-full justify-center">
//               Proceed to Checkout <ArrowRight className="w-4 h-4 ml-1" />
//             </Button>
//           </div>
//         )}
//       </div>

//       {/* Checkout modal */}
//       <Modal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} title="Checkout">
//         <div className="space-y-4">
//           <Input label="Full Name" value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })} />
//           <Input label="Email" type="email" value={customer.email} onChange={e => setCustomer({ ...customer, email: e.target.value })} />
//           <Input label="Phone" value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })} />
//           <div className="bg-slate-50 p-4 rounded-xl space-y-2">
//             <p className="font-medium">Order Summary</p>
//             {cart.map(item => (
//               <div key={item.id} className="flex justify-between text-sm">
//                 <span>{item.name} x{item.quantity}</span>
//                 <span>{formatCurrency(item.price * item.quantity)}</span>
//               </div>
//             ))}
//             <div className="border-t pt-2 flex justify-between font-bold">
//               <span>Total</span>
//               <span>{formatCurrency(total)}</span>
//             </div>
//           </div>
//           <Button onClick={placeOrder} className="w-full justify-center">
//             Place Order (Demo)
//           </Button>
//         </div>
//       </Modal>
//     </div>
//   );
// }

























































// "use client";

// import { useState, useEffect } from "react";
// import { ShoppingCart, X, Plus, Minus, Clock, ArrowRight } from "lucide-react";
// import { Button } from "@/app/components/Button";
// import { Card } from "@/app/components/Card";
// import { Input } from "@/app/components/input";
// import { Modal } from "@/app/components/Modal";
// import { getServicesByTenant, getProductsByTenant } from "@/app/data/mock";
// import { formatCurrency, formatDuration } from "@/app/lib/utils";
// import { getStoredProducts, getStoredServices } from "@/app/lib/storage";
// import type { Tenant, Service, Product } from "@/app/types/index";

// interface CartItem {
//   id: string;
//   name: string;
//   price: number;
//   quantity: number;
//   image?: string;
// }

// export default function StorefrontClient({ tenant }: { tenant: Tenant }) {
//   const isAppt = tenant.businessType === "appointment";

//   // Load products/services from localStorage (if available), otherwise fallback to mock data
//   const [displayProducts, setDisplayProducts] = useState<Product[]>(() => {
//     if (!isAppt) {
//       const stored = getStoredProducts(tenant.id);
//       return stored ?? getProductsByTenant(tenant.id).filter(p => p.isActive);
//     }
//     return [];
//   });

//   const [displayServices, setDisplayServices] = useState<Service[]>(() => {
//     if (isAppt) {
//       const stored = getStoredServices(tenant.id);
//       return stored ?? getServicesByTenant(tenant.id).filter(s => s.isActive);
//     }
//     return [];
//   });

//   // Listen for storage changes (e.g., when tenant updates products in another tab)
//   useEffect(() => {
//     const handleStorageChange = (e: StorageEvent) => {
//       if (e.key === `tenant_${tenant.id}_products` && !isAppt) {
//         const newProducts = getStoredProducts(tenant.id);
//         if (newProducts) {
//           setDisplayProducts(newProducts.filter(p => p.isActive));
//         }
//       } else if (e.key === `tenant_${tenant.id}_services` && isAppt) {
//         const newServices = getStoredServices(tenant.id);
//         if (newServices) {
//           setDisplayServices(newServices.filter(s => s.isActive));
//         }
//       }
//     };
//     window.addEventListener("storage", handleStorageChange);
//     return () => window.removeEventListener("storage", handleStorageChange);
//   }, [tenant.id, isAppt]);

//   const [cartOpen, setCartOpen] = useState(false);
//   const [cart, setCart] = useState<CartItem[]>([]);
//   const [checkoutOpen, setCheckoutOpen] = useState(false);
//   const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });

//   const addToCart = (item: Service | Product) => {
//     setCart(prev => {
//       const existing = prev.find(i => i.id === item.id);
//       if (existing) {
//         return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
//       }
//       return [...prev, {
//         id: item.id,
//         name: item.name,
//         price: 'price' in item ? item.price : (item as Service).price,
//         quantity: 1,
//         image: item.image,
//       }];
//     });
//   };

//   const updateQuantity = (id: string, delta: number) => {
//     setCart(prev => prev.map(item => {
//       if (item.id === id) {
//         const newQty = item.quantity + delta;
//         return newQty <= 0 ? null : { ...item, quantity: newQty };
//       }
//       return item;
//     }).filter(Boolean) as CartItem[]);
//   };

//   const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

//   const placeOrder = () => {
//     if (!customer.name || !customer.email || !customer.phone) {
//       alert("Please fill in all fields");
//       return;
//     }
//     alert(`Order placed! (Demo)\n\n${cart.map(i => `${i.name} x${i.quantity}`).join('\n')}\nTotal: ${formatCurrency(total)}`);
//     setCart([]);
//     setCartOpen(false);
//     setCheckoutOpen(false);
//     setCustomer({ name: "", email: "", phone: "" });
//   };

//   const items = isAppt ? displayServices : displayProducts;

//   return (
//     <div className="min-h-screen bg-white">
//       {/* Header */}
//       <header className="border-b border-slate-100 sticky top-0 bg-white z-10">
//         <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
//           <div className="flex items-center gap-3">
//             <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ backgroundColor: tenant.logoBg }}>
//               {tenant.logo}
//             </div>
//             <div>
//               <h1 className="font-bold text-slate-900">{tenant.name}</h1>
//               <p className="text-xs text-slate-500">{tenant.city}</p>
//             </div>
//           </div>
//           <button
//             onClick={() => setCartOpen(true)}
//             className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
//           >
//             <ShoppingCart className="w-5 h-5" />
//             {cart.length > 0 && (
//               <span className="absolute -top-1 -right-1 w-5 h-5 bg-violet-600 text-white text-xs rounded-full flex items-center justify-center">
//                 {cart.reduce((sum, i) => sum + i.quantity, 0)}
//               </span>
//             )}
//           </button>
//         </div>
//       </header>

//       {/* Hero */}
//       <div className="relative h-64 md:h-80 overflow-hidden">
//         <img src={tenant.coverImage} alt={tenant.name} className="w-full h-full object-cover" />
//         <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
//           <div className="text-center text-white">
//             <h2 className="text-3xl md:text-4xl font-bold">{tenant.name}</h2>
//             <p className="mt-2 max-w-xl mx-auto px-4">{tenant.description}</p>
//           </div>
//         </div>
//       </div>

//       {/* Main content */}
//       <main className="max-w-6xl mx-auto px-4 py-12">
//         <h2 className="text-2xl font-bold text-slate-900 mb-8">
//           {isAppt ? "Our Services" : "Menu"}
//         </h2>
//         <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
//           {items.map(item => (
//             <Card key={item.id} className="overflow-hidden group">
//               <div className="relative h-48 overflow-hidden">
//                 <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition" />
//               </div>
//               <div className="p-4">
//                 <h3 className="font-bold text-slate-900">{item.name}</h3>
//                 <p className="text-sm text-slate-500 mt-1 line-clamp-2">{item.description}</p>
//                 <div className="flex items-center justify-between mt-4">
//                   <span className="font-bold text-slate-900">{formatCurrency('price' in item ? item.price : (item as Service).price)}</span>
//                   {isAppt && (
//                     <span className="text-xs text-slate-500 flex items-center gap-1">
//                       <Clock className="w-3 h-3" /> {formatDuration((item as Service).duration)}
//                     </span>
//                   )}
//                 </div>
//                 <Button
//                   onClick={() => addToCart(item)}
//                   size="sm"
//                   className="w-full mt-4 justify-center"
//                 >
//                   {isAppt ? "Book Now" : "Add to Order"}
//                 </Button>
//               </div>
//             </Card>
//           ))}
//         </div>
//       </main>

//       {/* Cart sidebar (unchanged) */}
//       <div className={`fixed inset-0 bg-black/50 z-50 transition-opacity ${cartOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setCartOpen(false)} />
//       <div className={`fixed right-0 top-0 h-full w-80 bg-white shadow-xl z-50 transform transition-transform ${cartOpen ? 'translate-x-0' : 'translate-x-full'}`}>
//         <div className="p-4 border-b border-slate-100 flex items-center justify-between">
//           <h3 className="font-bold text-slate-900">Your Cart</h3>
//           <button title="Close cart" onClick={() => setCartOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
//             <X className="w-5 h-5" />
//           </button>
//         </div>
//         <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(100vh-200px)]">
//           {cart.length === 0 ? (
//             <p className="text-center text-slate-400 py-8">Your cart is empty</p>
//           ) : (
//             cart.map(item => (
//               <div key={item.id} className="flex gap-3">
//                 <img src={item.image} alt={item.name} className="w-16 h-16 rounded-lg object-cover" />
//                 <div className="flex-1">
//                   <p className="font-medium text-slate-900">{item.name}</p>
//                   <p className="text-sm text-slate-500">{formatCurrency(item.price)}</p>
//                   <div className="flex items-center gap-2 mt-1">
//                     <button title="Decrease quantity" onClick={() => updateQuantity(item.id, -1)} className="p-1 rounded border border-slate-200 hover:bg-slate-50">
//                       <Minus className="w-3 h-3" />
//                     </button>
//                     <span className="text-sm w-6 text-center">{item.quantity}</span>
//                     <button title="Increase quantity" onClick={() => updateQuantity(item.id, 1)} className="p-1 rounded border border-slate-200 hover:bg-slate-50">
//                       <Plus className="w-3 h-3" />
//                     </button>
//                   </div>
//                 </div>
//               </div>
//             ))
//           )}
//         </div>
//         {cart.length > 0 && (
//           <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-100 bg-white">
//             <div className="flex items-center justify-between mb-4">
//               <span className="font-medium">Total</span>
//               <span className="font-bold text-slate-900">{formatCurrency(total)}</span>
//             </div>
//             <Button onClick={() => { setCheckoutOpen(true); setCartOpen(false); }} className="w-full justify-center">
//               Proceed to Checkout <ArrowRight className="w-4 h-4 ml-1" />
//             </Button>
//           </div>
//         )}
//       </div>

//       {/* Checkout modal (unchanged) */}
//       <Modal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} title="Checkout">
//         <div className="space-y-4">
//           <Input label="Full Name" value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })} />
//           <Input label="Email" type="email" value={customer.email} onChange={e => setCustomer({ ...customer, email: e.target.value })} />
//           <Input label="Phone" value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })} />
//           <div className="bg-slate-50 p-4 rounded-xl space-y-2">
//             <p className="font-medium">Order Summary</p>
//             {cart.map(item => (
//               <div key={item.id} className="flex justify-between text-sm">
//                 <span>{item.name} x{item.quantity}</span>
//                 <span>{formatCurrency(item.price * item.quantity)}</span>
//               </div>
//             ))}
//             <div className="border-t pt-2 flex justify-between font-bold">
//               <span>Total</span>
//               <span>{formatCurrency(total)}</span>
//             </div>
//           </div>
//           <Button onClick={placeOrder} className="w-full justify-center">
//             Place Order (Demo)
//           </Button>
//         </div>
//       </Modal>
//     </div>
//   );
// }
































"use client";

import { useState, useEffect } from "react";
import { ShoppingCart, X, Plus, Minus, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/app/components/Button";
import { Card } from "@/app/components/Card";
import { Input } from "@/app/components/input";
import { Modal } from "@/app/components/Modal";
import { getServicesByTenant, getProductsByTenant } from "@/app/data/mock";
import { formatCurrency, formatDuration } from "@/app/lib/utils";
import { getStoredProducts, getStoredServices } from "@/app/lib/storage";
import type { Tenant, Service, Product } from "@/app/types/index";

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

export default function StorefrontClient({ tenant }: { tenant: Tenant }) {
  const isAppt = tenant.businessType === "appointment";

  // Load products/services from localStorage (if available), otherwise fallback to mock data
  const [displayProducts, setDisplayProducts] = useState<Product[]>(() => {
    if (!isAppt) {
      const stored = getStoredProducts(tenant.id);
      return stored ?? getProductsByTenant(tenant.id).filter(p => p.isActive);
    }
    return [];
  });

  const [displayServices, setDisplayServices] = useState<Service[]>(() => {
    if (isAppt) {
      const stored = getStoredServices(tenant.id);
      return stored ?? getServicesByTenant(tenant.id).filter(s => s.isActive);
    }
    return [];
  });

  // Listen for storage changes (e.g., when tenant updates products in another tab)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `tenant_${tenant.id}_products` && !isAppt) {
        const newProducts = getStoredProducts(tenant.id);
        if (newProducts) {
          setDisplayProducts(newProducts.filter(p => p.isActive));
        }
      } else if (e.key === `tenant_${tenant.id}_services` && isAppt) {
        const newServices = getStoredServices(tenant.id);
        if (newServices) {
          setDisplayServices(newServices.filter(s => s.isActive));
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [tenant.id, isAppt]);

  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });

  const addToCart = (item: Service | Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        id: item.id,
        name: item.name,
        price: 'price' in item ? item.price : (item as Service).price,
        quantity: 1,
        image: item.image,
      }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.quantity + delta;
        return newQty <= 0 ? null : { ...item, quantity: newQty };
      }
      return item;
    }).filter(Boolean) as CartItem[]);
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const placeOrder = () => {
    if (!customer.name || !customer.email || !customer.phone) {
      alert("Please fill in all fields");
      return;
    }
    alert(`Order placed! (Demo)\n\n${cart.map(i => `${i.name} x${i.quantity}`).join('\n')}\nTotal: ${formatCurrency(total)}`);
    setCart([]);
    setCartOpen(false);
    setCheckoutOpen(false);
    setCustomer({ name: "", email: "", phone: "" });
  };

  const items = isAppt ? displayServices : displayProducts;

  // Placeholder image if none provided
  const getImageSrc = (src?: string) => src || "/placeholder.jpg";

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-slate-100 sticky top-0 bg-white z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ backgroundColor: tenant.logoBg }}>
              {tenant.logo}
            </div>
            <div>
              <h1 className="font-bold text-slate-900">{tenant.name}</h1>
              <p className="text-xs text-slate-500">{tenant.city}</p>
            </div>
          </div>
          <button
            onClick={() => setCartOpen(true)}
            className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
          >
            <ShoppingCart className="w-5 h-5" />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-violet-600 text-white text-xs rounded-full flex items-center justify-center">
                {cart.reduce((sum, i) => sum + i.quantity, 0)}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Hero */}
      <div className="relative h-64 md:h-80 overflow-hidden">
        <img src={tenant.coverImage} alt={tenant.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <div className="text-center text-white">
            <h2 className="text-3xl md:text-4xl font-bold">{tenant.name}</h2>
            <p className="mt-2 max-w-xl mx-auto px-4">{tenant.description}</p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-slate-900 mb-8">
          {isAppt ? "Our Services" : "Menu"}
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map(item => (
            <Card key={item.id} className="overflow-hidden group">
              <div className="relative h-48 overflow-hidden">
                <img
                  src={getImageSrc(item.image)}
                  alt={item.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition"
                />
              </div>
              <div className="p-4">
                <h3 className="font-bold text-slate-900">{item.name}</h3>
                <p className="text-sm text-slate-500 mt-1 line-clamp-2">{item.description}</p>
                <div className="flex items-center justify-between mt-4">
                  <span className="font-bold text-slate-900">{formatCurrency('price' in item ? item.price : (item as Service).price)}</span>
                  {isAppt && (
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {formatDuration((item as Service).duration)}
                    </span>
                  )}
                </div>
                <Button
                  onClick={() => addToCart(item)}
                  size="sm"
                  className="w-full mt-4 justify-center"
                >
                  {isAppt ? "Book Now" : "Add to Order"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </main>

      {/* Cart sidebar */}
      <div className={`fixed inset-0 bg-black/50 z-50 transition-opacity ${cartOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setCartOpen(false)} />
      <div className={`fixed right-0 top-0 h-full w-80 bg-white shadow-xl z-50 transform transition-transform ${cartOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Your Cart</h3>
          <button title="Close cart" onClick={() => setCartOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(100vh-200px)]">
          {cart.length === 0 ? (
            <p className="text-center text-slate-400 py-8">Your cart is empty</p>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex gap-3">
                <img
                  src={getImageSrc(item.image)}
                  alt={item.name}
                  className="w-16 h-16 rounded-lg object-cover"
                />
                <div className="flex-1">
                  <p className="font-medium text-slate-900">{item.name}</p>
                  <p className="text-sm text-slate-500">{formatCurrency(item.price)}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <button title="Remove item" onClick={() => updateQuantity(item.id, -1)} className="p-1 rounded border border-slate-200 hover:bg-slate-50">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-sm w-6 text-center">{item.quantity}</span>
                    <button title="Add item" onClick={() => updateQuantity(item.id, 1)} className="p-1 rounded border border-slate-200 hover:bg-slate-50">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        {cart.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-100 bg-white">
            <div className="flex items-center justify-between mb-4">
              <span className="font-medium">Total</span>
              <span className="font-bold text-slate-900">{formatCurrency(total)}</span>
            </div>
            <Button onClick={() => { setCheckoutOpen(true); setCartOpen(false); }} className="w-full justify-center">
              Proceed to Checkout <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </div>

      {/* Checkout modal */}
      <Modal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} title="Checkout">
        <div className="space-y-4">
          <Input label="Full Name" value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })} />
          <Input label="Email" type="email" value={customer.email} onChange={e => setCustomer({ ...customer, email: e.target.value })} />
          <Input label="Phone" value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })} />
          <div className="bg-slate-50 p-4 rounded-xl space-y-2">
            <p className="font-medium">Order Summary</p>
            {cart.map(item => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>{item.name} x{item.quantity}</span>
                <span>{formatCurrency(item.price * item.quantity)}</span>
              </div>
            ))}
            <div className="border-t pt-2 flex justify-between font-bold">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
          <Button onClick={placeOrder} className="w-full justify-center">
            Place Order (Demo)
          </Button>
        </div>
      </Modal>
    </div>
  );
}