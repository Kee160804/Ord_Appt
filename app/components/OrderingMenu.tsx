"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  Minus,
  Plus,
  ShoppingBag,
  ShoppingCart,
  Trash2,
  Eye,
} from "lucide-react";
import { Button } from "@/app/components/Button";
import { Modal } from "@/app/components/Modal";
import { Input, Select } from "@/app/components/input";
import { formatCurrency } from "@/app/lib/utils";
import { isSupabaseConfigured } from "@/app/lib/supabase/config";
import { createPublicOrder } from "@/app/services/orderService";
import { validatePromotion } from "@/app/services/businessToolsService";
import { Product, Tenant } from "@/app/types/index";

interface CartItem {
  id: string;
  variantId?: string;
  name: string;
  price: number;
  quantity: number;
  addons: { id: string; name: string; price: number }[];
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
  onOrderPlaced?: (items: { productId: string; quantity: number }[]) => void;
  viewOnly?: boolean;
}

const PLACEHOLDER_IMG = "/fallback-product.png";

export function OrderingMenu({
  tenant,
  products,
  categories,
  onAddToCart,
  cart,
  updateCart,
  onOrderPlaced,
  viewOnly = false,
}: OrderingMenuProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState<AddonOption[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [orderType, setOrderType] = useState("dine_in");
  const [requestedTime, setRequestedTime] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryArea, setDeliveryArea] = useState("");
  const [deliveryInstructions, setDeliveryInstructions] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"pay_later" | "mock_card">(
    "pay_later",
  );
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [orderConfirmation, setOrderConfirmation] = useState("");
  const [checkoutActionsVisible, setCheckoutActionsVisible] = useState(false);
  const [promotionCode, setPromotionCode] = useState("");
  const [appliedPromotion, setAppliedPromotion] = useState<{
    code: string;
    name: string;
    discountAmount: number;
  } | null>(null);
  const [isApplyingPromotion, setIsApplyingPromotion] = useState(false);
  const orderSummaryRef = useRef<HTMLDivElement>(null);
  const checkoutActionsRef = useRef<HTMLDivElement>(null);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCat = selectedCategory
        ? p.categoryId === selectedCategory
        : true;
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description ?? "").toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  const productGroups = useMemo(() => {
    if (filteredProducts.length === 0) return [];
    if (selectedCategory) {
      const category = categories.find(
        (candidate) => candidate.id === selectedCategory,
      );
      return [
        {
          id: selectedCategory,
          name: category?.name ?? "Items",
          products: filteredProducts,
        },
      ];
    }

    const groups = categories
      .map((category) => ({
        id: category.id,
        name: category.name,
        products: filteredProducts.filter(
          (product) => product.categoryId === category.id,
        ),
      }))
      .filter((group) => group.products.length > 0);
    const uncategorized = filteredProducts.filter(
      (product) =>
        !categories.some((category) => category.id === product.categoryId),
    );
    if (uncategorized.length > 0) {
      groups.push({
        id: "uncategorized",
        name: "Other Items",
        products: uncategorized,
      });
    }
    return groups;
  }, [categories, filteredProducts, selectedCategory]);

  const isSoldOut = (product: Product) =>
    product.trackInventory !== false && (product.inventory ?? 0) <= 0;

  const reachedStockLimit = (product: Product, cartQuantity: number) =>
    product.trackInventory !== false &&
    cartQuantity >= (product.inventory ?? 0);

  const orderingSettings = tenant.orderingSettings ?? {
    enabled: true,
    paused: false,
    orderTypes: ["dine_in", "pickup", "delivery"] as Array<
      "dine_in" | "pickup" | "delivery"
    >,
    taxRate: 10,
    discountEnabled: true,
    discountThreshold: 100,
    discountRate: 5,
    minimumOrder: 0,
    deliveryFee: 0,
    deliveryAreas: [] as string[],
    preparationMinutes: 30,
  };
  const subtotal = cart.reduce((sum, i) => {
    return (
      sum +
      i.price * i.quantity +
      i.addons.reduce((a, ad) => a + ad.price * i.quantity, 0)
    );
  }, 0);
  const tax = subtotal * (orderingSettings.taxRate / 100);
  const discount =
    orderingSettings.discountEnabled &&
    subtotal >= orderingSettings.discountThreshold
      ? subtotal * (orderingSettings.discountRate / 100)
      : 0;
  const deliveryFee =
    orderType === "delivery" ? orderingSettings.deliveryFee : 0;
  const promotionDiscount = Math.min(
    appliedPromotion?.discountAmount ?? 0,
    subtotal + tax - discount + deliveryFee,
  );
  const grandTotal =
    subtotal + tax - discount + deliveryFee - promotionDiscount;
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    setAppliedPromotion(null);
  }, [subtotal]);
  useEffect(() => {
    if (
      !orderingSettings.orderTypes.includes(
        orderType as "dine_in" | "pickup" | "delivery",
      )
    ) {
      setOrderType(orderingSettings.orderTypes[0] ?? "pickup");
    }
  }, [orderType, orderingSettings.orderTypes]);

  const applyPromotion = async () => {
    if (!promotionCode.trim() || cart.length === 0) return;
    setIsApplyingPromotion(true);
    setOrderError("");
    try {
      const validated = await validatePromotion(
        tenant.id,
        promotionCode,
        subtotal,
        cart.map((item) => item.id),
      );
      const eligibleAmount = validated.applicableProductIds.length
        ? cart
            .filter((item) => validated.applicableProductIds.includes(item.id))
            .reduce(
              (sum, item) =>
                sum +
                item.price * item.quantity +
                item.addons.reduce(
                  (addonSum, addon) => addonSum + addon.price * item.quantity,
                  0,
                ),
              0,
            )
        : subtotal;
      const discountAmount = Math.min(
        eligibleAmount,
        validated.discountType === "PERCENTAGE"
          ? (eligibleAmount * validated.discountValue) / 100
          : validated.discountValue,
      );
      setAppliedPromotion({
        code: validated.code,
        name: validated.name,
        discountAmount,
      });
    } catch (promotionError) {
      setAppliedPromotion(null);
      setOrderError(
        promotionError instanceof Error
          ? promotionError.message
          : "That discount code is not valid.",
      );
    } finally {
      setIsApplyingPromotion(false);
    }
  };

  useEffect(() => {
    const actions = checkoutActionsRef.current;
    if (!actions || typeof IntersectionObserver === "undefined") {
      setCheckoutActionsVisible(false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setCheckoutActionsVisible(entry.isIntersecting),
      { threshold: 0.35 },
    );
    observer.observe(actions);
    return () => observer.disconnect();
  }, [cart.length]);

  const scrollToOrderSummary = () => {
    const summary = orderSummaryRef.current;
    if (!summary) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    summary.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
    window.setTimeout(
      () => summary.focus({ preventScroll: true }),
      reduceMotion ? 0 : 450,
    );
  };

  const openAddModal = (product: Product) => {
    if (isSoldOut(product)) return;
    setCurrentProduct(product);
    setQuantity(1);
    setSelectedAddons([]);
    setSelectedVariantId(
      product.variants?.find((variant) => variant.isActive && variant.stock > 0)
        ?.id ?? "",
    );
    setModalOpen(true);
  };

  const handleAddToCart = () => {
    if (!currentProduct) return;
    const selectedVariant = currentProduct.variants?.find(
      (variant) => variant.id === selectedVariantId,
    );
    if (currentProduct.variants?.length && !selectedVariant) {
      setOrderError("Choose an available product variant.");
      return;
    }
    const existingQuantity =
      cart.find(
        (item) =>
          item.id === currentProduct.id && item.variantId === selectedVariantId,
      )?.quantity ?? 0;
    const availableStock =
      selectedVariant?.stock ?? currentProduct.inventory ?? 0;
    if (
      (selectedVariant || currentProduct.trackInventory !== false) &&
      existingQuantity + quantity > availableStock
    ) {
      setOrderError(`Only ${availableStock} ${currentProduct.name} available.`);
      return;
    }
    onAddToCart({
      id: currentProduct.id,
      variantId: selectedVariant?.id,
      name: currentProduct.name,
      price: selectedVariant?.price ?? currentProduct.price,
      quantity,
      addons: selectedAddons.map(({ id, name, price }) => ({
        id,
        name,
        price,
      })),
      image: currentProduct.image,
    });
    setModalOpen(false);
  };

  const updateQty = (id: string, delta: number) => {
    const product = products.find((candidate) => candidate.id === id);
    updateCart(
      cart
        .map((i) => {
          if (i.id !== id) return i;
          const requested = Math.max(0, i.quantity + delta);
          const maximum =
            product && product.trackInventory !== false
              ? (product.inventory ?? 0)
              : 99;
          return { ...i, quantity: Math.min(requested, maximum) };
        })
        .filter((i) => i.quantity > 0),
    );
  };

  const removeItem = (id: string) =>
    updateCart(cart.filter((i) => i.id !== id));

  // ✅ ADDED CONFIRMATION
  const clearCart = () => {
    if (window.confirm("Are you sure you want to clear your entire order?")) {
      updateCart([]);
    }
  };

  const placeOrder = async () => {
    if (viewOnly) {
      setOrderError("This is a view-only demo. No order was submitted.");
      return;
    }
    if (cart.length === 0) {
      setOrderError("Your cart is empty.");
      return;
    }
    if (!customerName.trim() || !customerEmail.trim() || !phoneNumber.trim()) {
      setOrderError("Name, email address, and phone number are required.");
      return;
    }
    if (!orderingSettings.enabled || orderingSettings.paused) {
      setOrderError("Online ordering is temporarily unavailable.");
      return;
    }
    if (subtotal < orderingSettings.minimumOrder) {
      setOrderError(
        `The minimum order is ${formatCurrency(orderingSettings.minimumOrder)}.`,
      );
      return;
    }
    if (orderType === "dine_in" && !tableNumber.trim()) {
      setOrderError("Enter your table number for dine-in service.");
      return;
    }
    if (orderType === "pickup" && !requestedTime) {
      setOrderError("Choose a pickup time.");
      return;
    }
    if (
      orderType === "delivery" &&
      (!deliveryAddress.trim() || !deliveryArea.trim())
    ) {
      setOrderError("Delivery address and area are required.");
      return;
    }
    if (!isSupabaseConfigured()) {
      setOrderError("Online ordering is not configured.");
      return;
    }

    setIsPlacingOrder(true);
    setOrderError("");
    setOrderConfirmation("");
    try {
      const result = await createPublicOrder({
        tenantId: tenant.id,
        customerName,
        customerEmail,
        customerPhone: phoneNumber,
        orderType: orderType as "dine_in" | "pickup" | "delivery",
        items: cart.map((item) => ({
          productId: item.id,
          quantity: item.quantity,
          addons: item.addons,
          variantId: item.variantId,
        })),
        promotionCode: appliedPromotion?.code,
        requestedTime: requestedTime
          ? new Date(requestedTime).toISOString()
          : undefined,
        deliveryAddress,
        deliveryArea,
        deliveryInstructions,
        tableNumber,
        notes: orderNotes,
        paymentMethod,
      });
      const paymentMessage =
        result.paymentStatus === "paid"
          ? ` Mock payment ${result.paymentReference ?? ""} was approved.`
          : " Payment is due at the business or on delivery.";
      setOrderConfirmation(
        `Order ${result.orderNumber} was placed successfully.${paymentMessage}`,
      );
      onOrderPlaced?.(
        cart.map((item) => ({ productId: item.id, quantity: item.quantity })),
      );
      updateCart([]);
      setCustomerName("");
      setCustomerEmail("");
      setPhoneNumber("");
      setOrderType(orderingSettings.orderTypes[0] ?? "pickup");
      setRequestedTime("");
      setDeliveryAddress("");
      setDeliveryArea("");
      setDeliveryInstructions("");
      setTableNumber("");
      setOrderNotes("");
      setPaymentMethod("pay_later");
      setPromotionCode("");
      setAppliedPromotion(null);
    } catch (placeError) {
      setOrderError(
        placeError instanceof Error
          ? placeError.message
          : "Unable to place order.",
      );
    } finally {
      setIsPlacingOrder(false);
    }
  };

  return (
    <>
      <div className="grid min-h-[calc(100dvh-260px)] min-w-0 grid-cols-1 gap-0 overflow-hidden rounded-2xl border border-slate-200 shadow-sm dark:border-slate-700 xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
        {/* LEFT: Menu */}
        <div className="min-w-0 bg-white p-4 dark:bg-slate-900 sm:p-6 xl:overflow-y-auto">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Menu for {tenant.name}
            </h2>
            <div className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800 sm:w-52">
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

          <div className="space-y-8">
            {filteredProducts.length === 0 && (
              <div className="py-16 text-center text-slate-400 dark:text-slate-500">
                <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No items found.</p>
              </div>
            )}
            {productGroups.map((group) => (
              <section key={group.id}>
                <div className="mb-3 flex items-center gap-3">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {group.name}
                  </h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    {group.products.length}
                  </span>
                  <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {group.products.map((product) => {
                    const cartItem = cart.find((i) => i.id === product.id);
                    const soldOut = isSoldOut(product);
                    const stockLimitReached = reachedStockLimit(
                      product,
                      cartItem?.quantity ?? 0,
                    );
                    return (
                      <div
                        key={product.id}
                        className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden transition group ${soldOut ? "opacity-75" : "hover:shadow-md"}`}
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
                              (e.target as HTMLImageElement).src =
                                PLACEHOLDER_IMG;
                            }}
                          />
                          <span className="absolute top-2 left-2 bg-white/90 dark:bg-slate-900/90 text-violet-600 dark:text-violet-400 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                            {categories.find((c) => c.id === product.categoryId)
                              ?.name ?? "Item"}
                          </span>
                          {soldOut && (
                            <span className="absolute inset-0 flex items-center justify-center bg-slate-950/55 text-sm font-bold uppercase tracking-wider text-white">
                              Sold Out
                            </span>
                          )}
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
                                onClick={() =>
                                  cartItem && updateQty(product.id, -1)
                                }
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
                                  cartItem
                                    ? updateQty(product.id, 1)
                                    : openAddModal(product)
                                }
                                disabled={soldOut || stockLimitReached}
                                className="w-5 h-5 rounded-full border border-slate-200 dark:border-slate-600 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-30 transition"
                                aria-label="Increase quantity"
                              >
                                <Plus className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>
                          <button
                            onClick={() => openAddModal(product)}
                            disabled={soldOut || stockLimitReached}
                            className="mt-2.5 w-full py-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-violet-600 hover:text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 dark:disabled:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition"
                          >
                            {soldOut
                              ? "Sold Out"
                              : stockLimitReached
                                ? "Stock limit reached"
                                : "Add to cart"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>

        {/* RIGHT: Order Summary */}
        <div
          ref={orderSummaryRef}
          id="order-summary"
          tabIndex={-1}
          className="scroll-mt-36 flex min-w-0 flex-col overflow-hidden border-t border-slate-200 bg-white outline-none dark:border-slate-700 dark:bg-slate-900 xl:border-l xl:border-t-0"
        >
          <div className="flex-1 space-y-5 p-4 sm:p-5 xl:overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Order Summary
              </h3>
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
                label="Email Address"
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
              <Input
                label="Phone Number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Enter Phone Number"
              />
              <Select
                label="Order Type"
                options={orderingSettings.orderTypes.map((value) => ({
                  value,
                  label:
                    value === "dine_in"
                      ? "Dine In"
                      : value === "pickup"
                        ? "Pickup"
                        : "Delivery",
                }))}
                value={orderType}
                onChange={(e) => setOrderType(e.target.value)}
              />
              {orderType === "dine_in" && (
                <Input
                  label="Table Number"
                  value={tableNumber}
                  onChange={(event) => setTableNumber(event.target.value)}
                  placeholder="e.g. 12"
                />
              )}
              {orderType === "pickup" && (
                <Input
                  label={`Pickup Time (allow ${orderingSettings.preparationMinutes} min)`}
                  type="datetime-local"
                  value={requestedTime}
                  onChange={(event) => setRequestedTime(event.target.value)}
                />
              )}
              {orderType === "delivery" && (
                <>
                  <Input
                    label="Delivery Address"
                    value={deliveryAddress}
                    onChange={(event) => setDeliveryAddress(event.target.value)}
                    placeholder="Street, building, and landmark"
                  />
                  {orderingSettings.deliveryAreas.length ? (
                    <Select
                      label="Delivery Area"
                      value={deliveryArea}
                      onChange={(event) => setDeliveryArea(event.target.value)}
                      options={[
                        { value: "", label: "Choose an area" },
                        ...orderingSettings.deliveryAreas.map((area) => ({
                          value: area,
                          label: area,
                        })),
                      ]}
                    />
                  ) : (
                    <Input
                      label="Delivery Area"
                      value={deliveryArea}
                      onChange={(event) => setDeliveryArea(event.target.value)}
                      placeholder="City, village, or neighbourhood"
                    />
                  )}
                  <Input
                    label="Delivery Instructions (optional)"
                    value={deliveryInstructions}
                    onChange={(event) =>
                      setDeliveryInstructions(event.target.value)
                    }
                    placeholder="Gate, floor, or directions"
                  />
                </>
              )}
              <Input
                label="Order Notes (optional)"
                value={orderNotes}
                onChange={(event) => setOrderNotes(event.target.value)}
                placeholder="Allergies or special requests"
              />
              <Select
                label="Payment"
                value={paymentMethod}
                onChange={(event) =>
                  setPaymentMethod(
                    event.target.value as "pay_later" | "mock_card",
                  )
                }
                options={[
                  {
                    value: "pay_later",
                    label: "Pay at business / on delivery",
                  },
                  {
                    value: "mock_card",
                    label: "Mock card payment (testing only)",
                  },
                ]}
              />
              {paymentMethod === "mock_card" && (
                <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[10px] text-amber-300 light:text-amber-700">
                  Test mode: no card details or real money are used. The ledger
                  records a simulated approved payment.
                </p>
              )}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Discount Code
                </label>
                <div className="flex gap-2">
                  <input
                    value={promotionCode}
                    onChange={(event) => {
                      setPromotionCode(
                        event.target.value.toUpperCase().replace(/\s/g, ""),
                      );
                      setAppliedPromotion(null);
                    }}
                    placeholder="WELCOME10"
                    className="min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-700/50 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500 light:border-[#dfe5ee] light:bg-white light:text-slate-900"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    loading={isApplyingPromotion}
                    onClick={() => void applyPromotion()}
                  >
                    Apply
                  </Button>
                </div>
                {appliedPromotion && (
                  <p className="mt-1 text-[10px] text-emerald-500">
                    {appliedPromotion.name} applied
                  </p>
                )}
              </div>
            </div>

            {orderError && <p className="text-xs text-red-500">{orderError}</p>}
            {orderConfirmation && (
              <p className="text-xs text-emerald-600">{orderConfirmation}</p>
            )}

            <div className="h-px bg-slate-100 dark:bg-slate-800" />

            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                Order Items
              </span>
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
                    0,
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
                            (e.target as HTMLImageElement).src =
                              PLACEHOLDER_IMG;
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
            <div
              ref={checkoutActionsRef}
              className="flex-shrink-0 border-t border-slate-100 dark:border-slate-800 p-5 space-y-2"
            >
              <TotalRow label="Subtotal" value={formatCurrency(subtotal)} />
              <TotalRow
                label={`Tax (${orderingSettings.taxRate}%)`}
                value={formatCurrency(tax)}
              />
              {deliveryFee > 0 && (
                <TotalRow
                  label="Delivery fee"
                  value={formatCurrency(deliveryFee)}
                />
              )}
              {discount > 0 && (
                <TotalRow
                  label="Discount"
                  value={`-${formatCurrency(discount)}`}
                  valueClass="text-emerald-500"
                />
              )}
              {promotionDiscount > 0 && (
                <TotalRow
                  label={`Code ${appliedPromotion?.code}`}
                  value={`-${formatCurrency(promotionDiscount)}`}
                  valueClass="text-emerald-500"
                />
              )}
              <div className="flex justify-between text-sm font-bold pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-slate-900 dark:text-white">
                  Grand Total
                </span>
                <span className="text-slate-900 dark:text-white">
                  {formatCurrency(grandTotal)}
                </span>
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
                  onClick={placeOrder}
                  disabled={
                    isPlacingOrder ||
                    viewOnly ||
                    !orderingSettings.enabled ||
                    orderingSettings.paused
                  }
                  className="flex-1 bg-violet-600 hover:bg-violet-700 text-white text-sm"
                >
                  {viewOnly
                    ? "Demo Preview"
                    : orderingSettings.paused
                      ? "Ordering Paused"
                      : isPlacingOrder
                        ? "Placing..."
                        : "Place Order"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {!checkoutActionsVisible && (
        <button
          type="button"
          onClick={scrollToOrderSummary}
          data-testid="floating-cart"
          aria-label={`View cart with ${itemCount} ${itemCount === 1 ? "item" : "items"}, total ${formatCurrency(grandTotal)}`}
          title={`View cart · ${formatCurrency(grandTotal)}`}
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+1.25rem)] right-[max(1.25rem,env(safe-area-inset-right))] z-40 flex h-16 w-16 items-center justify-center rounded-full border border-violet-300/30 bg-violet-600 text-white shadow-[0_14px_34px_rgba(109,40,217,0.5)] transition hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-400/35 active:scale-95 xl:hidden"
        >
          <ShoppingCart className="h-6 w-6" strokeWidth={2.25} />
          <span className="absolute right-0 top-0 flex min-h-6 min-w-6 translate-x-1/4 -translate-y-1/4 items-center justify-center rounded-full border-2 border-violet-600 bg-white px-1 text-[10px] font-black leading-none text-violet-700 shadow-sm">
            {itemCount > 99 ? "99+" : itemCount}
          </span>
        </button>
      )}

      {/* Add-on Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add to Cart"
      >
        {currentProduct && (
          <div className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row">
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
                <h3 className="font-bold text-slate-900 dark:text-white">
                  {currentProduct.name}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  {currentProduct.description}
                </p>
                <p className="text-lg font-bold text-violet-600 dark:text-violet-400 mt-1">
                  {formatCurrency(currentProduct.price)}
                </p>
              </div>
            </div>
            <div>
              {currentProduct.variants &&
                currentProduct.variants.length > 0 && (
                  <div className="mb-4">
                    <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Choose an option
                    </label>
                    <select
                      value={selectedVariantId}
                      onChange={(event) =>
                        setSelectedVariantId(event.target.value)
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="">Select size, color, or style...</option>
                      {currentProduct.variants.map((variant) => (
                        <option
                          key={variant.id}
                          value={variant.id}
                          disabled={!variant.isActive || variant.stock < 1}
                        >
                          {Object.entries(variant.attributes)
                            .map(([key, value]) => `${key}: ${value}`)
                            .join(" · ")}{" "}
                          · {variant.stock} available
                        </option>
                      ))}
                    </select>
                  </div>
                )}
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
                    disabled={
                      currentProduct.trackInventory !== false &&
                      quantity +
                        (cart.find((item) => item.id === currentProduct.id)
                          ?.quantity ?? 0) >=
                        (currentProduct.inventory ?? 0)
                    }
                    className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-30 transition"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Add-ons
              </label>
              <div className="space-y-2">
                {(currentProduct.addons ?? []).map((addon) => (
                  <label
                    key={addon.id}
                    className="flex items-center gap-2.5 text-sm cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedAddons.some((a) => a.id === addon.id)}
                      onChange={(e) => {
                        setSelectedAddons(
                          e.target.checked
                            ? [...selectedAddons, addon]
                            : selectedAddons.filter((a) => a.id !== addon.id),
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
                (currentProduct.price +
                  (currentProduct.variants?.find(
                    (variant) => variant.id === selectedVariantId,
                  )?.price ?? 0) -
                  (currentProduct.variants?.length ? currentProduct.price : 0) +
                  selectedAddons.reduce((s, a) => s + a.price, 0)) *
                  quantity,
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
