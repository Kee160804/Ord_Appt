"use client";

import { useState, useEffect } from "react";
import { getServicesByTenant, getProductsByTenant, getCategoriesByTenant } from "@/app/data/mock";
import { getStoredProducts, getStoredServices } from "@/app/lib/storage";
import { AppointmentBooking } from "../components/AppointmentBooking";
import { OrderingMenu } from "../components/OrderingMenu";
import type { Tenant, Service, Product } from "@/app/types/index";

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  addons: { name: string; price: number }[];
  image?: string;
}

export default function StorefrontClient({ tenant }: { tenant: Tenant }) {
  const isAppt = tenant.businessType === "appointment";

  // Load data from localStorage or fallback to mock
  const [services, setServices] = useState<Service[]>(() => {
    if (isAppt) {
      const stored = getStoredServices(tenant.id);
      return stored ?? getServicesByTenant(tenant.id).filter(s => s.isActive);
    }
    return [];
  });

  const [products, setProducts] = useState<Product[]>(() => {
    if (!isAppt) {
      const stored = getStoredProducts(tenant.id);
      return stored ?? getProductsByTenant(tenant.id).filter(p => p.isActive);
    }
    return [];
  });

  const categories = !isAppt ? getCategoriesByTenant(tenant.id) : [];

  // Cart state (for ordering)
  const [cart, setCart] = useState<CartItem[]>([]);

  const handleAddToCart = (item: CartItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i =>
          i.id === item.id
            ? {
                ...i,
                quantity: i.quantity + item.quantity,
                addons: [...i.addons, ...item.addons],
              }
            : i
        );
      }
      return [...prev, item];
    });
  };

  // Storage event listener (same as before)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `tenant_${tenant.id}_products` && !isAppt) {
        const newProducts = getStoredProducts(tenant.id);
        if (newProducts) setProducts(newProducts.filter(p => p.isActive));
      } else if (e.key === `tenant_${tenant.id}_services` && isAppt) {
        const newServices = getStoredServices(tenant.id);
        if (newServices) setServices(newServices.filter(s => s.isActive));
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [tenant.id, isAppt]);

  return (
    <div className="min-h-screen bg-white dark:bg-[#070b14]">
      {/* Header (reused from earlier) */}
      <header className="border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-[#070b14] z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: tenant.logoBg }}
            >
              {tenant.logo}
            </div>
            <div>
              <h1 className="font-bold text-slate-900 dark:text-white">{tenant.name}</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">{tenant.city}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Hero (reused) */}
      <div className="relative h-64 md:h-80 overflow-hidden">
        <img
          src={tenant.coverImage || "/fallback-product.png"}
          alt={tenant.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <div className="text-center text-white">
            <h2 className="text-3xl md:text-4xl font-bold">{tenant.name}</h2>
            <p className="mt-2 max-w-xl mx-auto px-4">{tenant.description}</p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-12">
        {isAppt ? (
          <AppointmentBooking
            tenant={tenant}
            services={services}
            onBook={(serviceId, date, time) => {
              alert(`Booking requested for ${serviceId} on ${date} at ${time}`);
              // Here you would add to cart or submit booking
            }}
          />
        ) : (
          <OrderingMenu
            tenant={tenant}
            products={products}
            categories={categories}
            onAddToCart={handleAddToCart}
            cart={cart}
            updateCart={setCart}
          />
        )}
      </main>
    </div>
  );
}