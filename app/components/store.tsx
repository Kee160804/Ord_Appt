"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
  Sun,
  Moon,
  X,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  Globe,
  Facebook,
  Instagram,
  Twitter,
} from "lucide-react";
import { getServicesByTenant, getProductsByTenant, getCategoriesByTenant } from "@/app/data/mock";
import { getStoredProducts, getStoredServices } from "@/app/lib/storage";
import { AppointmentBooking } from "../components/AppointmentBooking";
import { OrderingMenu } from "../components/OrderingMenu";
import type { Tenant, Service, Product } from "@/app/types/index";

// Extend Tenant with optional fields used in this component
interface ExtendedTenant extends Tenant {
  website?: string;
  facebook?: string;
  instagram?: string;
  twitter?: string;
  galleryImages?: string[];
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  addons: { name: string; price: number }[];
  image?: string;
}

export default function StorefrontClient({ tenant }: { tenant: Tenant }) {
  // Cast to extended type to safely access optional fields
  const extendedTenant = tenant as ExtendedTenant;
  const isAppt = tenant.businessType === "appointment";

  // Load data from localStorage or fallback to mock
  const [services, setServices] = useState<Service[]>(() => {
    if (isAppt) {
      const stored = getStoredServices(tenant.id);
      return stored ?? getServicesByTenant(tenant.id).filter((s) => s.isActive);
    }
    return [];
  });

  const [products, setProducts] = useState<Product[]>(() => {
    if (!isAppt) {
      const stored = getStoredProducts(tenant.id);
      return stored ?? getProductsByTenant(tenant.id).filter((p) => p.isActive);
    }
    return [];
  });

  const categories = !isAppt ? getCategoriesByTenant(tenant.id) : [];

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

  // Storage event listener
  useEffect(() => {
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
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [tenant.id, isAppt]);


  // ---------- Theme Toggle ----------
const getInitialTheme = (): "light" | "dark" => {
  if (typeof window === "undefined") return "light";
  const saved = localStorage.getItem("theme") as "light" | "dark" | null;
  if (saved) return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const [theme, setTheme] = useState<"light" | "dark">(getInitialTheme);

useEffect(() => {
  // Apply theme class to document
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem("theme", theme);
}, [theme]);

const toggleTheme = () => {
  setTheme(prev => prev === "light" ? "dark" : "light");
};

  // ---------- Tab Navigation ----------
  const [activeTab, setActiveTab] = useState<"home" | "contact">("home");

  // ---------- Contact Information ----------
  const contactInfo = {
    email: extendedTenant.email || `contact@${extendedTenant.slug}.com`,
    phone: extendedTenant.phone || "+1 (555) 123-4567",
    website: extendedTenant.website || `https://${extendedTenant.slug}.com`,
    social: {
      facebook: extendedTenant.facebook || null,
      instagram: extendedTenant.instagram || null,
      twitter: extendedTenant.twitter || null,
    },
  };

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
    <div className="min-h-screen bg-white dark:bg-[#070b14] transition-colors duration-200">
      {/* Header */}
      <header className="border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-[#070b14] z-20">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
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
            <div className="flex items-center gap-3">
              {/* Navigation Tabs */}
              <div className="flex gap-2 text-sm font-medium">
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
        </div>
      </header>

      {/* Hero (clickable, only on home tab) */}
      {activeTab === "home" && (
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
      <main className="max-w-6xl mx-auto px-4 py-12">
        {activeTab === "home" ? (
          isAppt ? (
            <AppointmentBooking
              tenant={tenant}
              services={services}
              onBook={(serviceId, date, time) => {
                alert(`Booking requested for ${serviceId} on ${date} at ${time}`);
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
          )
        ) : (
          // Contact Page
          <div className="max-w-2xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 md:p-8">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
              Contact {tenant.name}
            </h2>
            <div className="space-y-6 text-slate-600 dark:text-slate-300">
              {contactInfo.email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-violet-500" />
                  <a href={`mailto:${contactInfo.email}`} className="hover:text-violet-600">
                    {contactInfo.email}
                  </a>
                </div>
              )}
              {contactInfo.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-violet-500" />
                  <a href={`tel:${contactInfo.phone}`} className="hover:text-violet-600">
                    {contactInfo.phone}
                  </a>
                </div>
              )}
              {contactInfo.website && (
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-violet-500" />
                  <a
                    href={contactInfo.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-violet-600"
                  >
                    Website
                  </a>
                </div>
              )}
              {(contactInfo.social.facebook ||
                contactInfo.social.instagram ||
                contactInfo.social.twitter) && (
                <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                    Social Media
                  </h3>
                  <div className="flex gap-4">
                    {contactInfo.social.facebook && (
                      <a
                        href={contactInfo.social.facebook}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-500 hover:text-violet-600 transition"
                        aria-label="Facebook"
                      >
                        <Facebook className="w-5 h-5" />
                      </a>
                    )}
                    {contactInfo.social.instagram && (
                      <a
                        href={contactInfo.social.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-500 hover:text-violet-600 transition"
                        aria-label="Instagram"
                      >
                        <Instagram className="w-5 h-5" />
                      </a>
                    )}
                    {contactInfo.social.twitter && (
                      <a
                        href={contactInfo.social.twitter}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-500 hover:text-violet-600 transition"
                        aria-label="Twitter"
                      >
                        <Twitter className="w-5 h-5" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Image Gallery Modal */}
      {galleryOpen && (
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
            <div className="relative w-full h-[80vh]">
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