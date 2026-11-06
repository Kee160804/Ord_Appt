import { Product, Service } from "@/app/types/index";

// Products
export const getStoredProducts = (tenantId: string): Product[] | null => {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(`tenant_${tenantId}_products`);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error("Failed to parse stored products", e);
    }
  }
  return null;
};

export const setStoredProducts = (tenantId: string, products: Product[]) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(`tenant_${tenantId}_products`, JSON.stringify(products));
};

// Services
export const getStoredServices = (tenantId: string): Service[] | null => {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(`tenant_${tenantId}_services`);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error("Failed to parse stored services", e);
    }
  }
  return null;
};

export const setStoredServices = (tenantId: string, services: Service[]) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(`tenant_${tenantId}_services`, JSON.stringify(services));
};

export const getStoredServiceCategories = (
  tenantId: string,
): string[] | null => {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(`tenant_${tenantId}_service_categories`);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as string[];
  } catch (error) {
    console.error("Failed to parse stored service categories", error);
    return null;
  }
};

export const setStoredServiceCategories = (
  tenantId: string,
  categories: string[],
) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    `tenant_${tenantId}_service_categories`,
    JSON.stringify(categories),
  );
};
