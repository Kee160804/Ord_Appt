"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowRight,
  Heart,
  LockKeyhole,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Trash2,
  UserRound,
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
  onOpenGallery?: () => void;
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
  onOpenGallery,
}: OrderingMenuProps) {
  const isRetail = tenant.businessType === "retail";
  const catalogLabel = isRetail ? "Products & Retail" : "Food & Drinks";
  const itemLabel = isRetail ? "products" : "foods";
  const addLabel = isRetail ? "Add to bag" : "Add to cart";
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

  // Search and category selection are combined before the catalog is grouped.
  // Memoizing both steps avoids rebuilding every card after unrelated form edits.
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

  // Products that do not track inventory remain orderable without a stock cap.
  const isSoldOut = (product: Product) =>
    product.trackInventory !== false && (product.inventory ?? 0) <= 0;

  const reachedStockLimit = (product: Product, cartQuantity: number) =>
    product.trackInventory !== false &&
    cartQuantity >= (product.inventory ?? 0);

  // Older tenants may not have ordering settings yet, so these defaults keep
  // their storefront usable while matching the current checkout contract.
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
  // All totals are derived from cart state. Nothing is stored separately,
  // preventing displayed prices from drifting away from submitted prices.
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

  // A promotion must be revalidated whenever the cart value changes.
  useEffect(() => {
    setAppliedPromotion(null);
  }, [subtotal]);
  // Keep the selected order type valid when a business changes its settings.
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

  // The floating mobile cart is only needed while the checkout action is out
  // of view; IntersectionObserver avoids scroll-event bookkeeping.
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

  // The modal owns temporary variant, add-on, and quantity selections. The cart
  // is updated only after the customer confirms the complete configuration.
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

  // Clearing the full cart is the only quantity action that requires confirmation.
  const clearCart = () => {
    if (window.confirm("Are you sure you want to clear your entire order?")) {
      updateCart([]);
    }
  };

  // Validate the complete checkout locally before calling the public order API.
  // Server-side validation remains authoritative inside createPublicOrder.
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
      <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(390px,500px)] xl:items-start">
        {/* LEFT: Menu */}
        <div className="min-w-0">
          <span
            onClick={onOpenGallery}
            onKeyDown={(event) => {
              if (
                (event.key === "Enter" || event.key === " ") &&
                onOpenGallery
              ) {
                event.preventDefault();
                onOpenGallery();
              }
            }}
            role="button"
            tabIndex={0}
            className="group relative mb-6 block h-52 w-full overflow-hidden rounded-2xl border border-[#26344a] bg-[#10192a] text-left shadow-[0_20px_70px_rgba(0,0,0,0.2)] sm:h-56 light:border-slate-200 light:bg-white"
            aria-label={`View ${tenant.name} gallery`}
          >
            <Image
              src={tenant.coverImage || PLACEHOLDER_IMG}
              alt={tenant.name}
              fill
              sizes="(max-width: 1280px) 100vw, 900px"
              className="object-cover transition duration-500 group-hover:scale-[1.02]"
              priority
              unoptimized
              onError={(event) => {
                (event.target as HTMLImageElement).src = PLACEHOLDER_IMG;
              }}
            />
            <span className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,10,20,0.97)_0%,rgba(7,11,24,0.84)_43%,rgba(18,10,44,0.32)_72%,rgba(18,8,42,0.12)_100%)]" />
            <span className="absolute inset-y-0 left-0 flex max-w-[78%] flex-col justify-center px-6 sm:px-9">
              <span className="text-3xl font-black leading-[1.08] tracking-[-0.035em] text-white sm:text-4xl">
                {isRetail ? "Fresh Styles" : "Great Taste"}
                <br />
                {isRetail ? (
                  <>
                    For <span className="text-violet-500">Every You</span>
                  </>
                ) : (
                  <>
                    <span className="text-violet-500">Every Day</span>
                  </>
                )}
              </span>
              <span className="mt-3 max-w-sm text-xs leading-5 text-[#c2cce0] sm:text-sm">
                {tenant.description}
              </span>
            </span>
          </span>
          <div className="mb-4 flex items-center gap-3">
            <h2 className="sr-only">
              {catalogLabel} for {tenant.name}
            </h2>
            <div className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-xl border border-[#2b3b55] bg-[#111d30] px-4 text-[#8fa0bb] shadow-inner light:border-slate-200 light:bg-white light:text-slate-500">
              <Search className="h-4 w-4 shrink-0" />
              <input
                type="search"
                placeholder={`Search ${isRetail ? "clothing, sneakers, and accessories" : itemLabel}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#7d8ca5] light:text-slate-950 light:placeholder:text-slate-400"
                aria-label={`Search ${itemLabel}`}
              />
            </div>
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#2b3b55] bg-[#111d30] text-[#aebbd0] transition hover:border-violet-500 hover:text-white light:border-slate-200 light:bg-white light:text-slate-600"
              aria-hidden="true"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </span>
          </div>

          <div className="no-scrollbar mb-6 flex gap-2 overflow-x-auto pb-1">
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
              <div className="rounded-2xl border border-dashed border-[#2b3b55] py-16 text-center text-[#7d8ca5] light:border-slate-300 light:text-slate-500">
                <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No items found.</p>
              </div>
            )}
            {productGroups.map((group) => (
              <section key={group.id}>
                <div className="mb-4 flex items-center gap-3">
                  <h3 className="text-lg font-black text-white light:text-slate-950">
                    {group.name}
                  </h3>
                  <span className="rounded-full bg-[#172238] px-2.5 py-1 text-[10px] font-bold text-[#9cadc6] light:bg-slate-200 light:text-slate-600">
                    {group.products.length}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedCategory(
                        group.id === "uncategorized" ? null : group.id,
                      )
                    }
                    className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold text-violet-400 transition hover:text-violet-300"
                  >
                    View all <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                  {group.products.map((product) => {
                    const cartItem = cart.find((i) => i.id === product.id);
                    const soldOut = isSoldOut(product);
                    const stockLimitReached = reachedStockLimit(
                      product,
                      cartItem?.quantity ?? 0,
                    );
                    return (
                      <article
                        key={product.id}
                        className={`group overflow-hidden rounded-xl border border-[#26364f] bg-[#101b2d] shadow-[0_12px_36px_rgba(0,0,0,0.16)] transition light:border-slate-200 light:bg-white ${soldOut ? "opacity-70" : "hover:-translate-y-0.5 hover:border-violet-500/50"}`}
                      >
                        <div className="relative h-44 w-full overflow-hidden bg-[#172238] light:bg-slate-100">
                          <Image
                            src={product.image || PLACEHOLDER_IMG}
                            alt={product.name}
                            fill
                            sizes="(max-width: 768px) 100vw, 50vw"
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                            unoptimized
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                PLACEHOLDER_IMG;
                            }}
                          />
                          <span
                            className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-white/25 bg-black/20 text-white backdrop-blur-md transition hover:bg-violet-600"
                            aria-hidden="true"
                          >
                            <Heart className="h-4 w-4" />
                          </span>
                          {soldOut && (
                            <span className="absolute inset-0 flex items-center justify-center bg-slate-950/55 text-sm font-bold uppercase tracking-wider text-white">
                              Sold Out
                            </span>
                          )}
                        </div>
                        <div className="p-3">
                          <h3 className="truncate text-sm font-bold text-white light:text-slate-950">
                            {product.name}
                          </h3>
                          <p className="mt-1 line-clamp-1 text-[11px] text-[#91a1ba] light:text-slate-500">
                            {product.description}
                          </p>
                          <div className="mt-3 flex items-center justify-between">
                            <span className="text-sm font-black text-white light:text-slate-950">
                              {formatCurrency(product.price)}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() =>
                                  cartItem && updateQty(product.id, -1)
                                }
                                disabled={!cartItem}
                                className="flex h-7 w-8 items-center justify-center rounded-full bg-[#1a2840] text-[#aab8cc] transition hover:bg-[#243550] disabled:opacity-35 light:bg-slate-100 light:text-slate-600"
                                aria-label={`Decrease ${product.name} quantity`}
                              >
                                <Minus className="w-2.5 h-2.5" />
                              </button>
                              <span className="w-4 text-center text-xs font-bold text-white light:text-slate-800">
                                {cartItem?.quantity ?? 0}
                              </span>
                              <button
                                onClick={() =>
                                  cartItem
                                    ? updateQty(product.id, 1)
                                    : openAddModal(product)
                                }
                                disabled={soldOut || stockLimitReached}
                                className="flex h-7 w-8 items-center justify-center rounded-full bg-[#1a2840] text-[#aab8cc] transition hover:bg-[#243550] disabled:cursor-not-allowed disabled:opacity-35 light:bg-slate-100 light:text-slate-600"
                                aria-label={`Increase ${product.name} quantity`}
                              >
                                <Plus className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>
                          <button
                            onClick={() => openAddModal(product)}
                            disabled={soldOut || stockLimitReached}
                            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-700 to-violet-600 px-3 py-2.5 text-xs font-bold text-white shadow-[0_8px_20px_rgba(109,40,217,0.24)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400"
                          >
                            <ShoppingCart className="h-3.5 w-3.5" />
                            {soldOut
                              ? "Sold Out"
                              : stockLimitReached
                                ? "Stock limit reached"
                                : addLabel}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>

        {/* RIGHT: Order Summary */}
        <aside
          ref={orderSummaryRef}
          id="order-summary"
          tabIndex={-1}
          className="scroll-mt-24 flex min-w-0 flex-col rounded-2xl border border-[#26364f] bg-[#0d1829] p-5 outline-none shadow-[0_20px_70px_rgba(0,0,0,0.22)] sm:p-6 light:border-slate-200 light:bg-white xl:sticky xl:top-24"
        >
          <div className="contents">
            <div className="order-1 flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#273852] bg-[#142138] text-white light:border-slate-200 light:bg-slate-100 light:text-slate-700">
                <ShoppingCart className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-black text-white light:text-slate-950">
                    Order Summary
                  </h3>
                  {itemCount > 0 && (
                    <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-violet-600 px-1.5 text-[11px] font-black text-white">
                      {itemCount}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-[#90a2bd] light:text-slate-500">
                  Review your items and complete your order.
                </p>
              </div>
            </div>

            <div className="order-5 mt-5 space-y-3 border-t border-[#26364f] pt-5 light:border-slate-200">
              <div className="mb-4 flex items-start gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#142138] text-[#b8c5da] light:bg-slate-100 light:text-slate-600">
                  <UserRound className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-base font-black text-white light:text-slate-950">
                    Customer Information
                  </h3>
                  <p className="mt-0.5 text-xs text-[#90a2bd] light:text-slate-500">
                    Tell us where to send your order.
                  </p>
                </div>
              </div>
              <Input
                label="Full Name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter your name"
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

            {orderError && (
              <p className="order-6 mt-3 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-300 light:text-red-600">
                {orderError}
              </p>
            )}
            {orderConfirmation && (
              <p className="order-6 mt-3 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-300 light:text-emerald-700">
                {orderConfirmation}
              </p>
            )}

            <div className="hidden" />

            <div className="order-2 mt-5 flex items-center justify-between">
              <span className="sr-only">Order Items</span>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="ml-auto flex items-center gap-1 text-xs font-semibold text-red-400 transition hover:text-red-300"
                  aria-label="Clear all items"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="order-3 mt-3 rounded-xl border border-dashed border-[#2c3d57] py-9 text-center light:border-slate-300">
                <ShoppingBag className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Your cart is empty.
                  <br />
                  Add items from the menu.
                </p>
              </div>
            ) : (
              <div className="order-3 mt-3 space-y-3">
                {cart.map((item) => {
                  const addonsTotal = item.addons.reduce(
                    (a, ad) => a + ad.price * item.quantity,
                    0,
                  );
                  const lineTotal = item.price * item.quantity + addonsTotal;
                  return (
                    <div
                      key={item.id}
                      className="flex gap-3 rounded-xl border border-[#26364f] bg-[#111d30] p-3 light:border-slate-200 light:bg-slate-50"
                    >
                      <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-[#172238] light:bg-slate-100">
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
                          <p className="line-clamp-1 text-xs font-black leading-tight text-white light:text-slate-950">
                            {item.name}
                          </p>
                          <p className="shrink-0 text-xs font-black text-white light:text-slate-950">
                            {formatCurrency(lineTotal)}
                          </p>
                        </div>
                        <span className="mt-0.5 inline-block text-[10px] font-medium text-[#8798b2] light:text-slate-500">
                          Quantity {item.quantity}
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
            <div ref={checkoutActionsRef} className="contents">
              <div className="order-4 mt-5 space-y-2.5 border-y border-[#26364f] py-4 light:border-slate-200">
                <TotalRow label="Subtotal" value={formatCurrency(subtotal)} />
                <TotalRow
                  label={`Tax (${orderingSettings.taxRate}%)`}
                  value={formatCurrency(tax)}
                />
                {deliveryFee > 0 && (
                  <TotalRow
                    label="Delivery Fee"
                    value={formatCurrency(deliveryFee)}
                  />
                )}
                {discount > 0 && (
                  <TotalRow
                    label="Discount"
                    value={`-${formatCurrency(discount)}`}
                    valueClass="text-emerald-400"
                  />
                )}
                {promotionDiscount > 0 && (
                  <TotalRow
                    label={`Discount (${appliedPromotion?.code})`}
                    value={`-${formatCurrency(promotionDiscount)}`}
                    valueClass="text-emerald-400"
                  />
                )}
                <div className="flex items-center justify-between border-t border-[#26364f] pt-3 font-black light:border-slate-200">
                  <span className="text-white light:text-slate-950">Total</span>
                  <span className="text-xl text-white light:text-slate-950">
                    {formatCurrency(grandTotal)}
                  </span>
                </div>
              </div>

              <div className="order-7 mt-5">
                <Button
                  onClick={clearCart}
                  variant="outline"
                  className="hidden"
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
                  className="w-full rounded-xl bg-gradient-to-r from-violet-700 via-violet-600 to-purple-600 py-3.5 text-sm font-black text-white shadow-[0_12px_30px_rgba(109,40,217,0.3)] hover:brightness-110"
                >
                  <ShoppingCart className="h-5 w-5" />
                  {viewOnly
                    ? "Demo Preview"
                    : orderingSettings.paused
                      ? "Ordering Paused"
                      : isPlacingOrder
                        ? "Placing..."
                        : "Place Order"}
                </Button>
                <p className="mt-3 flex items-center justify-center gap-2 text-[10px] text-[#8292aa] light:text-slate-500">
                  <LockKeyhole className="h-3.5 w-3.5" /> Your information is
                  secure and encrypted.
                </p>
              </div>
            </div>
          )}
        </aside>
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
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-5 py-2.5 text-xs font-bold transition ${
        active
          ? "border-violet-500 bg-gradient-to-r from-violet-700 to-violet-600 text-white shadow-[0_8px_22px_rgba(109,40,217,0.28)]"
          : "border-[#1f2d43] bg-[#111b2c] text-[#c1ccdd] hover:border-[#354864] hover:bg-[#17243a] light:border-slate-200 light:bg-white light:text-slate-700 light:hover:bg-slate-50"
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
