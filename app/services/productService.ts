import { getSupabaseBrowserClient } from "@/app/lib/supabase/client";
import type { Category, Product } from "@/app/types/index";
import type { CategoryRow, ProductRow } from "@/app/types/supabase";

export interface CreateProductInput {
  name: string;
  description: string;
  price: number;
  image: string;
  categoryId: string;
  inventory: number;
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
    inventory: row.stock,
    tags: [],
    createdAt: row.created_at,
  };
}

export async function listCategories(tenantId: string): Promise<Category[]> {
  const { data, error } = await client()
    .from("categories")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("sort_order");

  if (error) throw error;
  return ((data ?? []) as CategoryRow[]).map(mapCategory);
}

export async function listProducts(tenantId: string): Promise<Product[]> {
  const supabase = client();
  const [{ data: products, error: productsError }, { data: categories, error: categoriesError }] =
    await Promise.all([
      supabase.from("products").select("*").eq("tenant_id", tenantId).order("created_at"),
      supabase.from("categories").select("*").eq("tenant_id", tenantId),
    ]);

  if (productsError) throw productsError;
  if (categoriesError) throw categoriesError;

  const categoryNames = new Map(
    ((categories ?? []) as CategoryRow[]).map((category) => [category.id, category.name]),
  );
  return ((products ?? []) as ProductRow[]).map((product) =>
    mapProduct(product, categoryNames.get(product.category_id ?? "")),
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
      stock: input.inventory,
      available: true,
    })
    .select("*")
    .single();

  if (error) throw error;
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
      stock: input.inventory,
    })
    .eq("id", productId)
    .eq("tenant_id", tenantId)
    .select("*")
    .single();

  if (error) throw error;
  return mapProduct(data as ProductRow, categoryName);
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
    .eq("tenant_id", tenantId);
  if (error) throw error;
}

export async function deleteProduct(tenantId: string, productId: string) {
  const { error } = await client()
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("tenant_id", tenantId);
  if (error) throw error;
}
