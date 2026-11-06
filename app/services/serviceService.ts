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
  departmentId?: string;
}

export interface ServiceCategory {
  id: string;
  tenantId: string;
  name: string;
  sortOrder: number;
}

interface ServiceCategoryRow {
  id: string;
  tenant_id: string;
  name: string;
  sort_order: number;
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
    department_id: input.departmentId || null,
  };
}

function mapServiceCategory(row: ServiceCategoryRow): ServiceCategory {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    sortOrder: row.sort_order,
  };
}

type SupabaseFailure = { code?: string; message?: string };

function missingServiceCategoryTable(error: SupabaseFailure | null) {
  return Boolean(
    error &&
    (error.code === "42P01" ||
      error.code === "PGRST205" ||
      (error.message?.includes("service_categories") &&
        (error.message.includes("Could not find the table") ||
          error.message.includes("does not exist")))),
  );
}

function missingServiceCategoryFunction(error: SupabaseFailure | null) {
  return Boolean(
    error &&
    (error.code === "42883" ||
      error.code === "PGRST202" ||
      (error.message?.includes("service_category") &&
        error.message.includes("Could not find the function"))),
  );
}

const legacyCategoryId = (name: string) => `legacy:${encodeURIComponent(name)}`;

function legacyCategoryName(categoryId: string) {
  return categoryId.startsWith("legacy:")
    ? decodeURIComponent(categoryId.slice("legacy:".length))
    : null;
}

async function listLegacyServiceCategories(
  tenantId: string,
): Promise<ServiceCategory[]> {
  const supabase = client();
  const [categoriesResult, servicesResult] = await Promise.all([
    supabase
      .from("categories")
      .select("id,tenant_id,name,sort_order")
      .eq("tenant_id", tenantId)
      .order("sort_order")
      .order("name"),
    supabase.from("services").select("category").eq("tenant_id", tenantId),
  ]);

  if (categoriesResult.error) throw categoriesResult.error;
  if (servicesResult.error) throw servicesResult.error;

  const categories = (
    (categoriesResult.data ?? []) as ServiceCategoryRow[]
  ).map(mapServiceCategory);
  const knownNames = new Set(
    categories.map((item) => item.name.trim().toLowerCase()),
  );

  for (const row of (servicesResult.data ?? []) as Array<{
    category: string | null;
  }>) {
    const name = row.category?.trim();
    if (!name || knownNames.has(name.toLowerCase())) continue;
    knownNames.add(name.toLowerCase());
    categories.push({
      id: legacyCategoryId(name),
      tenantId,
      name,
      sortOrder: categories.length,
    });
  }

  return categories.sort(
    (first, second) =>
      first.sortOrder - second.sortOrder ||
      first.name.localeCompare(second.name),
  );
}

async function getLegacyCategoryName(tenantId: string, categoryId: string) {
  const encodedName = legacyCategoryName(categoryId);
  if (encodedName) return encodedName;

  const { data, error } = await client()
    .from("categories")
    .select("name")
    .eq("tenant_id", tenantId)
    .eq("id", categoryId)
    .single();
  if (error) throw error;
  return String(data.name);
}

export async function listServiceCategories(
  tenantId: string,
): Promise<ServiceCategory[]> {
  const { data, error } = await client()
    .from("service_categories")
    .select("id,tenant_id,name,sort_order")
    .eq("tenant_id", tenantId)
    .order("sort_order")
    .order("name");

  if (error) {
    if (missingServiceCategoryTable(error)) {
      return listLegacyServiceCategories(tenantId);
    }
    throw error;
  }
  return ((data ?? []) as ServiceCategoryRow[]).map(mapServiceCategory);
}

export async function createServiceCategory(
  tenantId: string,
  name: string,
  sortOrder: number,
): Promise<ServiceCategory> {
  const normalizedName = name.trim();
  if (!normalizedName) throw new Error("Category name is required.");

  const { data, error } = await client()
    .from("service_categories")
    .insert({
      tenant_id: tenantId,
      name: normalizedName,
      sort_order: sortOrder,
    })
    .select("id,tenant_id,name,sort_order")
    .single();

  if (error) {
    if (!missingServiceCategoryTable(error)) throw error;

    const legacyResult = await client()
      .from("categories")
      .insert({
        tenant_id: tenantId,
        name: normalizedName,
        sort_order: sortOrder,
        is_active: true,
      })
      .select("id,tenant_id,name,sort_order")
      .single();
    if (legacyResult.error) throw legacyResult.error;
    return mapServiceCategory(legacyResult.data as ServiceCategoryRow);
  }
  return mapServiceCategory(data as ServiceCategoryRow);
}

export async function renameServiceCategory(
  tenantId: string,
  categoryId: string,
  name: string,
  sortOrder: number,
): Promise<void> {
  const normalizedName = name.trim();
  if (!normalizedName) throw new Error("Category name is required.");

  const { error } = await client().rpc("rename_service_category", {
    p_tenant_id: tenantId,
    p_category_id: categoryId,
    p_name: normalizedName,
  });
  if (!error) {
    const positionResult = await client()
      .from("service_categories")
      .update({ sort_order: sortOrder })
      .eq("tenant_id", tenantId)
      .eq("id", categoryId);
    if (positionResult.error) throw positionResult.error;
    return;
  }
  if (!missingServiceCategoryFunction(error)) throw error;

  const oldName = await getLegacyCategoryName(tenantId, categoryId);
  if (!legacyCategoryName(categoryId)) {
    const categoryResult = await client()
      .from("categories")
      .update({ name: normalizedName, sort_order: sortOrder })
      .eq("tenant_id", tenantId)
      .eq("id", categoryId);
    if (categoryResult.error) throw categoryResult.error;
  }

  const serviceResult = await client()
    .from("services")
    .update({ category: normalizedName })
    .eq("tenant_id", tenantId)
    .ilike("category", oldName);
  if (serviceResult.error) throw serviceResult.error;
}

export async function deleteServiceCategory(
  tenantId: string,
  categoryId: string,
): Promise<void> {
  const { error } = await client().rpc("delete_service_category", {
    p_tenant_id: tenantId,
    p_category_id: categoryId,
  });
  if (!error) return;
  if (!missingServiceCategoryFunction(error)) throw error;

  const name = await getLegacyCategoryName(tenantId, categoryId);
  const serviceResult = await client()
    .from("services")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .ilike("category", name);
  if (serviceResult.error) throw serviceResult.error;
  if ((serviceResult.count ?? 0) > 0) {
    throw new Error(
      "Move services to another category before deleting this category.",
    );
  }

  if (!legacyCategoryName(categoryId)) {
    const categoryResult = await client()
      .from("categories")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("id", categoryId);
    if (categoryResult.error) throw categoryResult.error;
  }
}

/**
 * Repairs the legacy period when department names were copied into the
 * service category field. Department assignments are intentionally untouched.
 */
export async function separateDepartmentServiceCategories(
  tenantId: string,
  departmentNames: string[],
): Promise<boolean> {
  const normalizedDepartmentNames = new Set(
    departmentNames.map((name) => name.trim().toLowerCase()).filter(Boolean),
  );

  const supabase = client();
  const [{ data: serviceRows, error: servicesError }, categories] =
    await Promise.all([
      supabase.from("services").select("id,category").eq("tenant_id", tenantId),
      listServiceCategories(tenantId),
    ]);
  if (servicesError) throw servicesError;

  const affectedServices = (
    (serviceRows ?? []) as Array<{ id: string; category: string | null }>
  ).filter((row) =>
    normalizedDepartmentNames.has(row.category?.trim().toLowerCase() ?? ""),
  );
  const overlappingCategories = categories.filter(
    (item) =>
      normalizedDepartmentNames.has(item.name.trim().toLowerCase()) ||
      item.name.trim().toLowerCase() === "services",
  );

  if (affectedServices.length === 0 && overlappingCategories.length === 0) {
    return false;
  }

  if (affectedServices.length > 0) {
    const hasServicesCategory = categories.some(
      (item) => item.name.trim().toLowerCase() === "services",
    );
    if (!hasServicesCategory) {
      await createServiceCategory(tenantId, "Services", categories.length);
    }

    const updateResult = await supabase
      .from("services")
      .update({ category: "Services" })
      .eq("tenant_id", tenantId)
      .in(
        "id",
        affectedServices.map((item) => item.id),
      );
    if (updateResult.error) throw updateResult.error;
  }

  const catalogIds = overlappingCategories
    .filter((item) => !legacyCategoryName(item.id))
    .map((item) => item.id);
  if (catalogIds.length > 0) {
    const dedicatedDelete = await supabase
      .from("service_categories")
      .delete()
      .eq("tenant_id", tenantId)
      .in("id", catalogIds);

    if (dedicatedDelete.error) {
      if (!missingServiceCategoryTable(dedicatedDelete.error)) {
        throw dedicatedDelete.error;
      }
      const legacyDelete = await supabase
        .from("categories")
        .delete()
        .eq("tenant_id", tenantId)
        .in("id", catalogIds);
      if (legacyDelete.error) throw legacyDelete.error;
    }
  }

  return true;
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
    .order("name", { ascending: true })
    .order("id", { ascending: true })
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
  const updateValues: Partial<ReturnType<typeof serviceValues>> = serviceValues(
    tenantId,
    input,
  );
  if (input.departmentId === undefined) {
    updateValues.department_id = undefined;
  }

  const { data, error } = await client()
    .from("services")
    .update(updateValues)
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
