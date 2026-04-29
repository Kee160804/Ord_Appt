"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { Minus, Plus, ShoppingBag, Trash2, Eye } from "lucide-react";
import { Button } from "@/app/components/Button";
import { Modal } from "@/app/components/Modal";
import { Input, Select } from "@/app/components/input";
import { formatCurrency } from "@/app/lib/utils";
import { Product, Tenant } from "@/app/types/index";

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  addons: { name: string; price: number }[];
  image?: string;
}

interface AddonOption {
  id: string;
  name: string;
  price: number;
}

interface OrderingMenuProps {
  tenant: Tenant;
  products: Product[];
  categories: { id: string; name: string }[];
  onAddToCart: (item: CartItem) => void;
  cart: CartItem[];
  updateCart: (items: CartItem[]) => void;
}

const AVAILABLE_ADDONS: AddonOption[] = [
  { id: "extra_chili", name: "Extra Chili", price: 0.5 },
  { id: "add_egg", name: "Add Egg", price: 1.0 },
  { id: "extra_cheese", name: "Extra Cheese", price: 1.5 },
];

const PLACEHOLDER_IMG = "/fallback-product.png";

export function OrderingMenu({
  tenant,
  products,
  categories,
  onAddToCart,
  cart,
  updateCart,
}: OrderingMenuProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState<AddonOption[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [tableLocation, setTableLocation] = useState("");
  const [orderType, setOrderType] = useState("dine_in");

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCat = selectedCategory ? p.categoryId === selectedCategory : true;
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description ?? "").toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  const subtotal = cart.reduce((sum, i) => {
    return sum + i.price * i.quantity + i.addons.reduce((a, ad) => a + ad.price * i.quantity, 0);
  }, 0);
  const tax = subtotal * 0.1;
  const discount = subtotal > 100 ? subtotal * 0.05 : 0;
  const grandTotal = subtotal + tax - discount;

  const openAddModal = (product: Product) => {
    setCurrentProduct(product);
    setQuantity(1);
    setSelectedAddons([]);
    setModalOpen(true);
  };

  const handleAddToCart = () => {
    if (!currentProduct) return;
    onAddToCart({
      id: currentProduct.id,
      name: currentProduct.name,
      price: currentProduct.price,
      quantity,
      addons: selectedAddons.map(({ name, price }) => ({ name, price })),
      image: currentProduct.image,
    });
    setModalOpen(false);
  };

  const updateQty = (id: string, delta: number) => {
    updateCart(
      cart
        .map((i) => (i.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const removeItem = (id: string) => updateCart(cart.filter((i) => i.id !== id));

  // ✅ ADDED CONFIRMATION
  const clearCart = () => {
    if (window.confirm("Are you sure you want to clear your entire order?")) {
      updateCart([]);
    }
  };

  return (
    <>
      <div
        className="grid gap-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm"
        style={{ gridTemplateColumns: "1fr 360px", minHeight: "calc(100vh - 260px)" }}
      >
        {/* LEFT: Menu */}
        <div className="overflow-y-auto bg-white dark:bg-slate-900 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Menu for {tenant.name}
            </h2>
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 w-52">
              <svg
                className="w-3.5 h-3.5 text-slate-400 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Search foods…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-xs outline-none text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 w-full"
                aria-label="Search foods"
              />
              <span className="text-[10px] text-slate-300 dark:text-slate-600 hidden sm:block whitespace-nowrap">
                ⌘ K
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            <CategoryPill
              label="All"
              active={selectedCategory === null}
              onClick={() => setSelectedCategory(null)}
            />
            {categories.map((cat) => (
              <CategoryPill
                key={cat.id}
                label={cat.name}
                active={selectedCategory === cat.id}
                onClick={() => setSelectedCategory(cat.id)}
              />
            ))}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts.length === 0 && (
              <div className="col-span-full py-16 text-center text-slate-400 dark:text-slate-500">
                <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No items found.</p>
              </div>
            )}
            {filteredProducts.map((product) => {
              const cartItem = cart.find((i) => i.id === product.id);
              return (
                <div
                  key={product.id}
                  className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-md transition group"
                >
                  <div className="relative h-36 w-full overflow-hidden bg-slate-100 dark:bg-slate-700">
                    <Image
                      src={product.image || PLACEHOLDER_IMG}
                      alt={product.name}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      unoptimized
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = PLACEHOLDER_IMG;
                      }}
                    />
                    <span className="absolute top-2 left-2 bg-white/90 dark:bg-slate-900/90 text-violet-600 dark:text-violet-400 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                      {categories.find((c) => c.id === product.categoryId)?.name ?? "Item"}
                    </span>
                  </div>
                  <div className="p-3">
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-tight">
                      {product.name}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                      {product.description}
                    </p>
                    <div className="flex items-center justify-between mt-2.5">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {formatCurrency(product.price)}
                        <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500">
                          {" "}
                          / serving
                        </span>
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => cartItem && updateQty(product.id, -1)}
                          disabled={!cartItem}
                          className="w-5 h-5 rounded-full border border-slate-200 dark:border-slate-600 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 transition"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                        <span className="text-xs font-semibold w-4 text-center text-slate-800 dark:text-white">
                          {cartItem?.quantity ?? 0}
                        </span>
                        <button
                          onClick={() =>
                            cartItem ? updateQty(product.id, 1) : openAddModal(product)
                          }
                          className="w-5 h-5 rounded-full border border-slate-200 dark:border-slate-600 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={() => openAddModal(product)}
                      className="mt-2.5 w-full py-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-violet-600 hover:text-white text-slate-700 dark:text-slate-300 text-xs font-semibold transition"
                    >
                      Add to cart
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: Order Summary */}
        <div className="flex flex-col overflow-hidden border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Order Summary</h3>
              <button
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
                aria-label="View order details"
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <Input
                label="Customer Name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter Name"
              />
              <Input
                label="Table Location"
                value={tableLocation}
                onChange={(e) => setTableLocation(e.target.value)}
                placeholder="Select Table"
              />
              <Select
                label="Order Type"
                options={[
                  { value: "dine_in", label: "Dine In" },
                  { value: "takeaway", label: "Takeaway" },
                  { value: "delivery", label: "Delivery" },
                ]}
                value={orderType}
                onChange={(e) => setOrderType(e.target.value)}
              />
            </div>

            <div className="h-px bg-slate-100 dark:bg-slate-800" />

            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900 dark:text-white">Order Items</span>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-600 transition"
                  aria-label="Clear all items"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="py-10 text-center">
                <ShoppingBag className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Your cart is empty.
                  <br />
                  Add items from the menu.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map((item) => {
                  const addonsTotal = item.addons.reduce(
                    (a, ad) => a + ad.price * item.quantity,
                    0
                  );
                  const lineTotal = item.price * item.quantity + addonsTotal;
                  return (
                    <div key={item.id} className="flex gap-3">
                      <div className="relative w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700">
                        <Image
                          src={item.image || PLACEHOLDER_IMG}
                          alt={item.name}
                          fill
                          sizes="80px"
                          className="object-cover"
                          unoptimized
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = PLACEHOLDER_IMG;
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-1">
                          <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight line-clamp-1">
                            {item.name}
                          </p>
                          <p className="text-xs font-bold text-slate-900 dark:text-white flex-shrink-0">
                            {formatCurrency(lineTotal)}
                          </p>
                        </div>
                        <span className="inline-block mt-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          ×{item.quantity}
                        </span>
                        {item.addons.length > 0 && (
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 space-y-0.5">
                            {item.addons.map((ad, i) => (
                              <div key={i}>
                                • {ad.name} (+{formatCurrency(ad.price)})
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <button
                            onClick={() => updateQty(item.id, -1)}
                            className="w-5 h-5 rounded border border-slate-200 dark:border-slate-600 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-2.5 h-2.5" />
                          </button>
                          <span className="text-[11px] font-semibold w-4 text-center text-slate-700 dark:text-slate-300">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQty(item.id, 1)}
                            className="w-5 h-5 rounded border border-slate-200 dark:border-slate-600 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-2.5 h-2.5" />
                          </button>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="ml-auto text-slate-300 dark:text-slate-600 hover:text-red-500 transition"
                            aria-label="Remove item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {cart.length > 0 && (
            <div className="flex-shrink-0 border-t border-slate-100 dark:border-slate-800 p-5 space-y-2">
              <TotalRow label="Subtotal" value={formatCurrency(subtotal)} />
              <TotalRow label="Tax (10%)" value={formatCurrency(tax)} />
              {discount > 0 && (
                <TotalRow
                  label="Discount"
                  value={`-${formatCurrency(discount)}`}
                  valueClass="text-emerald-500"
                />
              )}
              <div className="flex justify-between text-sm font-bold pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-slate-900 dark:text-white">Grand Total</span>
                <span className="text-slate-900 dark:text-white">{formatCurrency(grandTotal)}</span>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={clearCart}
                  variant="outline"
                  className="flex-1 border-red-200 text-red-500 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20 text-sm"
                >
                  Clear
                </Button>
                <Button
                  onClick={() => alert("Order placed! (Demo)")}
                  className="flex-1 bg-violet-600 hover:bg-violet-700 text-white text-sm"
                >
                  Place Order
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add-on Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add to Cart">
        {currentProduct && (
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="relative w-24 h-24 flex-shrink-0 bg-slate-100 dark:bg-slate-700 rounded-xl overflow-hidden">
                <Image
                  src={currentProduct.image || PLACEHOLDER_IMG}
                  alt={currentProduct.name}
                  fill
                  sizes="96px"
                  className="object-cover"
                  unoptimized
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = PLACEHOLDER_IMG;
                  }}
                />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">{currentProduct.name}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  {currentProduct.description}
                </p>
                <p className="text-lg font-bold text-violet-600 dark:text-violet-400 mt-1">
                  {formatCurrency(currentProduct.price)}
                </p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Quantity
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-lg font-bold w-10 text-center text-slate-900 dark:text-white">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Add-ons
              </label>
              <div className="space-y-2">
                {AVAILABLE_ADDONS.map((addon) => (
                  <label key={addon.id} className="flex items-center gap-2.5 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedAddons.some((a) => a.id === addon.id)}
                      onChange={(e) => {
                        setSelectedAddons(
                          e.target.checked
                            ? [...selectedAddons, addon]
                            : selectedAddons.filter((a) => a.id !== addon.id)
                        );
                      }}
                      className="accent-violet-600 w-4 h-4"
                    />
                    <span className="text-slate-700 dark:text-slate-300">
                      {addon.name}
                      <span className="text-slate-400 dark:text-slate-500 ml-1">
                        (+{formatCurrency(addon.price)})
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <Button
              onClick={handleAddToCart}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold"
            >
              Add to Cart —{" "}
              {formatCurrency(
                (currentProduct.price + selectedAddons.reduce((s, a) => s + a.price, 0)) * quantity
              )}
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}

// Helpers
function CategoryPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
        active
          ? "bg-violet-600 text-white"
          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
      }`}
    >
      {label}
    </button>
  );
}

function TotalRow({
  label,
  value,
  valueClass = "text-slate-900 dark:text-white",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`font-semibold ${valueClass}`}>{value}</span>
    </div>
  );
}