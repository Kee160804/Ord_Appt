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

function client() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase is not configured.");
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

export async function listCategories(
  tenantId: string,
  includeInactive = false,
): Promise<Category[]> {
  let query = client()
    .from("categories")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("sort_order");
  if (!includeInactive) query = query.eq("is_active", true);
  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return ((data ?? []) as CategoryRow[]).map(mapCategory);
}

export async function createCategory(
  tenantId: string,
  name: string,
  sortOrder: number,
) {
  const { data, error } = await client()
    .from("categories")
    .insert({
      tenant_id: tenantId,
      name: name.trim(),
      sort_order: sortOrder,
      is_active: true,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapCategory(data as CategoryRow);
}

export async function updateCategory(
  tenantId: string,
  categoryId: string,
  name: string,
  sortOrder: number,
) {
  const { data, error } = await client()
    .from("categories")
    .update({ name: name.trim(), sort_order: sortOrder })
    .eq("tenant_id", tenantId)
    .eq("id", categoryId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
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
  if (error) throw new Error(error.message);
  return mapCategory(data as CategoryRow);
}

export async function listProducts(tenantId: string): Promise<Product[]> {
  const supabase = client();
  const [
    { data: products, error: productsError },
    { data: categories, error: categoriesError },
    { data: variants, error: variantsError },
  ] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at"),
    supabase.from("categories").select("*").eq("tenant_id", tenantId),
    supabase.from("product_variants").select("*").eq("tenant_id", tenantId),
  ]);

  if (productsError) throw new Error(productsError.message);
  if (categoriesError) throw new Error(categoriesError.message);
  const variantRows = variantsError
    ? []
    : ((variants ?? []) as ProductVariantRow[]);

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
  return ((products ?? []) as ProductRow[]).map((product) =>
    mapProduct(
      { ...product, product_variants: variantsByProduct.get(product.id) ?? [] },
      categoryNames.get(product.category_id ?? ""),
    ),
  );
}

export async function createProduct(
  tenantId: string,
  input: CreateProductInput,
  categoryName: string,
): Promise<Product> {
  const { data, error } = await client()
    .from("products")
    .insert({
      tenant_id: tenantId,
      category_id: input.categoryId || null,
      name: input.name.trim(),
      description: input.description.trim(),
      price: input.price,
      image_url: input.image.trim() || null,
      stock: input.trackInventory ? input.inventory : null,
      track_inventory: input.trackInventory,
      available: true,
      addons: input.addons,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapProduct(data as ProductRow, categoryName);
}

export async function updateProduct(
  tenantId: string,
  productId: string,
  input: CreateProductInput,
  categoryName: string,
): Promise<Product> {
  const { data, error } = await client()
    .from("products")
    .update({
      category_id: input.categoryId || null,
      name: input.name.trim(),
      description: input.description.trim(),
      price: input.price,
      image_url: input.image.trim() || null,
      stock: input.trackInventory ? input.inventory : null,
      track_inventory: input.trackInventory,
      addons: input.addons,
    })
    .eq("id", productId)
    .eq("tenant_id", tenantId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapProduct(data as ProductRow, categoryName);
}

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
  if (deleteError) throw new Error(deleteError.message);

  if (variants.length === 0) return [];
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
  if (error) throw new Error(error.message);
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
  if (error) throw new Error(error.message);
}

export async function deleteProduct(tenantId: string, productId: string) {
  const { error } = await client()
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);
}
