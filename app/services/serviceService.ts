import { requireSupabaseBrowserClient as client } from "@/app/lib/supabase/client";
import type { Service } from "@/app/types/index";
import type { ServiceRow } from "@/app/types/supabase";

export interface ServiceInput {
  name: string;
  description: string;
  duration: number;
  price: number;
  image: string;
  category: string;
  requiresDeposit: boolean;
  depositAmount?: number;
  depositType?: "fixed" | "percentage";
}

/**
 * One page of tenant services plus the metadata required by the Services UI.
 */
export interface ServicePage {
  services: Service[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

/**
 * Database-backed filters supported by the Services screen.
 */
export interface ListServicesOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string | "all";
  availability?: boolean | "all";
}

const DEFAULT_SERVICE_PAGE_SIZE = 25;
const MAX_SERVICE_PAGE_SIZE = 100;
const MAX_SERVICE_SEARCH_LENGTH = 120;

function mapService(row: ServiceRow): Service {
  return {
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
  };
}

function normalizePage(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value ?? 0));
}

function normalizePageSize(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_SERVICE_PAGE_SIZE;
  }

  return Math.min(
    MAX_SERVICE_PAGE_SIZE,
    Math.max(1, Math.floor(value ?? DEFAULT_SERVICE_PAGE_SIZE)),
  );
}

/**
 * Search text is used inside a PostgREST `.or()` expression. Remove structural
 * characters that could alter that expression before creating the query.
 */
function normalizeSearch(value: string | undefined): string {
  return (value ?? "")
    .trim()
    .slice(0, MAX_SERVICE_SEARCH_LENGTH)
    .replace(/[(),]/g, " ")
    .trim();
}

function validateServiceInput(input: ServiceInput) {
  const name = input.name.trim();
  const description = input.description.trim();
  const image = input.image.trim();
  const category = input.category.trim() || "Services";

  if (!name) {
    throw new Error("Service name is required.");
  }

  if (
    !Number.isFinite(input.duration) ||
    !Number.isInteger(input.duration) ||
    input.duration <= 0
  ) {
    throw new Error("Enter a valid service duration.");
  }

  if (!Number.isFinite(input.price) || input.price < 0) {
    throw new Error("Enter a valid service price.");
  }

  let depositAmount: number | null = null;
  let depositType: "fixed" | "percentage" | null = null;

  if (input.requiresDeposit) {
    depositType = input.depositType ?? "fixed";
    const amount = input.depositAmount ?? 0;

    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error("Enter a valid deposit amount.");
    }

    if (depositType === "percentage" && amount > 100) {
      throw new Error("Deposit percentage cannot exceed 100%.");
    }

    if (depositType === "fixed" && amount > input.price) {
      throw new Error("Fixed deposit cannot exceed the service price.");
    }

    depositAmount = amount;
  }

  return {
    name,
    description,
    image,
    category,
    depositAmount,
    depositType,
  };
}

function serviceValues(tenantId: string, input: ServiceInput) {
  const normalized = validateServiceInput(input);

  return {
    tenant_id: tenantId,
    name: normalized.name,
    description: normalized.description,
    duration_minutes: input.duration,
    price: input.price,
    image_url: normalized.image || null,
    category: normalized.category,
    available: true,
    requires_deposit: input.requiresDeposit,
    deposit_type: normalized.depositType,
    deposit_amount: normalized.depositAmount,
  };
}

/**
 * Loads one tenant-scoped service page.
 *
 * Search/category/availability filters are applied in Supabase before
 * pagination, so the UI works against the complete tenant service catalog
 * rather than only the rows already loaded in the browser.
 */
export async function listServices(
  tenantId: string,
  options: ListServicesOptions = {},
): Promise<ServicePage> {
  const safePage = normalizePage(options.page);
  const safePageSize = normalizePageSize(options.pageSize);
  const search = normalizeSearch(options.search);

  const from = safePage * safePageSize;
  const to = from + safePageSize - 1;

  let query = client()
    .from("services")
    .select("*", { count: "exact" })
    .eq("tenant_id", tenantId);

  if (options.category && options.category !== "all") {
    query = query.eq("category", options.category);
  }

  if (options.availability !== undefined && options.availability !== "all") {
    query = query.eq("available", options.availability);
  }

  if (search) {
    query = query.or(
      [
        `name.ilike.%${search}%`,
        `description.ilike.%${search}%`,
        `category.ilike.%${search}%`,
      ].join(","),
    );
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);

  if (error) {
    throw error;
  }

  const services = ((data ?? []) as ServiceRow[]).map(mapService);
  const total = count ?? 0;
  const totalPages = total === 0 ? 0 : Math.ceil(total / safePageSize);

  return {
    services,
    page: safePage,
    pageSize: safePageSize,
    total,
    totalPages,
    hasPreviousPage: safePage > 0,
    hasNextPage: from + services.length < total,
  };
}

export async function createService(
  tenantId: string,
  input: ServiceInput,
): Promise<Service> {
  const { data, error } = await client()
    .from("services")
    .insert(serviceValues(tenantId, input))
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapService(data as ServiceRow);
}

export async function updateService(
  tenantId: string,
  serviceId: string,
  input: ServiceInput,
): Promise<Service> {
  /*
   * `serviceValues` includes tenant_id and available=true because the original
   * service used one shared payload for create/update. Avoid changing that
   * behavior here while pagination is being introduced.
   */
  const { data, error } = await client()
    .from("services")
    .update(serviceValues(tenantId, input))
    .eq("id", serviceId)
    .eq("tenant_id", tenantId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapService(data as ServiceRow);
}

export async function setServiceAvailability(
  tenantId: string,
  serviceId: string,
  available: boolean,
) {
  const { error } = await client()
    .from("services")
    .update({ available })
    .eq("id", serviceId)
    .eq("tenant_id", tenantId);

  if (error) {
    throw error;
  }
}

/**
 * Physical deletion is retained for now because services are catalog
 * configuration rather than completed transactions. We will verify the live
 * foreign-key behavior for historical appointments during the final database
 * review before changing retention semantics.
 */
export async function deleteService(tenantId: string, serviceId: string) {
  const { error } = await client()
    .from("services")
    .delete()
    .eq("id", serviceId)
    .eq("tenant_id", tenantId);

  if (error) {
    throw error;
  }
}
