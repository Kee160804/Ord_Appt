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
  Search,
  Info,
  Phone,
  BadgePercent,
} from "lucide-react";
import {
  getServicesByTenant,
  getProductsByTenant,
  getCategoriesByTenant,
} from "@/app/data/mock";
import { getStoredProducts, getStoredServices } from "@/app/lib/storage";
import { isSupabaseConfigured } from "@/app/lib/supabase/config";
import { tenantHasFeature } from "@/app/lib/plans";
import { parseStorefrontDesign } from "@/app/lib/storefront-design";
import { AppointmentBooking } from "../components/AppointmentBooking";
import { OrderingMenu } from "../components/OrderingMenu";
import { BusinessLogo } from "../components/BusinessLogo";
import { DemoDashboardPreview } from "../components/DemoDashboardPreview";
import { StorefrontContact } from "../components/StorefrontContact";
import { StorefrontPromotions } from "../components/StorefrontPromotions";
import { StorefrontAbout } from "../components/StorefrontAbout";
import { useTheme } from "@/app/contexts/theme";
import type {
  BusinessReview,
  Category,
  Tenant,
  Service,
  Product,
  PublicPromotion,
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

/**
 * Builds a deterministic identity for one configured cart line.
 *
 * A cart line is only the same when ALL of these match:
 * - product ID
 * - selected variant ID
 * - selected add-on IDs
 *
 * Add-on IDs are sorted before joining so selecting the same add-ons in a
 * different UI order still produces the same cart identity.
 *
 * This prevents two differently configured products from being merged into
 * one line and incorrectly applying one set of add-ons across both quantities.
 */
function cartLineKey(item: CartItem): string {
  const addonIds = item.addons
    .map((addon) => addon.id)
    .filter(Boolean)
    .sort()
    .join(",");

  return `${item.id}::${item.variantId ?? ""}::${addonIds}`;
}

/**
 * Returns a defensive copy of a cart item with normalized quantity/add-ons.
 *
 * The cart should never hold duplicate add-on IDs for the same configured line.
 */
function normalizeCartItem(item: CartItem): CartItem {
  const uniqueAddons = Array.from(
    new Map(
      item.addons.filter((addon) => addon.id).map((addon) => [addon.id, addon]),
    ).values(),
  );

  return {
    ...item,
    quantity: Math.max(1, Math.floor(item.quantity || 1)),
    addons: uniqueAddons,
  };
}

interface StorefrontClientProps {
  tenant: Tenant;
  initialCategories?: Category[];
  initialProducts?: Product[];
  initialServices?: Service[];
  initialProviders?: PublicServiceProvider[];
  initialReviews?: BusinessReview[];
  initialPromotions?: PublicPromotion[];
  viewOnly?: boolean;
}

export default function StorefrontClient({
  tenant,
  initialCategories,
  initialProducts,
  initialServices,
  initialProviders = [],
  initialReviews = [],
  initialPromotions = [],
  viewOnly = false,
}: StorefrontClientProps) {
  const extendedTenant = tenant as ExtendedTenant;
  const isAppt = tenant.businessType === "appointment";
  const todayHours = tenant.businessHours[new Date().getDay()];

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

  /**
   * Adds one configured product to the cart.
   *
   * IMPORTANT:
   * Product ID + variant ID alone are not enough to identify a cart line.
   * Different add-on selections must stay as separate lines because their
   * pricing/configuration differs.
   *
   * Example:
   *   Burger / Large / Cheese
   *   Burger / Large / Bacon
   *
   * Those are two different cart lines.
   *
   * But adding Burger / Large / Cheese twice safely increases the quantity of
   * the existing Cheese line.
   */
  const handleAddToCart = (item: CartItem) => {
    const normalizedItem = normalizeCartItem(item);
    const incomingKey = cartLineKey(normalizedItem);

    setCart((previous) => {
      const existing = previous.find(
        (cartItem) => cartLineKey(cartItem) === incomingKey,
      );

      if (!existing) {
        return [...previous, normalizedItem];
      }

      return previous.map((cartItem) =>
        cartLineKey(cartItem) === incomingKey
          ? {
              ...cartItem,
              quantity: cartItem.quantity + normalizedItem.quantity,
            }
          : cartItem,
      );
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
  type StorefrontTab = "catalog" | "about" | "promotions" | "contact";
  const [activeTab, setActiveTab] = useState<StorefrontTab>("catalog");
  const [selectedPromotionId, setSelectedPromotionId] = useState<string>();
  const [activeDemoView, setActiveDemoView] = useState<
    "dashboard" | "storefront"
  >(viewOnly ? "dashboard" : "storefront");

  const { theme, toggleTheme } = useTheme();
  const catalogLabel = isAppt
    ? "Services"
    : tenant.businessType === "retail"
      ? "Shop"
      : "Menu";
  const canShowPromotions = tenantHasFeature(tenant, "storefront_promotions");
  const storefrontDesign = parseStorefrontDesign(
    tenant.storefrontDesign,
    tenant.businessType,
  );
  const showPromotions =
    canShowPromotions && storefrontDesign.sections.promotions;

  const switchTab = (tab: StorefrontTab, promotionId?: string) => {
    setActiveTab(tab);
    setSelectedPromotionId(promotionId);
    const url = new URL(window.location.href);
    if (tab === "catalog") url.searchParams.delete("tab");
    else url.searchParams.set("tab", tab);
    if (tab === "promotions" && promotionId) {
      url.searchParams.set("promotion", promotionId);
    } else {
      url.searchParams.delete("promotion");
    }
    window.history.pushState({}, "", url);
  };

  useEffect(() => {
    const syncTabFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      const nextTab: StorefrontTab =
        tab === "about" || tab === "contact"
          ? tab
          : tab === "promotions" && showPromotions
            ? "promotions"
            : "catalog";
      setActiveTab(nextTab);
      setSelectedPromotionId(params.get("promotion") ?? undefined);
    };
    syncTabFromUrl();
    window.addEventListener("popstate", syncTabFromUrl);
    return () => window.removeEventListener("popstate", syncTabFromUrl);
  }, [showPromotions]);

  useEffect(() => {
    if (activeTab !== "promotions" || !selectedPromotionId) return;
    document
      .getElementById(`promotion-${selectedPromotionId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeTab, selectedPromotionId]);

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
          <header className="pwa-header-inset sticky top-0 z-20 px-2 pt-2 sm:px-4 sm:pt-3">
            <div className="mx-auto max-w-365 rounded-2xl border border-[#25344c] bg-[#07111f]/95 px-3 py-3 shadow-[0_20px_50px_rgba(4,8,18,0.35)] backdrop-blur-xl light:border-slate-200 light:bg-white/95 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                {viewOnly && (
                  <Link
                    href="/login"
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#29384f] text-slate-300 transition hover:border-violet-400 hover:text-violet-300 light:border-slate-200 light:text-slate-600"
                    aria-label="Back to sign in"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                )}

                <div className="flex min-w-0 shrink-0 items-center gap-3">
                  <BusinessLogo
                    tenant={tenant}
                    className="h-11 w-11 rounded-xl text-lg font-black shadow-[0_8px_24px_rgba(124,58,237,0.3)]"
                  />
                  <div className="min-w-0">
                    <h1 className="truncate text-base font-black text-white light:text-slate-950">
                      {tenant.name}
                    </h1>
                    <p className="truncate text-[9px] font-bold uppercase tracking-[0.28em] text-[#91a1ba] light:text-slate-500">
                      Storefront
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

                {(!viewOnly || activeDemoView === "storefront") && (
                  <nav
                    className="ml-auto hidden min-w-0 items-center gap-1 lg:flex"
                    aria-label="Storefront navigation"
                  >
                    {[
                      {
                        id: "catalog" as const,
                        label: catalogLabel,
                        icon: Store,
                      },
                      ...(storefrontDesign.sections.about
                        ? [{ id: "about" as const, label: "About", icon: Info }]
                        : []),
                      ...(showPromotions
                        ? [
                            {
                              id: "promotions" as const,
                              label: "Promotions",
                              icon: BadgePercent,
                            },
                          ]
                        : []),
                      ...(storefrontDesign.sections.contact
                        ? [{ id: "contact" as const, label: "Contact", icon: Phone }]
                        : []),
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => switchTab(item.id)}
                          className={`inline-flex min-h-12 items-center gap-2 rounded-2xl px-4 text-sm font-bold transition ${activeTab === item.id ? "bg-violet-500/20 text-violet-300 light:bg-violet-100 light:text-violet-700" : "text-[#b8c5d8] hover:bg-white/5 hover:text-white light:text-slate-600 light:hover:bg-slate-100 light:hover:text-slate-950"}`}
                        >
                          <Icon className="h-5 w-5" /> {item.label}
                        </button>
                      );
                    })}
                  </nav>
                )}

                <div className="ml-auto flex shrink-0 items-center gap-1.5 border-l border-[#29384f] pl-2 sm:gap-2 sm:pl-4 light:border-slate-200">
                  {(!viewOnly || activeDemoView === "storefront") && (
                    <button
                      type="button"
                      onClick={() => {
                        switchTab("catalog");
                        window.setTimeout(
                          () =>
                            document
                              .getElementById("storefront-search")
                              ?.focus(),
                          50,
                        );
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-[#b8c5d8] transition hover:bg-white/5 hover:text-white light:text-slate-600 light:hover:bg-slate-100"
                      aria-label={`Search ${catalogLabel.toLowerCase()}`}
                    >
                      <Search className="h-5 w-5" />
                    </button>
                  )}
                  {(!viewOnly || activeDemoView === "storefront") &&
                    !isAppt && (
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

              {(!viewOnly || activeDemoView === "storefront") && (
                <nav
                  className="mt-3 flex gap-2 overflow-x-auto border-t border-[#1d2b42] pt-3 lg:hidden light:border-slate-200"
                  aria-label="Storefront navigation"
                >
                  {[
                    {
                      id: "catalog" as const,
                      label: catalogLabel,
                      icon: Store,
                    },
                    ...(storefrontDesign.sections.about
                      ? [{ id: "about" as const, label: "About", icon: Info }]
                      : []),
                    ...(showPromotions
                      ? [
                          {
                            id: "promotions" as const,
                            label: "Promotions",
                            icon: BadgePercent,
                          },
                        ]
                      : []),
                    ...(storefrontDesign.sections.contact
                      ? [{ id: "contact" as const, label: "Contact", icon: Phone }]
                      : []),
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => switchTab(item.id)}
                        className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-bold transition ${activeTab === item.id ? "bg-violet-500/20 text-violet-300 light:bg-violet-100 light:text-violet-700" : "text-[#b8c5d8] light:text-slate-600"}`}
                      >
                        <Icon className="h-4 w-4" /> {item.label}
                      </button>
                    );
                  })}
                </nav>
              )}

              {viewOnly && (
                <div
                  className="pwa-demo-view-switcher mx-auto w-full max-w-365 grid-cols-2 gap-2 px-4 pb-3 sm:px-6"
                  role="tablist"
                  aria-label="Demo view"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeDemoView === "dashboard"}
                    onClick={() => setActiveDemoView("dashboard")}
                    className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${activeDemoView === "dashboard" ? "border-violet-500 bg-violet-600 text-white" : "border-[#29384f] bg-[#0b1525] text-slate-300 light:border-slate-200 light:bg-slate-100 light:text-slate-700"}`}
                  >
                    <LayoutDashboard className="h-4 w-4" /> Dashboard
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeDemoView === "storefront"}
                    onClick={() => setActiveDemoView("storefront")}
                    className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${activeDemoView === "storefront" ? "border-violet-500 bg-violet-600 text-white" : "border-[#29384f] bg-[#0b1525] text-slate-300 light:border-slate-200 light:bg-slate-100 light:text-slate-700"}`}
                  >
                    <Store className="h-4 w-4" /> Storefront
                  </button>
                </div>
              )}
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

          {/* Main content */}
          {(!viewOnly || activeDemoView === "storefront") && (
            <main className="mx-auto max-w-365 px-4 py-5 sm:px-6 sm:py-6">
              {activeTab === "catalog" ? (
                isAppt ? (
                  <AppointmentBooking
                    tenant={tenant}
                    services={services}
                    providers={initialProviders}
                    reviews={initialReviews}
                    promotions={initialPromotions}
                    viewOnly={viewOnly}
                  />
                ) : (
                  <OrderingMenu
                    tenant={tenant}
                    products={products}
                    categories={categories}
                    promotions={initialPromotions}
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
              ) : activeTab === "about" ? (
                <StorefrontAbout tenant={tenant} />
              ) : activeTab === "promotions" ? (
                <StorefrontPromotions
                  tenant={tenant}
                  promotions={initialPromotions}
                  selectedPromotionId={selectedPromotionId}
                />
              ) : (
                <StorefrontContact tenant={tenant} viewOnly={viewOnly} />
              )}
            </main>
          )}

          {(!viewOnly || activeDemoView === "storefront") && (
            <footer className="border-t border-[#1d2b42] bg-[#08111f] light:border-slate-200 light:bg-white">
              <div className="mx-auto flex max-w-365 flex-col gap-3 px-4 py-5 text-[11px] text-[#8292aa] sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  <span className="font-black text-white light:text-slate-950">
                    {tenant.name}
                  </span>
                  <span>
                    {todayHours?.closed
                      ? "Closed today"
                      : `Open today ${todayHours?.open ?? ""} - ${todayHours?.close ?? ""}`}
                  </span>
                  <span>{tenant.phone}</span>
                  <span>{tenant.city}</span>
                </div>
                <span>Secure storefront powered by YuhBusiness</span>
              </div>
            </footer>
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
