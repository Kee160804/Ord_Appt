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
  ShoppingCart,
} from "lucide-react";
import {
  getServicesByTenant,
  getProductsByTenant,
  getCategoriesByTenant,
} from "@/app/data/mock";
import { getStoredProducts, getStoredServices } from "@/app/lib/storage";
import { isSupabaseConfigured } from "@/app/lib/supabase/config";
import { AppointmentBooking } from "../components/AppointmentBooking";
import { OrderingMenu } from "../components/OrderingMenu";
import { DemoDashboardPreview } from "../components/DemoDashboardPreview";
import { StorefrontContact } from "../components/StorefrontContact";
import { useTheme } from "@/app/contexts/theme";
import type {
  Category,
  Tenant,
  Service,
  Product,
  PublicServiceProvider,
} from "@/app/types/index";

// Gallery media is optional because older tenant records predate this field.
interface ExtendedTenant extends Tenant {
  galleryImages?: string[];
}

interface CartItem {
  id: string;
  variantId?: string;
  variantLabel?: string;
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
  initialProviders?: PublicServiceProvider[];
  viewOnly?: boolean;
}

export default function StorefrontClient({
  tenant,
  initialCategories,
  initialProducts,
  initialServices,
  initialProviders = [],
  viewOnly = false,
}: StorefrontClientProps) {
  const extendedTenant = tenant as ExtendedTenant;
  const isAppt = tenant.businessType === "appointment";
  const businessTypeLabel = isAppt
    ? "Appointments"
    : tenant.businessType === "retail"
      ? "Products & Retail"
      : "Food & Drinks";

  const [services, setServices] = useState<Service[]>(() => {
    if (isAppt) {
      return (
        initialServices ??
        getServicesByTenant(tenant.id).filter((s) => s.isActive)
      );
    }
    return [];
  });

  const [products, setProducts] = useState<Product[]>(() => {
    if (!isAppt) {
      return (
        initialProducts ??
        getProductsByTenant(tenant.id).filter((p) => p.isActive)
      );
    }
    return [];
  });

  const categories = !isAppt
    ? (initialCategories ?? getCategoriesByTenant(tenant.id))
    : [];

  // The cart lives at the storefront level so the header badge and ordering
  // panel always read from the same source of truth.
  const [cart, setCart] = useState<CartItem[]>([]);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleAddToCart = (item: CartItem) => {
    setCart((prev) => {
      const existing = prev.find(
        (i) => i.id === item.id && i.variantId === item.variantId,
      );
      if (existing) {
        const mergedAddons = [...existing.addons];
        item.addons.forEach((addon) => {
          const found = mergedAddons.find((a) => a.name === addon.name);
          if (!found) mergedAddons.push(addon);
        });
        return prev.map((i) =>
          i.id === item.id && i.variantId === item.variantId
            ? {
                ...i,
                quantity: i.quantity + item.quantity,
                addons: mergedAddons,
              }
            : i,
        );
      }
      return [...prev, item];
    });
  };

  const handleOrderPlaced = (
    orderedItems: { productId: string; quantity: number }[],
  ) => {
    const quantities = new Map(
      orderedItems.map((item) => [item.productId, item.quantity]),
    );
    setProducts((current) =>
      current.map((product) => {
        const orderedQuantity = quantities.get(product.id);
        if (!orderedQuantity || product.trackInventory === false)
          return product;
        return {
          ...product,
          inventory: Math.max(0, (product.inventory ?? 0) - orderedQuantity),
        };
      }),
    );
  };

  // Keep local-demo inventory in sync across browser tabs. Supabase-backed and
  // guided-demo storefronts receive their data from their own sources instead.
  useEffect(() => {
    // The guided demo must always use its bundled sample data. In particular,
    // do not let old browser demo/local data replace the curated preview.
    if (viewOnly || isSupabaseConfigured()) return;

    const frame = window.requestAnimationFrame(() => {
      if (isAppt) {
        const storedServices = getStoredServices(tenant.id);
        if (storedServices)
          setServices(storedServices.filter((service) => service.isActive));
      } else {
        const storedProducts = getStoredProducts(tenant.id);
        if (storedProducts)
          setProducts(storedProducts.filter((product) => product.isActive));
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

  // Storefront and guided-demo navigation are independent view states.
  const [activeTab, setActiveTab] = useState<"home" | "contact">("home");
  const [activeDemoView, setActiveDemoView] = useState<
    "dashboard" | "storefront"
  >(viewOnly ? "dashboard" : "storefront");

  const { theme, toggleTheme } = useTheme();

  // The cover image is always the first gallery item.
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const galleryImages = [tenant.coverImage || "/fallback-product.png"];
  if (extendedTenant.galleryImages && extendedTenant.galleryImages.length) {
    galleryImages.push(...extendedTenant.galleryImages);
  }
  const nextImage = () =>
    setCurrentImageIndex((prev) => (prev + 1) % galleryImages.length);
  const prevImage = () =>
    setCurrentImageIndex(
      (prev) => (prev - 1 + galleryImages.length) % galleryImages.length,
    );

  return (
    <div className="min-h-dvh bg-[#060b14] text-white transition-colors duration-200 light:bg-[#f6f7fb] light:text-slate-950">
      <div className="min-h-dvh">
        <div className="min-w-0">
          {/* Header */}
          <header className="pwa-header-inset sticky top-0 z-20 border-b border-[#1d2b42] bg-[#08111f]/95 backdrop-blur-xl light:border-slate-200 light:bg-white/95">
            <div className="mx-auto flex min-h-18 max-w-[1460px] items-center gap-3 px-4 py-2.5 sm:px-6">
              {viewOnly && (
                <Link
                  href="/login"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#29384f] text-slate-300 transition hover:border-violet-400 hover:text-violet-300 light:border-slate-200 light:text-slate-600"
                  aria-label="Back to sign in"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              )}

              <div className="flex min-w-0 items-center gap-3">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-black text-white shadow-[0_8px_24px_rgba(124,58,237,0.3)]"
                  style={{
                    background: `linear-gradient(145deg, ${tenant.primaryColor}, ${tenant.accentColor})`,
                  }}
                >
                  {tenant.logo}
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-base font-black text-white light:text-slate-950">
                    {tenant.name}
                  </h1>
                  <p className="truncate text-[11px] text-[#91a1ba] light:text-slate-500">
                    {tenant.businessType === "retail"
                      ? "Style Beyond Limits"
                      : tenant.city}
                  </p>
                </div>
              </div>

              {viewOnly && (
                <div
                  className="ml-3 hidden items-center rounded-xl border border-[#29384f] bg-[#0b1525] p-1 sm:flex light:border-slate-200 light:bg-slate-100"
                  role="tablist"
                  aria-label="Demo view"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeDemoView === "dashboard"}
                    onClick={() => setActiveDemoView("dashboard")}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition ${activeDemoView === "dashboard" ? "bg-violet-600 text-white" : "text-slate-400 light:text-slate-600"}`}
                  >
                    <LayoutDashboard className="h-4 w-4" /> Dashboard
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeDemoView === "storefront"}
                    onClick={() => setActiveDemoView("storefront")}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition ${activeDemoView === "storefront" ? "bg-violet-600 text-white" : "text-slate-400 light:text-slate-600"}`}
                  >
                    <Store className="h-4 w-4" /> Storefront
                  </button>
                </div>
              )}

              <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
                {(!viewOnly || activeDemoView === "storefront") && (
                  <nav
                    className="hidden items-center gap-7 md:flex"
                    aria-label="Storefront navigation"
                  >
                    <button
                      type="button"
                      onClick={() => setActiveTab("home")}
                      className="py-6 text-sm text-[#aebad0] transition hover:text-white light:text-slate-600 light:hover:text-slate-950"
                    >
                      Home
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("home")}
                      className={`relative py-6 text-sm font-semibold transition ${activeTab === "home" ? "text-white light:text-slate-950" : "text-[#aebad0] light:text-slate-600"}`}
                    >
                      {isAppt ? "Services" : "Menu"}
                      {activeTab === "home" && (
                        <span className="absolute inset-x-0 bottom-2 h-0.5 rounded-full bg-violet-500" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("contact")}
                      className={`relative py-6 text-sm transition ${activeTab === "contact" ? "font-semibold text-white light:text-slate-950" : "text-[#aebad0] light:text-slate-600"}`}
                    >
                      Contact
                      {activeTab === "contact" && (
                        <span className="absolute inset-x-0 bottom-2 h-0.5 rounded-full bg-violet-500" />
                      )}
                    </button>
                  </nav>
                )}

                {!isAppt && (!viewOnly || activeDemoView === "storefront") && (
                  <button
                    type="button"
                    onClick={() =>
                      document
                        .getElementById("order-summary")
                        ?.scrollIntoView({ behavior: "smooth" })
                    }
                    className="relative flex h-10 w-10 items-center justify-center rounded-xl text-[#b8c5d8] transition hover:bg-white/5 hover:text-white light:text-slate-600 light:hover:bg-slate-100"
                    aria-label={`View cart with ${itemCount} items`}
                  >
                    <ShoppingCart className="h-5 w-5" />
                    {itemCount > 0 && (
                      <span className="absolute right-0 top-0 flex h-5 min-w-5 translate-x-1/4 -translate-y-1/4 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-black text-white">
                        {itemCount > 99 ? "99+" : itemCount}
                      </span>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={toggleTheme}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-[#b8c5d8] transition hover:bg-white/5 hover:text-white light:text-slate-600 light:hover:bg-slate-100"
                  aria-label="Toggle dark mode"
                >
                  {theme === "light" ? (
                    <Moon className="h-4.5 w-4.5" />
                  ) : (
                    <Sun className="h-4.5 w-4.5" />
                  )}
                </button>
              </div>
            </div>
          </header>

          {viewOnly && (
            <div className="border-b border-violet-500/20 bg-violet-500/10 px-4 py-3 text-center text-sm font-medium text-violet-200">
              Demo experience — sample data only. Nothing here changes your
              account, Supabase data, orders, or appointments.
            </div>
          )}

          {viewOnly && activeDemoView === "dashboard" && (
            <DemoDashboardPreview tenant={tenant} />
          )}

          {/* Hero (clickable, only on home tab) */}
          {(!viewOnly || activeDemoView === "storefront") &&
            activeTab === "home" &&
            isAppt && (
              <div
                className="relative mx-3 mt-3 h-56 cursor-pointer overflow-hidden rounded-2xl border border-slate-800 sm:mx-5 md:h-72"
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
                    (e.target as HTMLImageElement).src =
                      "/fallback-product.png";
                  }}
                />
                <div className="absolute inset-0 flex items-center bg-gradient-to-r from-black/80 via-black/35 to-black/10">
                  <div className="max-w-xl px-6 text-left text-white sm:px-10">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-[0.25em] text-violet-300">
                      {businessTypeLabel}
                    </p>
                    <h2 className="text-3xl font-black md:text-5xl">
                      {tenant.name}
                    </h2>
                    <p className="mt-3 max-w-xl text-sm text-slate-200 sm:text-base">
                      {tenant.description}
                    </p>
                  </div>
                </div>
              </div>
            )}

          {/* Main content */}
          {(!viewOnly || activeDemoView === "storefront") && (
            <main className="mx-auto max-w-[1460px] px-4 py-5 sm:px-6 sm:py-6">
              {activeTab === "home" ? (
                isAppt ? (
                  <AppointmentBooking
                    tenant={tenant}
                    services={services}
                    providers={initialProviders}
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
                    onOpenGallery={() => {
                      setCurrentImageIndex(0);
                      setGalleryOpen(true);
                    }}
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
      </div>
    </div>
  );
}
