import { getSupabaseBrowserClient } from "@/app/lib/supabase/client";
import type {
  Category,
  Product,
  ProductAddon,
  ProductVariant,
} from "@/app/types/index";
import type {
  CategoryRow,
  ProductRow,
  ProductVariantRow,
} from "@/app/types/supabase";

export interface CreateProductInput {
  name: string;
  description: string;
  price: number;
  image: string;
  categoryId: string;
  inventory: number | null;
  trackInventory: boolean;
  addons: ProductAddon[];
}

export interface ProductVariantInput {
  id?: string;
  sku: string;
  attributes: Record<string, string>;
  price?: number;
  stock: number;
  isActive: boolean;
}

/**
 * One page of tenant products plus pagination metadata for the management UI.
 */
export interface ProductPage {
  products: Product[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

/**
 * Database-backed filters supported by the Products screen.
 */
export interface ListProductsOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  categoryId?: string | "all";
  availability?: boolean | "all";
}

const DEFAULT_PRODUCT_PAGE_SIZE = 25;
const MAX_PRODUCT_PAGE_SIZE = 100;
const MAX_PRODUCT_SEARCH_LENGTH = 120;

function client() {
  const supabase = getSupabaseBrowserClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  return supabase;
}

function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}

function mapProduct(row: ProductRow, categoryName = "Uncategorized"): Product {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    description: row.description ?? "",
    price: Number(row.price),
    image: row.image_url ?? "",
    categoryId: row.category_id ?? "",
    categoryName,
    isActive: row.available,
    inventory: row.stock ?? undefined,
    trackInventory: row.track_inventory ?? row.stock !== null,
    tags: [],
    addons: (row.addons ?? []).map((addon) => ({
      ...addon,
      price: Number(addon.price),
    })),
    variants: (row.product_variants ?? []).map(mapVariant),
    createdAt: row.created_at,
  };
}

function mapVariant(row: ProductVariantRow): ProductVariant {
  return {
    id: row.id,
    productId: row.product_id,
    sku: row.sku,
    attributes: row.attributes ?? {},
    price: row.price == null ? undefined : Number(row.price),
    stock: Number(row.stock),
    isActive: row.available,
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
    return DEFAULT_PRODUCT_PAGE_SIZE;
  }

  return Math.min(
    MAX_PRODUCT_PAGE_SIZE,
    Math.max(1, Math.floor(value ?? DEFAULT_PRODUCT_PAGE_SIZE)),
  );
}

/**
 * Search text is inserted into a PostgREST `.or()` expression, so structural
 * characters are removed before the expression is created.
 */
function normalizeSearch(value: string | undefined): string {
  return (value ?? "")
    .trim()
    .slice(0, MAX_PRODUCT_SEARCH_LENGTH)
    .replace(/[(),]/g, " ")
    .trim();
}

export async function listCategories(
  tenantId: string,
  includeInactive = false,
): Promise<Category[]> {
  let query = client()
    .from("categories")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("sort_order")
    .order("id");

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as CategoryRow[]).map(mapCategory);
}

export async function createCategory(
  tenantId: string,
  name: string,
  sortOrder: number,
) {
  const normalizedName = name.trim();

  if (!normalizedName) {
    throw new Error("Category name is required.");
  }

  const { data, error } = await client()
    .from("categories")
    .insert({
      tenant_id: tenantId,
      name: normalizedName,
      sort_order: sortOrder,
      is_active: true,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapCategory(data as CategoryRow);
}

export async function updateCategory(
  tenantId: string,
  categoryId: string,
  name: string,
  sortOrder: number,
) {
  const normalizedName = name.trim();

  if (!normalizedName) {
    throw new Error("Category name is required.");
  }

  const { data, error } = await client()
    .from("categories")
    .update({
      name: normalizedName,
      sort_order: sortOrder,
    })
    .eq("tenant_id", tenantId)
    .eq("id", categoryId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapCategory(data as CategoryRow);
}

export async function setCategoryActive(
  tenantId: string,
  categoryId: string,
  isActive: boolean,
) {
  const { data, error } = await client()
    .from("categories")
    .update({ is_active: isActive })
    .eq("tenant_id", tenantId)
    .eq("id", categoryId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapCategory(data as CategoryRow);
}

/**
 * Loads one tenant-scoped product page.
 *
 * Products are paginated first, then variants are fetched only for product IDs
 * on the current page. This avoids downloading every product variant for a
 * tenant on every Products screen load.
 */
export async function listProducts(
  tenantId: string,
  options: ListProductsOptions = {},
): Promise<ProductPage> {
  const supabase = client();

  const safePage = normalizePage(options.page);
  const safePageSize = normalizePageSize(options.pageSize);
  const search = normalizeSearch(options.search);

  const from = safePage * safePageSize;
  const to = from + safePageSize - 1;

  let productQuery = supabase
    .from("products")
    .select("*", { count: "exact" })
    .eq("tenant_id", tenantId);

  if (options.categoryId && options.categoryId !== "all") {
    productQuery = productQuery.eq("category_id", options.categoryId);
  }

  if (options.availability !== undefined && options.availability !== "all") {
    productQuery = productQuery.eq("available", options.availability);
  }

  if (search) {
    productQuery = productQuery.or(
      [`name.ilike.%${search}%`, `description.ilike.%${search}%`].join(","),
    );
  }

  const {
    data: products,
    error: productsError,
    count,
  } = await productQuery
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);

  if (productsError) {
    throw new Error(productsError.message);
  }

  const productRows = (products ?? []) as ProductRow[];
  const productIds = productRows.map((product) => product.id);

  /**
   * Categories remain a small tenant configuration table and are needed to
   * display category names for the current product page.
   */
  const { data: categories, error: categoriesError } = await supabase
    .from("categories")
    .select("*")
    .eq("tenant_id", tenantId);

  if (categoriesError) {
    throw new Error(categoriesError.message);
  }

  let variantRows: ProductVariantRow[] = [];

  if (productIds.length > 0) {
    const { data: variants, error: variantsError } = await supabase
      .from("product_variants")
      .select("*")
      .eq("tenant_id", tenantId)
      .in("product_id", productIds);

    /**
     * Preserve the existing compatibility behavior: products still load when
     * variants are temporarily unavailable or the variants table is absent.
     */
    if (!variantsError) {
      variantRows = (variants ?? []) as ProductVariantRow[];
    }
  }

  const variantsByProduct = new Map<string, ProductVariantRow[]>();

  for (const variant of variantRows) {
    const current = variantsByProduct.get(variant.product_id) ?? [];
    current.push(variant);
    variantsByProduct.set(variant.product_id, current);
  }

  const categoryNames = new Map(
    ((categories ?? []) as CategoryRow[]).map((category) => [
      category.id,
      category.name,
    ]),
  );

  const mappedProducts = productRows.map((product) =>
    mapProduct(
      {
        ...product,
        product_variants: variantsByProduct.get(product.id) ?? [],
      },
      categoryNames.get(product.category_id ?? ""),
    ),
  );

  const total = count ?? 0;
  const totalPages = total === 0 ? 0 : Math.ceil(total / safePageSize);

  return {
    products: mappedProducts,
    page: safePage,
    pageSize: safePageSize,
    total,
    totalPages,
    hasPreviousPage: safePage > 0,
    hasNextPage: from + mappedProducts.length < total,
  };
}

function validateProductInput(input: CreateProductInput) {
  const name = input.name.trim();

  if (!name) {
    throw new Error("Product name is required.");
  }

  if (!Number.isFinite(input.price) || input.price < 0) {
    throw new Error("Enter a valid product price.");
  }

  if (
    input.trackInventory &&
    (input.inventory === null ||
      !Number.isFinite(input.inventory) ||
      input.inventory < 0)
  ) {
    throw new Error("Enter a valid inventory quantity.");
  }

  return {
    name,
    description: input.description.trim(),
    image: input.image.trim(),
  };
}

export async function createProduct(
  tenantId: string,
  input: CreateProductInput,
  categoryName: string,
): Promise<Product> {
  const normalized = validateProductInput(input);

  const { data, error } = await client()
    .from("products")
    .insert({
      tenant_id: tenantId,
      category_id: input.categoryId || null,
      name: normalized.name,
      description: normalized.description,
      price: input.price,
      image_url: normalized.image || null,
      stock: input.trackInventory ? input.inventory : null,
      track_inventory: input.trackInventory,
      available: true,
      addons: input.addons,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapProduct(data as ProductRow, categoryName);
}

export async function updateProduct(
  tenantId: string,
  productId: string,
  input: CreateProductInput,
  categoryName: string,
): Promise<Product> {
  const normalized = validateProductInput(input);

  const { data, error } = await client()
    .from("products")
    .update({
      category_id: input.categoryId || null,
      name: normalized.name,
      description: normalized.description,
      price: input.price,
      image_url: normalized.image || null,
      stock: input.trackInventory ? input.inventory : null,
      track_inventory: input.trackInventory,
      addons: input.addons,
    })
    .eq("id", productId)
    .eq("tenant_id", tenantId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapProduct(data as ProductRow, categoryName);
}

/**
 * Replaces a product's variant configuration.
 *
 * This intentionally retains the existing delete-and-reinsert behavior because
 * variants are configuration records rather than completed transactions.
 */
export async function saveProductVariants(
  tenantId: string,
  productId: string,
  variants: ProductVariantInput[],
) {
  const supabase = client();

  const { error: deleteError } = await supabase
    .from("product_variants")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("product_id", productId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (variants.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("product_variants")
    .insert(
      variants.map((variant) => ({
        tenant_id: tenantId,
        product_id: productId,
        sku: variant.sku.trim(),
        attributes: variant.attributes,
        price: variant.price ?? null,
        stock: variant.stock,
        available: variant.isActive,
      })),
    )
    .select("*");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ProductVariantRow[];
}

export async function setProductAvailability(
  tenantId: string,
  productId: string,
  available: boolean,
) {
  const { error } = await client()
    .from("products")
    .update({ available })
    .eq("id", productId)
    .eq("tenant_id", tenantId)
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Physical product deletion is retained for now because this is catalog
 * configuration, not transaction history. Before enforcing stricter catalog
 * retention, verify the live foreign-key behavior for historical order items.
 */
export async function deleteProduct(tenantId: string, productId: string) {
  const { error } = await client()
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("tenant_id", tenantId);

  if (error) {
    throw new Error(error.message);
  }
}
