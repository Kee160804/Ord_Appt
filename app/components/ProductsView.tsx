"use client";

import { useState } from "react";
import { Plus, Edit2, Trash2, Search, Package, ToggleLeft, ToggleRight } from "lucide-react";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Modal } from "../components/Modal";
import { Input, Textarea, Select } from "../components/input";
import { getProductsByTenant, getCategoriesByTenant } from "../data/mock";
import { formatCurrency, cn } from "../lib/utils";
import { getStoredProducts, setStoredProducts } from "../lib/storage";
import type { Product, Tenant } from "../types/index";

interface Props { tenant: Tenant }

export function ProductsView({ tenant }: Props) {
  // Initialize products from localStorage (if any) or fallback to mock data
  const initialProducts = getStoredProducts(tenant.id) ?? getProductsByTenant(tenant.id);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const categories = getCategoriesByTenant(tenant.id);

  // State for the new product form
  const [newProduct, setNewProduct] = useState({
    name: "",
    price: "",
    description: "",
    categoryId: "",
    inventory: "",
    image: "",
    tags: [] as string[],
  });

  const filtered = products.filter(p => {
    const matchSearch = search === "" || p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = cat === "All" || p.categoryName === cat;
    return matchSearch && matchCat;
  });

  const toggle = (id: string) => {
    setProducts(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, isActive: !p.isActive } : p);
      setStoredProducts(tenant.id, updated);
      return updated;
    });
  };

  const del = (id: string) => {
    setProducts(prev => {
      const updated = prev.filter(p => p.id !== id);
      setStoredProducts(tenant.id, updated);
      return updated;
    });
  };

  const handleAddProduct = () => {
    if (!newProduct.name || !newProduct.price) {
      alert("Please fill in at least name and price");
      return;
    }

    const category = categories.find(c => c.id === newProduct.categoryId);
    // Generate a unique ID – using timestamp + random (safe in event handler)
    // eslint-disable-next-line react-hooks/purity
    const newId = `p${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const product: Product = {
      id: newId,
      tenantId: tenant.id,
      name: newProduct.name,
      description: newProduct.description || "",
      price: parseFloat(newProduct.price),
      image: newProduct.image || "",
      categoryId: newProduct.categoryId || "",
      categoryName: category?.name || "",
      isActive: true,
      inventory: newProduct.inventory ? parseInt(newProduct.inventory) : 0,
      tags: newProduct.tags,
      createdAt: new Date().toISOString(),
    };

    const updated = [...products, product];
    setProducts(updated);
    setStoredProducts(tenant.id, updated);

    // Reset form and close modal
    setNewProduct({ name: "", price: "", description: "", categoryId: "", inventory: "", image: "", tags: [] });
    setShowAdd(false);
  };

  return (
    <div className="p-8 space-y-6 bg-[#0a0f1a] light:bg-white min-h-screen text-white light:text-gray-900">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white light:text-gray-900">Products</h2>
          <p className="text-sm text-slate-400 light:text-gray-600">
            {products.filter(p => p.isActive).length} active · {products.length} total
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="bg-violet-600 hover:bg-violet-500 light:bg-violet-600 light:hover:bg-violet-700 text-white">
          <Plus className="w-4 h-4" /> Add Product
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 light:text-gray-500" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search products..."
            className="pl-9 pr-4 py-2 text-sm bg-slate-800 light:bg-white border border-slate-700 light:border-gray-200 rounded-xl w-full
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
                "px-3 py-1.5 text-sm font-medium rounded-xl transition-colors",
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
            <ProductCard key={p.id} product={p} onToggle={toggle} onDelete={del} />
          ))}
        </div>
      )}

      {/* Add modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add New Product"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowAdd(false)} className="flex-1 border-slate-600 light:border-gray-300 text-white light:text-gray-800 hover:bg-slate-700 light:hover:bg-gray-100">
              Cancel
            </Button>
            <Button className="flex-1 bg-violet-600 hover:bg-violet-500 light:bg-violet-600 light:hover:bg-violet-700 text-white" onClick={handleAddProduct}>
              Save Product
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
        </div>
      </Modal>
    </div>
  );
}

function ProductCard({ product, onToggle, onDelete }: {
  product: Product;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card className="overflow-hidden group bg-slate-800/50 light:bg-white border-slate-700 light:border-gray-200">
      <div className="relative h-40 overflow-hidden bg-slate-700 light:bg-slate-100">
        <img
          src={product.image} alt={product.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
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
          <Button variant="ghost" size="xs" className="flex-1 justify-center text-white light:text-gray-800 hover:bg-slate-700 light:hover:bg-slate-100">
            <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
          </Button>
          <div className="w-px h-5 bg-slate-700 light:bg-slate-200" />
          <Button variant="ghost" size="xs" className="text-red-400 light:text-red-600 hover:text-red-300 light:hover:text-red-800 hover:bg-red-500/10 light:hover:bg-red-50"
            onClick={() => onDelete(product.id)}>
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