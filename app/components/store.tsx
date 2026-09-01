"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  LayoutDashboard,
  Sun,
  Moon,
  X,
  ChevronLeft,
  ChevronRight,
  Store,
} from "lucide-react";
import { getServicesByTenant, getProductsByTenant, getCategoriesByTenant } from "@/app/data/mock";
import { getStoredProducts, getStoredServices } from "@/app/lib/storage";
import { isSupabaseConfigured } from "@/app/lib/supabase/config";
import { AppointmentBooking } from "../components/AppointmentBooking";
import { OrderingMenu } from "../components/OrderingMenu";
import { DemoDashboardPreview } from "../components/DemoDashboardPreview";
import { StorefrontContact } from "../components/StorefrontContact";
import { useTheme } from "@/app/contexts/theme";
import type { Category, Tenant, Service, Product } from "@/app/types/index";

// Extend Tenant with optional fields used in this component
interface ExtendedTenant extends Tenant {
  galleryImages?: string[];
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  addons: { id: string; name: string; price: number }[];
  image?: string;
}

interface StorefrontClientProps {
  tenant: Tenant;
  initialCategories?: Category[];
  initialProducts?: Product[];
  initialServices?: Service[];
  viewOnly?: boolean;
}

export default function StorefrontClient({
  tenant,
  initialCategories,
  initialProducts,
  initialServices,
  viewOnly = false,
}: StorefrontClientProps) {
  // Cast to extended type to safely access optional fields
  const extendedTenant = tenant as ExtendedTenant;
  const isAppt = tenant.businessType === "appointment";

  const [services, setServices] = useState<Service[]>(() => {
    if (isAppt) {
      return initialServices ?? getServicesByTenant(tenant.id).filter((s) => s.isActive);
    }
    return [];
  });

  const [products, setProducts] = useState<Product[]>(() => {
    if (!isAppt) {
      return initialProducts ?? getProductsByTenant(tenant.id).filter((p) => p.isActive);
    }
    return [];
  });

  const categories = !isAppt ? initialCategories ?? getCategoriesByTenant(tenant.id) : [];

  // Cart state (for ordering)
  const [cart, setCart] = useState<CartItem[]>([]);

  const handleAddToCart = (item: CartItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        const mergedAddons = [...existing.addons];
        item.addons.forEach((addon) => {
          const found = mergedAddons.find((a) => a.name === addon.name);
          if (!found) mergedAddons.push(addon);
        });
        return prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                quantity: i.quantity + item.quantity,
                addons: mergedAddons,
              }
            : i
        );
      }
      return [...prev, item];
    });
  };

  const handleOrderPlaced = (orderedItems: { productId: string; quantity: number }[]) => {
    const quantities = new Map(orderedItems.map((item) => [item.productId, item.quantity]));
    setProducts((current) => current.map((product) => {
      const orderedQuantity = quantities.get(product.id);
      if (!orderedQuantity || product.trackInventory === false) return product;
      return {
        ...product,
        inventory: Math.max(0, (product.inventory ?? 0) - orderedQuantity),
      };
    }));
  };

  // Storage event listener
  useEffect(() => {
    // The guided demo must always use its bundled sample data. In particular,
    // do not let old browser demo/local data replace the curated preview.
    if (viewOnly || isSupabaseConfigured()) return;

    const frame = window.requestAnimationFrame(() => {
      if (isAppt) {
        const storedServices = getStoredServices(tenant.id);
        if (storedServices) setServices(storedServices.filter((service) => service.isActive));
      } else {
        const storedProducts = getStoredProducts(tenant.id);
        if (storedProducts) setProducts(storedProducts.filter((product) => product.isActive));
      }
    });

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `tenant_${tenant.id}_products` && !isAppt) {
        const newProducts = getStoredProducts(tenant.id);
        if (newProducts) setProducts(newProducts.filter((p) => p.isActive));
      } else if (e.key === `tenant_${tenant.id}_services` && isAppt) {
        const newServices = getStoredServices(tenant.id);
        if (newServices) setServices(newServices.filter((s) => s.isActive));
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [tenant.id, isAppt, viewOnly]);



  // ---------- Tab Navigation ----------
  const [activeTab, setActiveTab] = useState<"home" | "contact">("home");
  const [activeDemoView, setActiveDemoView] = useState<"dashboard" | "storefront">(
    viewOnly ? "dashboard" : "storefront",
  );

  const { theme, toggleTheme } = useTheme();

  // ---------- Image Gallery Modal ----------
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const galleryImages = [tenant.coverImage || "/fallback-product.png"];
  if (extendedTenant.galleryImages && extendedTenant.galleryImages.length) {
    galleryImages.push(...extendedTenant.galleryImages);
  }
  const nextImage = () =>
    setCurrentImageIndex((prev) => (prev + 1) % galleryImages.length);
  const prevImage = () =>
    setCurrentImageIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);

  return (
    <div className="min-h-dvh bg-white transition-colors duration-200 dark:bg-[#070b14]">
      {/* Header */}
      <header className="border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-[#070b14] z-20">
        <div className="mx-auto max-w-[1500px] px-3 py-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            {viewOnly && (
              <Link
                href="/login"
                className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-violet-400 hover:text-violet-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-violet-500 dark:hover:text-violet-300"
                aria-label="Back to sign in"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back to sign in</span>
              </Link>
            )}
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white font-bold"
                style={{ backgroundColor: tenant.logoBg }}
              >
                {tenant.logo}
              </div>
              <div className={viewOnly ? "hidden min-w-0 sm:block" : "min-w-0"}>
                <h1 className="truncate font-bold text-slate-900 dark:text-white">{tenant.name}</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">{tenant.city}</p>
              </div>
            </div>

            {viewOnly && (
              <div className="order-last mx-auto flex w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-900 sm:w-auto lg:order-none" role="tablist" aria-label="Demo view">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeDemoView === "dashboard"}
                  onClick={() => setActiveDemoView("dashboard")}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition sm:px-4 ${
                    activeDemoView === "dashboard"
                      ? "bg-violet-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="hidden sm:inline">Demo Dashboard</span>
                  <span className="sm:hidden">Dashboard</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeDemoView === "storefront"}
                  onClick={() => setActiveDemoView("storefront")}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition sm:px-4 ${
                    activeDemoView === "storefront"
                      ? "bg-violet-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  <Store className="h-4 w-4" />
                  Storefront
                </button>
              </div>
            )}

            <div className="ml-auto flex items-center gap-3">
              {/* Navigation Tabs */}
              {(!viewOnly || activeDemoView === "storefront") && (
              <div className="hidden gap-2 text-sm font-medium lg:flex">
                <button
                  onClick={() => setActiveTab("home")}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    activeTab === "home"
                      ? "bg-violet-600 text-white"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                  aria-label="Home"
                >
                  Home
                </button>
                <button
                  onClick={() => setActiveTab("contact")}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    activeTab === "contact"
                      ? "bg-violet-600 text-white"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                  aria-label="Contact"
                >
                  Contact
                </button>
              </div>
              )}
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                aria-label="Toggle dark mode"
              >
                {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {(!viewOnly || activeDemoView === "storefront") && (
            <div className="mt-3 grid grid-cols-2 gap-2 lg:hidden" role="tablist" aria-label="Storefront pages">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "home"}
                onClick={() => setActiveTab("home")}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  activeTab === "home"
                    ? "bg-violet-600 text-white"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                Home
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "contact"}
                onClick={() => setActiveTab("contact")}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  activeTab === "contact"
                    ? "bg-violet-600 text-white"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                Contact
              </button>
            </div>
          )}
        </div>
      </header>

      {viewOnly && (
        <div className="border-b border-violet-200 bg-violet-50 px-4 py-3 text-center text-sm font-medium text-violet-800 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-200">
          Demo experience — sample data only. Nothing here changes your account, Supabase data, orders, or appointments.
        </div>
      )}

      {viewOnly && activeDemoView === "dashboard" && (
        <DemoDashboardPreview tenant={tenant} />
      )}

      {/* Hero (clickable, only on home tab) */}
      {(!viewOnly || activeDemoView === "storefront") && activeTab === "home" && (
        <div
          className="relative h-64 md:h-80 overflow-hidden cursor-pointer"
          onClick={() => {
            setCurrentImageIndex(0);
            setGalleryOpen(true);
          }}
        >
          <Image
            src={tenant.coverImage || "/fallback-product.png"}
            alt={tenant.name}
            fill
            sizes="100vw"
            className="object-cover"
            unoptimized
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/fallback-product.png";
            }}
          />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="text-center text-white">
              <h2 className="text-3xl md:text-4xl font-bold">{tenant.name}</h2>
              <p className="mt-2 max-w-xl mx-auto px-4">{tenant.description}</p>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      {(!viewOnly || activeDemoView === "storefront") && (
      <main className={`${activeTab === "contact" ? "max-w-[1500px]" : "max-w-6xl"} mx-auto px-3 py-8 sm:px-4 sm:py-12`}>
        {activeTab === "home" ? (
          isAppt ? (
            <AppointmentBooking
              tenant={tenant}
              services={services}
              viewOnly={viewOnly}
            />
          ) : (
            <OrderingMenu
              tenant={tenant}
              products={products}
              categories={categories}
              onAddToCart={handleAddToCart}
              cart={cart}
              updateCart={setCart}
              onOrderPlaced={handleOrderPlaced}
              viewOnly={viewOnly}
            />
          )
        ) : (
          <StorefrontContact tenant={tenant} viewOnly={viewOnly} />
        )}
      </main>
      )}

      {/* Image Gallery Modal */}
      {galleryOpen && (!viewOnly || activeDemoView === "storefront") && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50"
          onClick={() => setGalleryOpen(false)}
        >
          <div
            className="relative w-full max-w-4xl max-h-[90vh] p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setGalleryOpen(false)}
              className="absolute top-2 right-2 text-white bg-black/50 rounded-full p-1 z-10 hover:bg-black/70"
              aria-label="Close gallery"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="relative h-[80dvh] w-full">
              <Image
                src={galleryImages[currentImageIndex]}
                alt="Gallery"
                fill
                className="object-contain"
                unoptimized
              />
            </div>
            {galleryImages.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-2 hover:bg-black/70"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-2 hover:bg-black/70"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
