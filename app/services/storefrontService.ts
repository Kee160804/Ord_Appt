import "server-only";

import { getSupabaseServerClient } from "@/app/lib/supabase/server";
import type { Category, Product, Service, Tenant } from "@/app/types/index";
import type {
  BusinessHourRow,
  CategoryRow,
  ProductRow,
  ServiceRow,
  TenantRow,
} from "@/app/types/supabase";

export interface PublicStorefrontData {
  tenant: Tenant;
  categories: Category[];
  products: Product[];
  services: Service[];
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function mapTenant(row: TenantRow, hours: BusinessHourRow[]): Tenant {
  const businessName = row.business_name;
  return {
    id: row.id,
    name: businessName,
    slug: row.slug,
    businessType: row.business_type?.toLowerCase() === "ordering" ? "ordering" : "appointment",
    logo: row.logo ?? businessName.charAt(0).toUpperCase(),
    logoBg: row.logo_bg ?? row.primary_color ?? "#8b5cf6",
    description: row.description ?? `Welcome to ${businessName}.`,
    phone: row.phone ?? "",
    email: row.email ?? "",
    address: row.address ?? "",
    city: row.city ?? "",
    coverImage:
      row.cover_image ??
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=1200&q=80",
    businessHours: [...hours]
      .sort((a, b) => a.day_of_week - b.day_of_week)
      .map((hour) => ({
        day: DAYS[hour.day_of_week] ?? `Day ${hour.day_of_week}`,
        open: hour.open_time?.slice(0, 5) ?? "",
        close: hour.close_time?.slice(0, 5) ?? "",
        closed: hour.is_closed,
      })),
    socialLinks: {},
    primaryColor: row.primary_color ?? "#8b5cf6",
    accentColor: row.accent_color ?? "#a78bfa",
    createdAt: row.created_at ?? new Date().toISOString(),
    isActive: row.is_active && row.status.toUpperCase() === "ACTIVE",
    plan: row.plan === "pro" || row.plan === "enterprise" ? row.plan : "starter",
    stripeConnected: row.stripe_connected ?? false,
    subscriptionStatus:
      row.subscription_status === "active" ||
      row.subscription_status === "cancelled" ||
      row.subscription_status === "past_due"
        ? row.subscription_status
        : "trial",
    trialEndsAt: row.trial_ends_at ?? undefined,
  };
}

export async function getPublicStorefront(slug: string): Promise<PublicStorefrontData | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const { data: tenantData, error: tenantError } = await supabase
    .from("tenants")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (tenantError) throw tenantError;
  if (!tenantData) return null;

  const tenantRow = tenantData as TenantRow;
  const [hoursResult, categoriesResult, productsResult, servicesResult] = await Promise.all([
    supabase
      .from("business_hours")
      .select("day_of_week, open_time, close_time, is_closed")
      .eq("tenant_id", tenantRow.id),
    supabase
      .from("categories")
      .select("*")
      .eq("tenant_id", tenantRow.id)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("products")
      .select("*")
      .eq("tenant_id", tenantRow.id)
      .eq("available", true)
      .order("name"),
    supabase
      .from("services")
      .select("*")
      .eq("tenant_id", tenantRow.id)
      .eq("available", true)
      .order("name"),
  ]);

  const firstError =
    hoursResult.error ??
    categoriesResult.error ??
    productsResult.error ??
    servicesResult.error;
  if (firstError) throw firstError;

  const categoryRows = (categoriesResult.data ?? []) as CategoryRow[];
  const categoryNames = new Map(categoryRows.map((category) => [category.id, category.name]));

  return {
    tenant: mapTenant(tenantRow, (hoursResult.data ?? []) as BusinessHourRow[]),
    categories: categoryRows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      sortOrder: row.sort_order,
    })),
    products: ((productsResult.data ?? []) as ProductRow[]).map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description ?? "",
      price: Number(row.price),
      image: row.image_url ?? "",
      categoryId: row.category_id ?? "",
      categoryName: categoryNames.get(row.category_id ?? "") ?? "Uncategorized",
      isActive: row.available,
      inventory: row.stock,
      tags: [],
      addons: (row.addons ?? []).map((addon) => ({ ...addon, price: Number(addon.price) })),
      createdAt: row.created_at,
    })),
    services: ((servicesResult.data ?? []) as ServiceRow[]).map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description ?? "",
      duration: row.duration_minutes,
      price: Number(row.price),
      image: row.image_url ?? "",
      category: row.category ?? "Services",
      isActive: row.available,
      requiresDeposit: row.requires_deposit ?? false,
      depositAmount: row.deposit_amount == null ? undefined : Number(row.deposit_amount),
      depositType: row.deposit_type ?? undefined,
      createdAt: row.created_at,
    })),
  };
}
