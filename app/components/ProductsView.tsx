"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  Package,
  ToggleLeft,
  ToggleRight,
  FolderTree,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Modal } from "../components/Modal";
import { Input, Textarea, Select } from "../components/input";
import { getProductsByTenant, getCategoriesByTenant } from "../data/mock";
import { formatCurrency, cn } from "../lib/utils";
import { tenantHasFeature } from "../lib/plans";
import { getStoredProducts, setStoredProducts } from "../lib/storage";
import { isSupabaseConfigured } from "../lib/supabase/config";
import {
  createCategory,
  createProduct,
  deleteProduct,
  listCategories,
  listProducts,
  setCategoryActive,
  setProductAvailability,
  updateCategory,
  updateProduct,
  saveProductVariants,
} from "../services/productService";
import type {
  Category,
  Product,
  ProductAddon,
  ProductVariant,
  Tenant,
} from "../types/index";

interface Props {
  tenant: Tenant;
}

const PRODUCT_COLOR_SUGGESTIONS = [
  "Black",
  "White",
  "Gray",
  "Brown",
  "Red",
  "Orange",
  "Yellow",
  "Green",
  "Blue",
  "Navy",
  "Purple",
  "Pink",
  "Beige",
  "Gold",
  "Silver",
];
const ONE_SIZE_OPTION = "One size";
const COLORS_ATTRIBUTE = "colors";

function variantAttribute(
  attributes: Record<string, string>,
  attributeName: "size" | "color",
) {
  const acceptedNames =
    attributeName === "color" ? ["color", "colour"] : [attributeName];
  const entry = Object.entries(attributes).find(([key]) =>
    acceptedNames.includes(key.trim().toLowerCase()),
  );
  return entry?.[1] ?? "";
}

function uniqueOptionValues(values: string[]) {
  const seen = new Set<string>();
  return values.reduce<string[]>((options, value) => {
    const trimmed = value.trim();
    const normalized = trimmed.toLowerCase();
    if (!trimmed || seen.has(normalized)) return options;
    seen.add(normalized);
    options.push(trimmed);
    return options;
  }, []);
}

function skuPart(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function variantSizeGroup(variant: ProductVariant) {
  return variantAttribute(variant.attributes, "size") || ONE_SIZE_OPTION;
}

function variantColors(variant: ProductVariant) {
  const encodedColors = variant.attributes[COLORS_ATTRIBUTE];
  if (encodedColors) {
    try {
      const parsed = JSON.parse(encodedColors);
      if (Array.isArray(parsed)) {
        return uniqueOptionValues(
          parsed.filter((color): color is string => typeof color === "string"),
        );
      }
    } catch {
      // Fall back to the legacy single-color attribute below.
    }
  }

  return uniqueOptionValues([
    variantAttribute(variant.attributes, "color"),
  ]);
}

function attributesForSize(size: string, colors: string[]) {
  const attributes: Record<string, string> = {};
  if (size !== ONE_SIZE_OPTION) attributes.size = size;
  if (colors.length > 0) {
    attributes[COLORS_ATTRIBUTE] = JSON.stringify(uniqueOptionValues(colors));
  }
  return attributes;
}

function variantBelongsToSize(variant: ProductVariant, size: string) {
  return variantSizeGroup(variant).toLowerCase() === size.toLowerCase();
}

function createRetailVariant(
  size: string,
  productName: string,
  productId: string,
): ProductVariant {
  const skuBase = skuPart(productName) || "PRODUCT";

  return {
    id: `variant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    productId,
    sku: [skuBase, skuPart(size)].filter(Boolean).join("-"),
    attributes: attributesForSize(size, []),
    stock: 0,
    isActive: true,
  };
}

function collapseVariantsBySize(variants: ProductVariant[]) {
  const groups = new Map<string, ProductVariant[]>();
  variants.forEach((variant) => {
    const size = variantSizeGroup(variant);
    groups.set(size, [...(groups.get(size) ?? []), variant]);
  });

  return Array.from(groups, ([size, sizeVariants]) => {
    const representative = sizeVariants[0];
    const colors = uniqueOptionValues(sizeVariants.flatMap(variantColors));
    return {
      ...representative,
      attributes: attributesForSize(size, colors),
      stock: sizeVariants.reduce((total, variant) => total + variant.stock, 0),
      isActive: sizeVariants.some((variant) => variant.isActive),
    };
  });
}

export function ProductsView({ tenant }: Props) {
  const canUseAdvancedCatalog = tenantHasFeature(tenant, "advanced_catalog");

  const [products, setProducts] = useState<Product[]>(
    isSupabaseConfigured() ? [] : getProductsByTenant(tenant.id),
  );
  const [categories, setCategories] = useState<Category[]>(
    isSupabaseConfigured() ? [] : getCategoriesByTenant(tenant.id),
  );
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | "all">("all");
  const [availability, setAvailability] = useState<boolean | "all">("all");
  const [page, setPage] = useState(0);
  const [pagination, setPagination] = useState({
    page: 0,
    pageSize: 25,
    total: 0,
    totalPages: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  });
  const [showAdd, setShowAdd] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured());
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const [showCategories, setShowCategories] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categorySortOrder, setCategorySortOrder] = useState("");
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [variantSizes, setVariantSizes] = useState<string[]>([]);
  const [sizeDraft, setSizeDraft] = useState("");
  const [colorDrafts, setColorDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let active = true;

    if (!isSupabaseConfigured()) {
      const frame = window.requestAnimationFrame(() => {
        const storedProducts = getStoredProducts(tenant.id);
        if (storedProducts) setProducts(storedProducts);
        setCategories(getCategoriesByTenant(tenant.id));
        setIsLoading(false);
      });

      return () => {
        active = false;
        window.cancelAnimationFrame(frame);
      };
    }

    void listCategories(tenant.id, true)
      .then((loadedCategories) => {
        if (active) setCategories(loadedCategories);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load categories.",
        );
      });

    return () => {
      active = false;
    };
  }, [tenant.id]);

  const loadProductPage = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      const source =
        getStoredProducts(tenant.id) ?? getProductsByTenant(tenant.id);
      const normalizedSearch = search.toLowerCase();
      const filteredProducts = source.filter((product) => {
        const matchesSearch =
          !normalizedSearch ||
          product.name.toLowerCase().includes(normalizedSearch) ||
          product.description.toLowerCase().includes(normalizedSearch);
        const matchesCategory =
          categoryId === "all" || product.categoryId === categoryId;
        const matchesAvailability =
          availability === "all" || product.isActive === availability;
        return matchesSearch && matchesCategory && matchesAvailability;
      });
      const pageSize = 25;
      const totalPages =
        filteredProducts.length === 0
          ? 0
          : Math.ceil(filteredProducts.length / pageSize);

      if (totalPages > 0 && page >= totalPages && page > 0) {
        setPage(totalPages - 1);
        return;
      }

      const from = page * pageSize;
      const pageProducts = filteredProducts.slice(from, from + pageSize);
      setProducts(pageProducts);
      setPagination({
        page,
        pageSize,
        total: filteredProducts.length,
        totalPages,
        hasPreviousPage: page > 0,
        hasNextPage: from + pageProducts.length < filteredProducts.length,
      });
      setIsLoading(false);
      setError("");
      return;
    }

    setIsLoading(true);
    try {
      const result = await listProducts(tenant.id, {
        page,
        pageSize: 25,
        search,
        categoryId,
        availability,
      });

      if (
        result.totalPages > 0 &&
        result.page >= result.totalPages &&
        result.page > 0
      ) {
        setPage(result.totalPages - 1);
        return;
      }

      setProducts(result.products);
      setPagination({
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
        hasPreviousPage: result.hasPreviousPage,
        hasNextPage: result.hasNextPage,
      });
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load products.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [availability, categoryId, page, search, tenant.id]);

  useEffect(() => {
    void loadProductPage();
  }, [loadProductPage]);

  // State for the new product form
  const [newProduct, setNewProduct] = useState({
    name: "",
    price: "",
    description: "",
    categoryId: "",
    inventory: "",
    trackInventory: canUseAdvancedCatalog,
    image: "",
    tags: [] as string[],
    addons: [] as ProductAddon[],
  });

  const activeCategories = categories.filter(
    (category) => category.isActive !== false,
  );

  const toggle = async (id: string) => {
    const current = products.find((product) => product.id === id);
    if (!current) return;

    const updated = products.map((product) =>
      product.id === id ? { ...product, isActive: !product.isActive } : product,
    );
    setProducts(updated);
    setError("");

    try {
      if (isSupabaseConfigured()) {
        await setProductAvailability(tenant.id, id, !current.isActive);
        await loadProductPage();
      } else setStoredProducts(tenant.id, updated);
    } catch (updateError) {
      setProducts(products);
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to update product.",
      );
    }
  };

  const del = async (id: string) => {
    const previous = products;
    const updated = products.filter((product) => product.id !== id);
    setProducts(updated);
    setError("");
    setIsDeleting(true);

    try {
      if (isSupabaseConfigured()) {
        await deleteProduct(tenant.id, id);
        await loadProductPage();
      } else {
        setStoredProducts(tenant.id, updated);
      }
      setDeleteTarget(null);
    } catch (deleteError) {
      setProducts(previous);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete product.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const openAdd = () => {
    setEditingProduct(null);
    setNewProduct({
      name: "",
      price: "",
      description: "",
      categoryId: "",
      inventory: "",
      trackInventory: canUseAdvancedCatalog,
      image: "",
      tags: [],
      addons: [],
    });
    setVariants([]);
    setVariantSizes([]);
    setSizeDraft("");
    setColorDrafts({});
    setError("");
    setShowAdd(true);
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setNewProduct({
      name: product.name,
      price: String(product.price),
      description: product.description,
      categoryId: product.categoryId,
      inventory: product.inventory == null ? "" : String(product.inventory),
      trackInventory: product.trackInventory !== false,
      image: product.image,
      tags: product.tags,
      addons: tenant.businessType === "retail" ? [] : (product.addons ?? []),
    });
    const productVariants = collapseVariantsBySize(product.variants ?? []);
    const productSizes = uniqueOptionValues(
      productVariants.map(variantSizeGroup),
    );
    setVariants(productVariants);
    setVariantSizes(productSizes);
    setSizeDraft("");
    setColorDrafts({});
    setError("");
    setShowAdd(true);
  };

  const addVariantSizes = () => {
    const additions = uniqueOptionValues(sizeDraft.split(","));
    if (additions.length === 0) return;
    const nextSizes = uniqueOptionValues([...variantSizes, ...additions]);
    const newSizes = nextSizes.filter(
      (size) =>
        !variantSizes.some(
          (existingSize) => existingSize.toLowerCase() === size.toLowerCase(),
        ),
    );
    setVariantSizes(nextSizes);
    setVariants((current) => [
      ...current,
      ...newSizes.map((size) =>
        createRetailVariant(
          size,
          newProduct.name,
          editingProduct?.id ?? "",
        ),
      ),
    ]);
    setColorDrafts((current) =>
      Object.fromEntries(nextSizes.map((size) => [size, current[size] ?? ""])),
    );
    setSizeDraft("");
  };

  const removeVariantSize = (size: string) => {
    setVariantSizes((current) =>
      current.filter((candidate) => candidate !== size),
    );
    setVariants((current) =>
      current.filter((variant) => !variantBelongsToSize(variant, size)),
    );
    setColorDrafts((current) => {
      const next = { ...current };
      delete next[size];
      return next;
    });
  };

  const addColorsToSize = (size: string) => {
    const additions = uniqueOptionValues((colorDrafts[size] ?? "").split(","));
    if (additions.length === 0) return;

    setVariants((current) => {
      return current.map((variant) =>
        variantBelongsToSize(variant, size)
          ? {
              ...variant,
              attributes: attributesForSize(size, [
                ...variantColors(variant),
                ...additions,
              ]),
            }
          : variant,
      );
    });
    setColorDrafts((current) => ({ ...current, [size]: "" }));
  };

  const removeColorFromSize = (size: string, color: string) => {
    setVariants((current) =>
      current.map((variant) =>
        variantBelongsToSize(variant, size)
          ? {
              ...variant,
              attributes: attributesForSize(
                size,
                variantColors(variant).filter(
                  (candidate) => candidate !== color,
                ),
              ),
            }
          : variant,
      ),
    );
  };

  const handleSaveProduct = async () => {
    if (!newProduct.name || !newProduct.price) {
      setError("Please fill in at least name and price.");
      return;
    }

    const price = Number(newProduct.price);
    if (!Number.isFinite(price) || price < 0) {
      setError("Enter a valid product price.");
      return;
    }

    if (
      tenant.businessType === "retail" &&
      variantSizes.length > 0 &&
      variants.length === 0
    ) {
      setError(
        "Keep at least one stock combination for the sizes and colors on this product.",
      );
      return;
    }

    const usesVariantInventory =
      tenant.businessType === "retail" && variants.length > 0;
    const inventory = newProduct.trackInventory
      ? usesVariantInventory
        ? variants
            .filter((variant) => variant.isActive)
            .reduce((total, variant) => total + variant.stock, 0)
        : Number(newProduct.inventory)
      : null;
    if (
      newProduct.trackInventory &&
      !usesVariantInventory &&
      (newProduct.inventory.trim() === "" ||
        !Number.isInteger(inventory) ||
        inventory === null ||
        inventory < 0)
    ) {
      setError(
        "Enter a whole-number inventory of zero or more, or turn off inventory tracking.",
      );
      return;
    }

    if (
      tenant.businessType !== "retail" &&
      newProduct.addons.some(
        (addon) =>
          !addon.name.trim() ||
          !Number.isFinite(addon.price) ||
          addon.price < 0,
      )
    ) {
      setError("Enter a name and valid price for each add-on.");
      return;
    }

    if (
      tenant.businessType === "retail" &&
      variants.some(
        (variant) =>
          !variant.sku.trim() ||
          Object.keys(variant.attributes).length === 0 ||
          Object.values(variant.attributes).some((value) => !value.trim()) ||
          (variant.price !== undefined &&
            (!Number.isFinite(variant.price) || variant.price < 0)) ||
          !Number.isInteger(variant.stock) ||
          variant.stock < 0,
      )
    ) {
      setError(
        "Each retail variant needs a SKU, a size or color, and a whole-number stock value.",
      );
      return;
    }
    if (
      tenant.businessType === "retail" &&
      new Set(variants.map((variant) => variant.sku.trim().toLowerCase()))
        .size !== variants.length
    ) {
      setError("Retail variant SKUs must be unique.");
      return;
    }
    if (tenant.businessType === "retail") {
      const optionCombinations = variants.map((variant) =>
        Object.entries(variant.attributes)
          .map(
            ([key, value]) =>
              `${key.trim().toLowerCase()}:${value.trim().toLowerCase()}`,
          )
          .sort()
          .join("|"),
      );
      if (new Set(optionCombinations).size !== optionCombinations.length) {
        setError("Each retail size and color combination must be unique.");
        return;
      }
    }

    setIsSaving(true);
    setError("");
    const category = categories.find(
      (candidate) => candidate.id === newProduct.categoryId,
    );

    try {
      let product: Product;
      const input = {
        name: newProduct.name,
        description: newProduct.description,
        price,
        image: newProduct.image,
        categoryId: newProduct.categoryId,
        inventory,
        trackInventory: newProduct.trackInventory,
        addons:
          tenant.businessType === "retail"
            ? []
            : newProduct.addons.map((addon) => ({
                ...addon,
                name: addon.name.trim(),
              })),
      };
      if (isSupabaseConfigured()) {
        product = editingProduct
          ? await updateProduct(
              tenant.id,
              editingProduct.id,
              input,
              category?.name ?? "Uncategorized",
            )
          : await createProduct(
              tenant.id,
              input,
              category?.name ?? "Uncategorized",
            );
      } else {
        const localProductId =
          editingProduct?.id ??
          `p${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
        product = {
          id: localProductId,
          tenantId: tenant.id,
          name: newProduct.name,
          description: newProduct.description,
          price,
          image: newProduct.image,
          categoryId: newProduct.categoryId,
          categoryName: category?.name ?? "Uncategorized",
          isActive: editingProduct?.isActive ?? true,
          inventory: inventory ?? undefined,
          trackInventory: newProduct.trackInventory,
          tags: newProduct.tags,
          addons: input.addons,
          variants:
            tenant.businessType === "retail"
              ? variants.map((variant) => ({
                  ...variant,
                  productId: localProductId,
                  sku: variant.sku.trim(),
                }))
              : undefined,
          createdAt: editingProduct?.createdAt ?? new Date().toISOString(),
        };
        const nextProducts = editingProduct
          ? products.map((candidate) =>
              candidate.id === product.id ? product : candidate,
            )
          : [...products, product];
        setStoredProducts(tenant.id, nextProducts);
      }

      if (
        tenant.businessType === "retail" &&
        product.id &&
        isSupabaseConfigured()
      ) {
        await saveProductVariants(
          tenant.id,
          product.id,
          variants.map((variant) => ({
            id: variant.id,
            sku: variant.sku,
            attributes: variant.attributes,
            price: variant.price,
            stock: variant.stock,
            isActive: variant.isActive,
          })),
        );
        product = { ...product, variants };
      }

      if (isSupabaseConfigured()) {
        if (!editingProduct && page !== 0) {
          setPage(0);
        } else {
          await loadProductPage();
        }
      } else {
        setProducts((current) =>
          editingProduct
            ? current.map((candidate) =>
                candidate.id === product.id ? product : candidate,
              )
            : [...current, product],
        );
      }
      setNewProduct({
        name: "",
        price: "",
        description: "",
        categoryId: "",
        inventory: "",
        trackInventory: canUseAdvancedCatalog,
        image: "",
        tags: [],
        addons: [],
      });
      setVariants([]);
      setVariantSizes([]);
      setSizeDraft("");
      setColorDrafts({});
      setEditingProduct(null);
      setShowAdd(false);
    } catch (createError) {
      const message =
        createError instanceof Error
          ? createError.message
          : "Unable to save product.";
      setError(
        message.toLowerCase().includes("track_inventory") &&
          message.toLowerCase().includes("column")
          ? `${message} Apply supabase/migrations/202608260001_product_inventory_management.sql, then try again.`
          : message.toLowerCase().includes("addons") &&
              message.toLowerCase().includes("column")
            ? `${message} Apply supabase/migrations/202608250001_product_addons.sql to your Supabase project, then try again.`
            : message,
      );
    } finally {
      setIsSaving(false);
    }
  };

  const openCategoryManager = () => {
    if (!canUseAdvancedCatalog) {
      setError(
        `Categories, inventory tracking, and ${tenant.businessType === "retail" ? "product variants" : "product add-ons"} are available on the Pro plan.`,
      );
      return;
    }
    setEditingCategory(null);
    setCategoryName("");
    setCategorySortOrder(
      String(
        Math.max(0, ...categories.map((category) => category.sortOrder)) + 1,
      ),
    );
    setShowCategories(true);
    setError("");
  };

  const beginCategoryEdit = (category: Category) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategorySortOrder(String(category.sortOrder));
  };

  const resetCategoryForm = () => {
    setEditingCategory(null);
    setCategoryName("");
    setCategorySortOrder(
      String(
        Math.max(0, ...categories.map((category) => category.sortOrder)) + 1,
      ),
    );
  };

  const saveCategory = async () => {
    const name = categoryName.trim();
    const sortOrder = Number(categorySortOrder);
    if (!name) {
      setError("Category name is required.");
      return;
    }
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      setError("Category position must be a whole number of zero or more.");
      return;
    }
    if (
      categories.some(
        (category) =>
          category.id !== editingCategory?.id &&
          category.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      setError("A category with that name already exists.");
      return;
    }

    setIsSavingCategory(true);
    setError("");
    try {
      const saved = isSupabaseConfigured()
        ? editingCategory
          ? await updateCategory(tenant.id, editingCategory.id, name, sortOrder)
          : await createCategory(tenant.id, name, sortOrder)
        : {
            id: editingCategory?.id ?? `category-${Date.now()}`,
            tenantId: tenant.id,
            name,
            sortOrder,
            isActive: editingCategory?.isActive ?? true,
          };
      setCategories((current) => {
        const next = editingCategory
          ? current.map((category) =>
              category.id === saved.id ? saved : category,
            )
          : [...current, saved];
        return next.sort(
          (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
        );
      });
      if (editingCategory) {
        setProducts((current) =>
          current.map((product) =>
            product.categoryId === saved.id
              ? { ...product, categoryName: saved.name }
              : product,
          ),
        );
        if (categoryId === editingCategory.id) setCategoryId(saved.id);
      }
      resetCategoryForm();
    } catch (categoryError) {
      setError(
        categoryError instanceof Error
          ? categoryError.message
          : "Unable to save category.",
      );
    } finally {
      setIsSavingCategory(false);
    }
  };

  const toggleCategory = async (category: Category) => {
    setError("");
    try {
      const saved = isSupabaseConfigured()
        ? await setCategoryActive(
            tenant.id,
            category.id,
            category.isActive === false,
          )
        : { ...category, isActive: category.isActive === false };
      setCategories((current) =>
        current.map((candidate) =>
          candidate.id === saved.id ? saved : candidate,
        ),
      );
      if (saved.isActive === false && categoryId === saved.id) {
        setCategoryId("all");
        setPage(0);
      }
    } catch (categoryError) {
      setError(
        categoryError instanceof Error
          ? categoryError.message
          : "Unable to update category.",
      );
    }
  };

  return (
    <div className="min-h-full space-y-4 bg-[#08111f] light:bg-[#f8fafc] p-4 text-white light:text-[#14213a] md:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-bold text-white light:text-[#17223a]">
            Products
          </h2>
          <p className="mt-0.5 text-[10px] text-slate-400 light:text-[#71809a]">
            {pagination.total} product{pagination.total === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={openCategoryManager}
            size="sm"
            variant="outline"
            disabled={!canUseAdvancedCatalog}
            title={
              canUseAdvancedCatalog
                ? "Manage storefront categories"
                : "Available on the Pro plan"
            }
          >
            <FolderTree className="w-4 h-4" /> Manage Categories
          </Button>
          <Button
            onClick={openAdd}
            size="sm"
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            <Plus className="w-4 h-4" /> Add Product
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300 light:text-red-700">
          {error}
        </div>
      )}

      {isLoading && (
        <p className="text-xs text-slate-400">
          Loading products from Supabase...
        </p>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 light:text-gray-500" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search products..."
            maxLength={120}
            className="h-8 w-full rounded-lg border border-slate-700 light:border-[#e3e8f0] bg-slate-800 light:bg-white pl-9 pr-3 text-[10px]
                       focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500
                       text-white light:text-gray-900 placeholder:text-slate-500 light:placeholder:text-gray-400"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setCategoryId("all");
              setPage(0);
            }}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[10px] font-medium transition-colors",
              categoryId === "all"
                ? "bg-violet-600 text-white"
                : "bg-slate-800 light:bg-gray-100 text-slate-300 light:text-gray-700 hover:bg-slate-700 light:hover:bg-gray-200",
            )}
          >
            All
          </button>
          {activeCategories.map((category) => (
            <button
              type="button"
              key={category.id}
              onClick={() => {
                setCategoryId(category.id);
                setPage(0);
              }}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[10px] font-medium transition-colors",
                categoryId === category.id
                  ? "bg-violet-600 text-white"
                  : "bg-slate-800 light:bg-gray-100 text-slate-300 light:text-gray-700 hover:bg-slate-700 light:hover:bg-gray-200",
              )}
            >
              {category.name}
            </button>
          ))}
          {[
            { label: "Live", value: true as const },
            { label: "Paused", value: false as const },
          ].map((option) => (
            <button
              type="button"
              key={option.label}
              onClick={() => {
                setAvailability((current) =>
                  current === option.value ? "all" : option.value,
                );
                setPage(0);
              }}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[10px] font-medium transition-colors",
                availability === option.value
                  ? "bg-violet-600 text-white"
                  : "bg-slate-800 light:bg-gray-100 text-slate-300 light:text-gray-700 hover:bg-slate-700 light:hover:bg-gray-200",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {!isLoading && products.length === 0 ? (
        <div className="py-16 text-center text-slate-400 light:text-gray-500">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No products found</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onEdit={openEdit}
              onToggle={toggle}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-slate-700/60 bg-slate-900/40 px-4 py-3 light:border-slate-200 light:bg-white sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-400 light:text-slate-600">
          {pagination.total === 0
            ? "0 products"
            : `Showing ${pagination.page * pagination.pageSize + 1}-${
                pagination.page * pagination.pageSize + products.length
              } of ${pagination.total} products`}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isLoading || !pagination.hasPreviousPage}
            onClick={() => setPage((current) => Math.max(0, current - 1))}
          >
            <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Previous
          </Button>
          <span className="min-w-20 text-center text-xs text-slate-400 light:text-slate-600">
            {pagination.totalPages === 0
              ? "Page 0 of 0"
              : `Page ${pagination.page + 1} of ${pagination.totalPages}`}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={isLoading || !pagination.hasNextPage}
            onClick={() => setPage((current) => current + 1)}
          >
            Next <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Add modal */}
      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title={editingProduct ? "Edit Product" : "Add New Product"}
        maxWidth="max-w-2xl"
        footer={
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowAdd(false)}
              className="flex-1 border-slate-600 light:border-gray-300 text-white light:text-gray-800 hover:bg-slate-700 light:hover:bg-gray-100"
            >
              Cancel
            </Button>
            <Button
              disabled={isSaving}
              className="flex-1 bg-violet-600 hover:bg-violet-500 light:bg-violet-600 light:hover:bg-violet-700 text-white"
              onClick={() => void handleSaveProduct()}
            >
              {isSaving
                ? "Saving..."
                : editingProduct
                  ? "Update Product"
                  : "Save Product"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-white light:text-gray-900">
          <Input
            label="Product Name"
            placeholder="e.g. Sourdough Loaf"
            value={newProduct.name}
            onChange={(e) =>
              setNewProduct({ ...newProduct, name: e.target.value })
            }
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Price ($)"
              type="number"
              placeholder="0.00"
              value={newProduct.price}
              onChange={(e) =>
                setNewProduct({ ...newProduct, price: e.target.value })
              }
            />
            {canUseAdvancedCatalog && (
              <Select
                label="Category"
                options={[
                  { value: "", label: "Select category..." },
                  ...categories
                    .filter(
                      (category) =>
                        category.isActive !== false ||
                        category.id === newProduct.categoryId,
                    )
                    .map((category) => ({
                      value: category.id,
                      label:
                        category.isActive === false
                          ? `${category.name} (hidden)`
                          : category.name,
                    })),
                ]}
                value={newProduct.categoryId}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, categoryId: e.target.value })
                }
              />
            )}
          </div>
          <Textarea
            label="Description"
            rows={3}
            placeholder="Describe the product..."
            value={newProduct.description}
            onChange={(e) =>
              setNewProduct({ ...newProduct, description: e.target.value })
            }
          />
          {canUseAdvancedCatalog ? (
            <div className="rounded-lg border border-slate-700 light:border-slate-200 p-3 space-y-3">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={newProduct.trackInventory}
                  onChange={(event) =>
                    setNewProduct({
                      ...newProduct,
                      trackInventory: event.target.checked,
                      inventory: event.target.checked
                        ? newProduct.inventory
                        : "",
                    })
                  }
                  className="mt-0.5 h-4 w-4 accent-violet-600"
                />
                <span>
                  <span className="block text-xs font-semibold">
                    Track inventory
                  </span>
                  <span className="block text-[10px] text-slate-400 light:text-slate-500">
                    Checkout subtracts stock and the storefront shows Sold Out
                    at zero.
                  </span>
                </span>
              </label>
              {newProduct.trackInventory &&
                !(tenant.businessType === "retail" && variants.length > 0) && (
                  <Input
                    label="Units currently in stock"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="e.g. 20"
                    value={newProduct.inventory}
                    onChange={(e) =>
                      setNewProduct({
                        ...newProduct,
                        inventory: e.target.value,
                      })
                    }
                  />
                )}
              {newProduct.trackInventory &&
                tenant.businessType === "retail" &&
                variants.length > 0 && (
                  <div className="rounded-lg border border-violet-500/25 bg-violet-500/10 px-3 py-2 text-xs text-violet-200 light:border-violet-200 light:bg-violet-50 light:text-violet-800">
                    Total inventory is calculated from active variants:{" "}
                    <strong>
                      {variants
                        .filter((variant) => variant.isActive)
                        .reduce((total, variant) => total + variant.stock, 0)}
                    </strong>{" "}
                    units.
                  </div>
                )}
              {!newProduct.trackInventory && (
                <p className="text-xs text-emerald-400 light:text-emerald-700">
                  Unlimited inventory — orders will not reduce a stock count.
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-violet-500/25 bg-violet-500/10 p-3 text-xs text-violet-200 light:border-violet-200 light:bg-violet-50 light:text-violet-800">
              Upgrade to Pro to organize products into categories, track
              inventory, and configure{" "}
              {tenant.businessType === "retail"
                ? "product variants"
                : "add-ons"}
              . Basic product details remain available on Beginner.
            </div>
          )}
          <div>
            <Input
              label="Image URL"
              placeholder="https://..."
              value={newProduct.image}
              onChange={(e) =>
                setNewProduct({ ...newProduct, image: e.target.value })
              }
            />
          </div>
          {canUseAdvancedCatalog && tenant.businessType !== "retail" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold">Add-ons</label>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() =>
                    setNewProduct({
                      ...newProduct,
                      addons: [
                        ...newProduct.addons,
                        { id: `addon-${Date.now()}`, name: "", price: 0 },
                      ],
                    })
                  }
                >
                  <Plus className="h-3.5 w-3.5" /> Add add-on
                </Button>
              </div>
              {newProduct.addons.length === 0 && (
                <p className="text-xs text-slate-400">
                  No add-ons configured for this product.
                </p>
              )}
              {newProduct.addons.map((addon, index) => (
                <div key={addon.id} className="flex items-end gap-2">
                  <Input
                    label={index === 0 ? "Name" : undefined}
                    placeholder="e.g. Extra cheese"
                    value={addon.name}
                    onChange={(event) =>
                      setNewProduct({
                        ...newProduct,
                        addons: newProduct.addons.map((item) =>
                          item.id === addon.id
                            ? { ...item, name: event.target.value }
                            : item,
                        ),
                      })
                    }
                  />
                  <Input
                    label={index === 0 ? "Price ($)" : undefined}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={addon.price}
                    onChange={(event) =>
                      setNewProduct({
                        ...newProduct,
                        addons: newProduct.addons.map((item) =>
                          item.id === addon.id
                            ? {
                                ...item,
                                price: Number(event.target.value) || 0,
                              }
                            : item,
                        ),
                      })
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    aria-label={`Remove ${addon.name || "add-on"}`}
                    onClick={() =>
                      setNewProduct({
                        ...newProduct,
                        addons: newProduct.addons.filter(
                          (item) => item.id !== addon.id,
                        ),
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          {tenant.businessType === "retail" && canUseAdvancedCatalog && (
            <div className="space-y-3 rounded-lg border border-violet-500/25 bg-violet-500/4 p-3">
              <div>
                <label className="text-sm font-semibold">Product options</label>
                <p className="text-[10px] text-slate-400">
                  Add a size, then choose only the colors stocked in that size.
                  Each new size starts with its own empty color list.
                </p>
              </div>
              <datalist id="product-variant-color-options">
                {Array.from(
                  new Set([
                    ...PRODUCT_COLOR_SUGGESTIONS,
                    ...variants.flatMap(variantColors),
                  ]),
                ).map((color) => (
                  <option key={color} value={color} />
                ))}
              </datalist>
              <div className="space-y-2 rounded-lg border border-slate-700 p-3 light:border-slate-300">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                  <Input
                    label="Add product sizes"
                    placeholder="S, M, L or 8, 9, 10"
                    value={sizeDraft}
                    onChange={(event) => setSizeDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      addVariantSizes();
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addVariantSizes}
                  >
                    <Plus className="h-3.5 w-3.5" /> Add size
                  </Button>
                </div>
                <p className="text-[10px] text-slate-400">
                  Add one size at a time or separate several sizes with commas.
                </p>
              </div>
              {variantSizes.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-600 px-3 py-4 text-center text-xs text-slate-400 light:border-slate-300 light:text-slate-500">
                  Add a size to configure its colors and inventory.
                </p>
              ) : null}
              {variantSizes.map((size) => {
                const sizeVariants = variants.filter((variant) =>
                  variantBelongsToSize(variant, size),
                );
                const variant = sizeVariants[0];
                const configuredColors = variant ? variantColors(variant) : [];
                if (!variant) return null;

                return (
                  <div
                    key={size}
                    className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/20 p-3 light:border-slate-300 light:bg-white/60"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">Size {size}</span>
                        <Badge variant="purple">
                          {configuredColors.length > 0
                            ? `${configuredColors.length} color${configuredColors.length === 1 ? "" : "s"}`
                            : "No color option"}
                        </Badge>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        aria-label={`Remove size ${size}`}
                        title={`Remove size ${size}`}
                        onClick={() => removeVariantSize(size)}
                      >
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </div>
                    <div className="rounded-lg border border-slate-700/80 p-3 light:border-slate-200">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                        <Input
                          label={`Add colors available in size ${size}`}
                          list="product-variant-color-options"
                          placeholder="Blue, Green, Navy"
                          value={colorDrafts[size] ?? ""}
                          onChange={(event) =>
                            setColorDrafts((current) => ({
                              ...current,
                              [size]: event.target.value,
                            }))
                          }
                          onKeyDown={(event) => {
                            if (event.key !== "Enter") return;
                            event.preventDefault();
                            addColorsToSize(size);
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addColorsToSize(size)}
                        >
                          <Plus className="h-3.5 w-3.5" /> Add color
                        </Button>
                      </div>
                      <p className="mt-2 text-[10px] text-slate-400">
                        These colors apply only to size {size}. Select a
                        suggestion, type a custom color, or use commas.
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-700 px-3 py-2.5 light:border-slate-200">
                      {configuredColors.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {configuredColors.map((color) => (
                            <button
                              key={color}
                              type="button"
                              aria-label={`Remove ${color} from size ${size}`}
                              title={`Remove ${color} from size ${size}`}
                              onClick={() => removeColorFromSize(size, color)}
                              className="inline-flex items-center gap-2 rounded-full border border-slate-600 bg-slate-700/70 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:border-red-400 hover:bg-red-500/10 light:border-slate-300 light:bg-slate-100 light:text-slate-700"
                            >
                              <span
                                aria-hidden="true"
                                className="h-3.5 w-3.5 rounded-full border border-white/40"
                                style={{ backgroundColor: color }}
                              />
                              {color}
                              <span aria-hidden="true" className="text-red-300">
                                ×
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">
                          No colors added. Customers will select only the size.
                        </p>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Input
                        label="SKU"
                        placeholder="SKU-001"
                        value={variant.sku}
                        onChange={(event) =>
                          setVariants((current) =>
                            current.map((item) =>
                              item.id === variant.id
                                ? { ...item, sku: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                      <Input
                        label="Price override"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Use base price"
                        value={variant.price ?? ""}
                        onChange={(event) =>
                          setVariants((current) =>
                            current.map((item) =>
                              item.id === variant.id
                                ? {
                                    ...item,
                                    price: event.target.value
                                      ? Number(event.target.value)
                                      : undefined,
                                  }
                                : item,
                            ),
                          )
                        }
                      />
                      <Input
                        label="Stock"
                        type="number"
                        min="0"
                        step="1"
                        value={variant.stock}
                        onChange={(event) =>
                          setVariants((current) =>
                            current.map((item) =>
                              item.id === variant.id
                                ? {
                                    ...item,
                                    stock: Number(event.target.value) || 0,
                                  }
                                : item,
                            ),
                          )
                        }
                      />
                    </div>
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-300 light:text-slate-700">
                      <input
                        type="checkbox"
                        checked={variant.isActive}
                        onChange={(event) =>
                          setVariants((current) =>
                            current.map((item) =>
                              item.id === variant.id
                                ? { ...item, isActive: event.target.checked }
                                : item,
                            ),
                          )
                        }
                        className="h-4 w-4 accent-violet-600"
                      />
                      Size available on storefront
                    </label>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={showCategories}
        onClose={() => setShowCategories(false)}
        title="Manage Categories"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-5 text-white light:text-slate-900">
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300 light:text-red-700">
              {error}
            </div>
          )}
          <div className="rounded-lg border border-slate-700 light:border-slate-200 p-4">
            <h3 className="mb-3 text-sm font-semibold">
              {editingCategory
                ? `Edit ${editingCategory.name}`
                : "Create a category"}
            </h3>
            <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto] sm:items-end">
              <Input
                label="Category name"
                placeholder="e.g. Appetizers"
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
              />
              <Input
                label="Position"
                type="number"
                min="0"
                step="1"
                value={categorySortOrder}
                onChange={(event) => setCategorySortOrder(event.target.value)}
              />
              <div className="flex gap-2">
                {editingCategory && (
                  <Button variant="outline" onClick={resetCategoryForm}>
                    Cancel
                  </Button>
                )}
                <Button
                  disabled={isSavingCategory}
                  onClick={() => void saveCategory()}
                >
                  {isSavingCategory
                    ? "Saving..."
                    : editingCategory
                      ? "Update"
                      : "Add"}
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {categories.length === 0 && (
              <p className="py-6 text-center text-xs text-slate-400">
                No categories yet.
              </p>
            )}
            {categories.map((category) => (
              <div
                key={category.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-700 light:border-slate-200 px-4 py-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{category.name}</p>
                    <Badge
                      variant={
                        category.isActive === false ? "default" : "success"
                      }
                    >
                      {category.isActive === false ? "Hidden" : "Visible"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">
                    Position {category.sortOrder} ·{" "}
                    {
                      products.filter(
                        (product) => product.categoryId === category.id,
                      ).length
                    }{" "}
                    on this page
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => beginCategoryEdit(category)}
                  >
                    <Edit2 className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => void toggleCategory(category)}
                  >
                    {category.isActive === false ? "Show" : "Hide"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Product"
        footer={
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setDeleteTarget(null)}
            >
              Keep Product
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              disabled={isDeleting}
              onClick={() => {
                if (deleteTarget) void del(deleteTarget.id);
              }}
            >
              Delete Product
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-300 light:text-gray-700">
          This permanently removes <strong>{deleteTarget?.name}</strong> from
          the dashboard and storefront.
        </p>
      </Modal>
    </div>
  );
}

function ProductCard({
  product,
  onEdit,
  onToggle,
  onDelete,
}: {
  product: Product;
  onEdit: (product: Product) => void;
  onToggle: (id: string) => void;
  onDelete: (product: Product) => void;
}) {
  const tracksInventory = product.trackInventory !== false;
  const stock = product.inventory ?? 0;
  const isSoldOut = tracksInventory && stock === 0;
  const isLowStock = tracksInventory && stock > 0 && stock <= 5;

  return (
    <Card className="group overflow-hidden">
      <div className="relative h-40 overflow-hidden bg-slate-700 light:bg-slate-100">
        {product.image ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            unoptimized
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-500">
            <Package className="h-10 w-10" />
          </div>
        )}
        <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap">
          {product.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 bg-black/60 light:bg-white/90 text-white light:text-gray-800 text-[10px] font-semibold rounded-full backdrop-blur-sm capitalize"
            >
              {tag}
            </span>
          ))}
        </div>
        <div className="absolute top-3 right-3">
          <Badge
            variant={
              !product.isActive ? "default" : isSoldOut ? "danger" : "success"
            }
          >
            {!product.isActive ? "Paused" : isSoldOut ? "Sold Out" : "Live"}
          </Badge>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-white light:text-gray-900 text-sm truncate">
              {product.name}
            </h4>
            <p className="text-xs text-slate-400 light:text-gray-600 mt-0.5 line-clamp-2">
              {product.description}
            </p>
          </div>
          <span className="shrink-0 text-sm font-black text-white light:text-gray-900">
            {formatCurrency(product.price)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400 light:text-gray-500 bg-slate-700 light:bg-gray-100 px-2 py-1 rounded-lg">
            {product.categoryName}
          </span>
          <span
            className={cn(
              "text-xs font-semibold",
              isSoldOut || isLowStock
                ? "text-red-400 light:text-red-600"
                : "text-slate-400 light:text-gray-500",
            )}
          >
            {!tracksInventory
              ? "Unlimited"
              : isSoldOut
                ? "Sold out"
                : isLowStock
                  ? `Low stock: ${stock}`
                  : `${stock} left`}
          </span>
        </div>
        <div className="flex items-center gap-1 pt-1 border-t border-slate-700 light:border-slate-100">
          <Button
            variant="ghost"
            size="xs"
            className="flex-1 justify-center text-white light:text-gray-800 hover:bg-slate-700 light:hover:bg-slate-100"
            onClick={() => onEdit(product)}
          >
            <Edit2 className="w-3.5 h-3.5 mr-1" />{" "}
            {tracksInventory && stock <= 5 ? "Restock" : "Edit"}
          </Button>
          <div className="w-px h-5 bg-slate-700 light:bg-slate-200" />
          <Button
            variant="ghost"
            size="xs"
            className="text-red-400 light:text-red-600 hover:text-red-300 light:hover:text-red-800 hover:bg-red-500/10 light:hover:bg-red-50"
            onClick={() => onDelete(product)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          <div className="w-px h-5 bg-slate-700 light:bg-slate-200" />
          <button
            type="button"
            onClick={() => onToggle(product.id)}
            className="text-slate-400 light:text-gray-500 hover:text-white light:hover:text-gray-900 transition-colors"
            aria-label={
              product.isActive
                ? `Pause ${product.name}`
                : `Publish ${product.name}`
            }
            title={
              product.isActive
                ? "Pause storefront listing"
                : "Publish storefront listing"
            }
          >
            {product.isActive ? (
              <ToggleRight className="w-5 h-5 text-emerald-400 light:text-emerald-600" />
            ) : (
              <ToggleLeft className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </Card>
  );
}
