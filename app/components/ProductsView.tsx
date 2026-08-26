"use client";

import { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, Search, Package, ToggleLeft, ToggleRight } from "lucide-react";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Modal } from "../components/Modal";
import { Input, Textarea, Select } from "../components/input";
import { getProductsByTenant, getCategoriesByTenant } from "../data/mock";
import { formatCurrency, cn } from "../lib/utils";
import { getStoredProducts, setStoredProducts } from "../lib/storage";
// NEW: Import useRealtime for emitting product events
import { useRealtime } from "../contexts/realtime";
import { isSupabaseConfigured } from "../lib/supabase/config";
import {
  createProduct,
  deleteProduct,
  listCategories,
  listProducts,
  setProductAvailability,
  updateProduct,
} from "../services/productService";
import type { Category, Product, ProductAddon, Tenant } from "../types/index";

interface Props { tenant: Tenant }

export function ProductsView({ tenant }: Props) {
  // NEW: Get realtime context to emit events
  const realtime = useRealtime();
  
  const [products, setProducts] = useState<Product[]>(getProductsByTenant(tenant.id));
  const [categories, setCategories] = useState<Category[]>(getCategoriesByTenant(tenant.id));
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured());
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      const frame = window.requestAnimationFrame(() => {
        const storedProducts = getStoredProducts(tenant.id);
        if (storedProducts) setProducts(storedProducts);
        setIsLoading(false);
      });

      return () => window.cancelAnimationFrame(frame);
    }
    let active = true;

    Promise.all([listProducts(tenant.id), listCategories(tenant.id)])
      .then(([loadedProducts, loadedCategories]) => {
        if (!active) return;
        setProducts(loadedProducts);
        setCategories(loadedCategories);
        setError("");
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load products.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [tenant.id]);

  // State for the new product form
  const [newProduct, setNewProduct] = useState({
    name: "",
    price: "",
    description: "",
    categoryId: "",
    inventory: "",
    image: "",
    tags: [] as string[],
    addons: [] as ProductAddon[],
  });

  const filtered = products.filter(p => {
    const matchSearch = search === "" || p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = cat === "All" || p.categoryName === cat;
    return matchSearch && matchCat;
  });

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
      }
      else setStoredProducts(tenant.id, updated);

      realtime.addEvent({
        type: "product_updated",
        tenantId: tenant.id,
        product: { ...current, isActive: !current.isActive },
      });
    } catch (updateError) {
      setProducts(products);
      setError(updateError instanceof Error ? updateError.message : "Unable to update product.");
    }
  };

  const del = async (id: string) => {
    const previous = products;
    const updated = products.filter((product) => product.id !== id);
    setProducts(updated);
    setError("");
    setIsDeleting(true);

    try {
      if (isSupabaseConfigured()) await deleteProduct(tenant.id, id);
      else setStoredProducts(tenant.id, updated);
      realtime.addEvent({ type: "product_deleted", tenantId: tenant.id, productId: id });
      setDeleteTarget(null);
    } catch (deleteError) {
      setProducts(previous);
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete product.");
    } finally {
      setIsDeleting(false);
    }
  };

  const openAdd = () => {
    setEditingProduct(null);
    setNewProduct({ name: "", price: "", description: "", categoryId: "", inventory: "", image: "", tags: [], addons: [] });
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
      image: product.image,
      tags: product.tags,
      addons: product.addons ?? [],
    });
    setError("");
    setShowAdd(true);
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

    if (newProduct.addons.some((addon) => !addon.name.trim() || !Number.isFinite(addon.price) || addon.price < 0)) {
      setError("Enter a name and valid price for each add-on.");
      return;
    }

    setIsSaving(true);
    setError("");
    const category = categories.find((candidate) => candidate.id === newProduct.categoryId);

    try {
      let product: Product;
      const input = {
        name: newProduct.name,
        description: newProduct.description,
        price,
        image: newProduct.image,
        categoryId: newProduct.categoryId,
        inventory: newProduct.inventory ? Number(newProduct.inventory) : 0,
        addons: newProduct.addons.map((addon) => ({ ...addon, name: addon.name.trim() })),
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
        product = {
          id: editingProduct?.id ?? `p${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
          tenantId: tenant.id,
          name: newProduct.name,
          description: newProduct.description,
          price,
          image: newProduct.image,
          categoryId: newProduct.categoryId,
          categoryName: category?.name ?? "Uncategorized",
          isActive: true,
          inventory: newProduct.inventory ? Number(newProduct.inventory) : 0,
          tags: newProduct.tags,
          addons: newProduct.addons,
          createdAt: editingProduct?.createdAt ?? new Date().toISOString(),
        };
        const nextProducts = editingProduct
          ? products.map((candidate) => (candidate.id === product.id ? product : candidate))
          : [...products, product];
        setStoredProducts(tenant.id, nextProducts);
      }

      setProducts((current) =>
        editingProduct
          ? current.map((candidate) => (candidate.id === product.id ? product : candidate))
          : [...current, product],
      );
      realtime.addEvent({
        type: editingProduct ? "product_updated" : "product_added",
        tenantId: tenant.id,
        product,
      });
      setNewProduct({ name: "", price: "", description: "", categoryId: "", inventory: "", image: "", tags: [], addons: [] });
      setEditingProduct(null);
      setShowAdd(false);
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "Unable to save product.";
      setError(
        message.toLowerCase().includes("addons") && message.toLowerCase().includes("column")
          ? `${message} Apply supabase/migrations/202608250001_product_addons.sql to your Supabase project, then try again.`
          : message,
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen space-y-4 bg-[#08111f] light:bg-[#f8fafc] p-4 text-white light:text-[#14213a] md:p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-white light:text-[#17223a]">Products</h2>
          <p className="mt-0.5 text-[10px] text-slate-400 light:text-[#71809a]">
            {products.filter(p => p.isActive).length} active · {products.length} total
          </p>
        </div>
        <Button onClick={openAdd} size="sm" className="bg-violet-600 hover:bg-violet-700 text-white">
          <Plus className="w-4 h-4" /> Add Product
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300 light:text-red-700">
          {error}
        </div>
      )}

      {isLoading && <p className="text-xs text-slate-400">Loading products from Supabase...</p>}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 light:text-gray-500" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search products..."
            className="h-8 w-full rounded-lg border border-slate-700 light:border-[#e3e8f0] bg-slate-800 light:bg-white pl-9 pr-3 text-[10px]
                       focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500
                       text-white light:text-gray-900 placeholder:text-slate-500 light:placeholder:text-gray-400"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {["All", ...categories.map(c => c.name)].map(c => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[10px] font-medium transition-colors",
                cat === c
                  ? "bg-violet-600 text-white"
                  : "bg-slate-800 light:bg-gray-100 text-slate-300 light:text-gray-700 hover:bg-slate-700 light:hover:bg-gray-200"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center text-slate-400 light:text-gray-500">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No products found</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(p => (
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

      {/* Add modal */}
      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title={editingProduct ? "Edit Product" : "Add New Product"}
        footer={
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowAdd(false)} className="flex-1 border-slate-600 light:border-gray-300 text-white light:text-gray-800 hover:bg-slate-700 light:hover:bg-gray-100">
              Cancel
            </Button>
            <Button disabled={isSaving} className="flex-1 bg-violet-600 hover:bg-violet-500 light:bg-violet-600 light:hover:bg-violet-700 text-white" onClick={handleSaveProduct}>
              {isSaving ? "Saving..." : editingProduct ? "Update Product" : "Save Product"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-white light:text-gray-900">
          <Input
            label="Product Name"
            placeholder="e.g. Sourdough Loaf"
            value={newProduct.name}
            onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Price ($)"
              type="number"
              placeholder="0.00"
              value={newProduct.price}
              onChange={e => setNewProduct({ ...newProduct, price: e.target.value })}
            />
            <Select
              label="Category"
              options={[
                { value: "", label: "Select category..." },
                ...categories.map(c => ({ value: c.id, label: c.name })),
              ]}
              value={newProduct.categoryId}
              onChange={e => setNewProduct({ ...newProduct, categoryId: e.target.value })}
            />
          </div>
          <Textarea
            label="Description"
            rows={3}
            placeholder="Describe the product..."
            value={newProduct.description}
            onChange={e => setNewProduct({ ...newProduct, description: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Inventory"
              type="number"
              placeholder="Optional"
              value={newProduct.inventory}
              onChange={e => setNewProduct({ ...newProduct, inventory: e.target.value })}
            />
            <Input
              label="Image URL"
              placeholder="https://..."
              value={newProduct.image}
              onChange={e => setNewProduct({ ...newProduct, image: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold">Add-ons</label>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => setNewProduct({
                  ...newProduct,
                  addons: [...newProduct.addons, { id: `addon-${Date.now()}`, name: "", price: 0 }],
                })}
              >
                <Plus className="h-3.5 w-3.5" /> Add add-on
              </Button>
            </div>
            {newProduct.addons.length === 0 && (
              <p className="text-xs text-slate-400">No add-ons configured for this product.</p>
            )}
            {newProduct.addons.map((addon, index) => (
              <div key={addon.id} className="flex items-end gap-2">
                <Input
                  label={index === 0 ? "Name" : undefined}
                  placeholder="e.g. Extra cheese"
                  value={addon.name}
                  onChange={(event) => setNewProduct({
                    ...newProduct,
                    addons: newProduct.addons.map((item) => item.id === addon.id ? { ...item, name: event.target.value } : item),
                  })}
                />
                <Input
                  label={index === 0 ? "Price ($)" : undefined}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={addon.price}
                  onChange={(event) => setNewProduct({
                    ...newProduct,
                    addons: newProduct.addons.map((item) => item.id === addon.id ? { ...item, price: Number(event.target.value) || 0 } : item),
                  })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  aria-label={`Remove ${addon.name || "add-on"}`}
                  onClick={() => setNewProduct({ ...newProduct, addons: newProduct.addons.filter((item) => item.id !== addon.id) })}
                >
                  <Trash2 className="h-4 w-4 text-red-400" />
                </Button>
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
            <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>
              Keep Product
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              disabled={isDeleting}
              onClick={() => deleteTarget && del(deleteTarget.id)}
            >
              Delete Product
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-300 light:text-gray-700">
          This permanently removes <strong>{deleteTarget?.name}</strong> from the dashboard and storefront.
        </p>
      </Modal>
    </div>
  );
}

function ProductCard({ product, onEdit, onToggle, onDelete }: {
  product: Product;
  onEdit: (product: Product) => void;
  onToggle: (id: string) => void;
  onDelete: (product: Product) => void;
}) {
  return (
    <Card className="group overflow-hidden">
      <div className="relative h-40 overflow-hidden bg-slate-700 light:bg-slate-100">
        {product.image ? (
          <img
            src={product.image} alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-500">
            <Package className="h-10 w-10" />
          </div>
        )}
        <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap">
          {product.tags.map(tag => (
            <span key={tag}
              className="px-2 py-0.5 bg-black/60 light:bg-white/90 text-white light:text-gray-800 text-[10px] font-semibold rounded-full backdrop-blur-sm capitalize">
              {tag}
            </span>
          ))}
        </div>
        <div className="absolute top-3 right-3">
          <Badge variant={product.isActive ? "success" : "default"}>
            {product.isActive ? "Live" : "Off"}
          </Badge>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-white light:text-gray-900 text-sm truncate">{product.name}</h4>
            <p className="text-xs text-slate-400 light:text-gray-600 mt-0.5 line-clamp-2">{product.description}</p>
          </div>
          <span className="text-sm font-black text-white light:text-gray-900 flex-shrink-0">{formatCurrency(product.price)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400 light:text-gray-500 bg-slate-700 light:bg-gray-100 px-2 py-1 rounded-lg">{product.categoryName}</span>
          {product.inventory !== undefined && (
            <span className={cn("text-xs font-semibold", product.inventory < 10 ? "text-red-400 light:text-red-600" : "text-slate-400 light:text-gray-500")}>
              {product.inventory} left
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 pt-1 border-t border-slate-700 light:border-slate-100">
          <Button variant="ghost" size="xs" className="flex-1 justify-center text-white light:text-gray-800 hover:bg-slate-700 light:hover:bg-slate-100" onClick={() => onEdit(product)}>
            <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
          </Button>
          <div className="w-px h-5 bg-slate-700 light:bg-slate-200" />
          <Button variant="ghost" size="xs" className="text-red-400 light:text-red-600 hover:text-red-300 light:hover:text-red-800 hover:bg-red-500/10 light:hover:bg-red-50"
            onClick={() => onDelete(product)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          <div className="w-px h-5 bg-slate-700 light:bg-slate-200" />
          <button onClick={() => onToggle(product.id)} className="text-slate-400 light:text-gray-500 hover:text-white light:hover:text-gray-900 transition-colors">
            {product.isActive
              ? <ToggleRight className="w-5 h-5 text-emerald-400 light:text-emerald-600" />
              : <ToggleLeft className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </Card>
  );
}
