import "server-only";

import { getSupabasePublicClient } from "@/app/lib/supabase/server";
import type {
  Category,
  Product,
  PublicServiceProvider,
  Service,
  Tenant,
} from "@/app/types/index";
import type {
  BusinessHourRow,
  CategoryRow,
  ProductRow,
  ProductVariantRow,
  ServiceRow,
  TenantRow,
} from "@/app/types/supabase";

export interface PublicStorefrontData {
  tenant: Tenant;
  categories: Category[];
  products: Product[];
  services: Service[];
  providers: PublicServiceProvider[];
}

type PublicOrderingSettingsRow = {
  ordering_enabled: boolean | null;
  ordering_paused: boolean | null;
  order_types: string[] | null;
  tax_rate: number | string | null;
  discount_enabled: boolean | null;
  discount_threshold: number | string | null;
  discount_rate: number | string | null;
  minimum_order: number | string | null;
  delivery_fee: number | string | null;
  delivery_areas: string[] | null;
  preparation_minutes: number | null;
  ordering_open_time: string | null;
  ordering_close_time: string | null;
};

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function mapTenant(row: TenantRow, hours: BusinessHourRow[]): Tenant {
  const businessName = row.business_name;
  return {
    id: row.id,
    name: businessName,
    slug: row.slug,
    businessType:
      row.business_type?.toLowerCase() === "ordering"
        ? "ordering"
        : row.business_type?.toLowerCase() === "retail"
          ? "retail"
          : "appointment",
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
    plan:
      row.plan === "pro" || row.plan === "enterprise" ? row.plan : "starter",
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

export async function getPublicStorefront(
  slug: string,
): Promise<PublicStorefrontData | null> {
  // Storefront reads intentionally use an anonymous client even when the
  // browser also has an owner session. Dashboard identities therefore never
  // need cross-tenant table policies just to view a public storefront.
  const supabase = getSupabasePublicClient();
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
  const [
    hoursResult,
    categoriesResult,
    productsResult,
    variantsResult,
    servicesResult,
    providersResult,
    assignmentsResult,
    orderingSettingsResult,
  ] = await Promise.all([
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
      .from("product_variants")
      .select("*")
      .eq("tenant_id", tenantRow.id)
      .eq("available", true),
    supabase
      .from("services")
      .select("*")
      .eq("tenant_id", tenantRow.id)
      .eq("available", true)
      .order("name"),
    supabase
      .from("staff")
      .select("id, tenant_id, display_name, bio, color")
      .eq("tenant_id", tenantRow.id)
      .eq("is_active", true)
      .eq("accepts_appointments", true)
      .order("display_name"),
    supabase
      .from("staff_services")
      .select("staff_id, service_id")
      .eq("tenant_id", tenantRow.id),
    supabase
      .from("business_settings")
      .select(
        "ordering_enabled,ordering_paused,order_types,tax_rate,discount_enabled,discount_threshold,discount_rate,minimum_order,delivery_fee,delivery_areas,preparation_minutes,ordering_open_time,ordering_close_time",
      )
      .eq("tenant_id", tenantRow.id)
      .maybeSingle(),
  ]);

  const firstError =
    hoursResult.error ??
    categoriesResult.error ??
    productsResult.error ??
    servicesResult.error;
  if (firstError) throw firstError;

  const categoryRows = (categoriesResult.data ?? []) as CategoryRow[];
  const variantsByProduct = new Map<string, ProductVariantRow[]>();
  for (const variant of (variantsResult.error
    ? []
    : (variantsResult.data ?? [])) as ProductVariantRow[]) {
    const current = variantsByProduct.get(variant.product_id) ?? [];
    current.push(variant);
    variantsByProduct.set(variant.product_id, current);
  }
  const categoryNames = new Map(
    categoryRows.map((category) => [category.id, category.name]),
  );

  const assignments = new Map<string, string[]>();
  for (const assignment of assignmentsResult.error
    ? []
    : (assignmentsResult.data ?? [])) {
    const row = assignment as { staff_id: string; service_id: string };
    assignments.set(row.staff_id, [
      ...(assignments.get(row.staff_id) ?? []),
      row.service_id,
    ]);
  }

  const tenant = mapTenant(
    tenantRow,
    (hoursResult.data ?? []) as BusinessHourRow[],
  );
  const ordering = (orderingSettingsResult.data ??
    {}) as Partial<PublicOrderingSettingsRow>;
  tenant.orderingSettings = {
    enabled: ordering.ordering_enabled !== false,
    paused: ordering.ordering_paused === true,
    orderTypes: (
      ordering.order_types ?? ["dine_in", "pickup", "delivery"]
    ).filter((value): value is "dine_in" | "pickup" | "delivery" =>
      ["dine_in", "pickup", "delivery"].includes(value),
    ),
    taxRate: Number(ordering.tax_rate ?? 10),
    discountEnabled: ordering.discount_enabled !== false,
    discountThreshold: Number(ordering.discount_threshold ?? 100),
    discountRate: Number(ordering.discount_rate ?? 5),
    minimumOrder: Number(ordering.minimum_order ?? 0),
    deliveryFee: Number(ordering.delivery_fee ?? 0),
    deliveryAreas: ordering.delivery_areas ?? [],
    preparationMinutes: Number(ordering.preparation_minutes ?? 30),
    openTime: ordering.ordering_open_time?.slice(0, 5),
    closeTime: ordering.ordering_close_time?.slice(0, 5),
  };

  return {
    tenant,
    categories: categoryRows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      sortOrder: row.sort_order,
      isActive: row.is_active,
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
      inventory: row.stock ?? undefined,
      trackInventory: row.track_inventory ?? row.stock !== null,
      tags: [],
      addons: (row.addons ?? []).map((addon) => ({
        ...addon,
        price: Number(addon.price),
      })),
      variants: (variantsByProduct.get(row.id) ?? []).map((variant) => ({
        id: variant.id,
        productId: variant.product_id,
        sku: variant.sku,
        attributes: variant.attributes ?? {},
        price: variant.price == null ? undefined : Number(variant.price),
        stock: Number(variant.stock),
        isActive: variant.available,
      })),
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
      depositAmount:
        row.deposit_amount == null ? undefined : Number(row.deposit_amount),
      depositType: row.deposit_type ?? undefined,
      createdAt: row.created_at,
      departmentId: row.department_id ?? undefined,
    })),
    providers: (providersResult.error ? [] : (providersResult.data ?? [])).map(
      (raw) => {
        const row = raw as {
          id: string;
          tenant_id: string;
          display_name: string | null;
          bio: string | null;
          color: string | null;
        };
        return {
          id: row.id,
          tenantId: row.tenant_id,
          name: row.display_name ?? "Service provider",
          bio: row.bio ?? "",
          color: row.color ?? "#8b5cf6",
          serviceIds: assignments.get(row.id) ?? [],
        };
      },
    ),
  };
}
