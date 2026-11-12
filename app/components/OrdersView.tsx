"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  CheckSquare2,
  ChevronLeft,
  ChevronRight,
  PackageOpen,
  RefreshCw,
  Search,
  ShoppingBasket,
  ShoppingBag,
  Truck,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { StatusBadge } from "../components/Badge";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { getOrdersByTenant } from "../data/mock";
import { isSupabaseConfigured } from "../lib/supabase/config";
import { capitalise, cn, formatCurrency } from "../lib/utils";
import { listOrders, setOrderStatus } from "../services/orderService";
import type { Order, OrderStatus, Tenant } from "../types/index";

/**
 * Number of orders rendered at once.
 *
 * The service layer applies the same value to Supabase using `.range()`.
 */
const PAGE_SIZE = 25;

const BASE_STATUS_FLOW: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "delivered",
];

interface Props {
  tenant: Tenant;
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onTotalChange?: (total: number) => void;
}

const STATUS_ICON: Partial<Record<OrderStatus, LucideIcon>> = {
  pending: ShoppingBag,
  confirmed: CheckSquare2,
  preparing: PackageOpen,
  ready: ShoppingBasket,
  out_for_delivery: Truck,
  delivered: CheckCircle2,
};

interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

const EMPTY_PAGINATION: PaginationState = {
  page: 0,
  pageSize: PAGE_SIZE,
  total: 0,
  totalPages: 0,
  hasPreviousPage: false,
  hasNextPage: false,
};

const EMPTY_STATUS_COUNTS: Record<OrderStatus, number> = {
  pending: 0,
  confirmed: 0,
  preparing: 0,
  ready: 0,
  out_for_delivery: 0,
  delivered: 0,
  cancelled: 0,
};

function formatOrderDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "—", time: "" };
  return {
    date: new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    }).format(date),
    time: new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date),
  };
}

/**
 * Filters mock/demo orders locally.
 *
 * Production/Supabase filtering is intentionally handled by the service layer
 * so search and status filters operate across the complete tenant history,
 * rather than only the rows already loaded into the browser.
 */
function filterDemoOrders(
  tenantId: string,
  status: OrderStatus | "all",
  search: string,
): Order[] {
  const normalizedSearch = search.trim().toLowerCase();

  return getOrdersByTenant(tenantId).filter((order) => {
    if (status !== "all" && order.status !== status) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    return [
      order.orderNumber,
      order.customerName,
      order.customerEmail,
      order.customerPhone,
    ].some((value) => value?.toLowerCase().includes(normalizedSearch));
  });
}

export function OrdersView({
  tenant,
  searchInput,
  onSearchInputChange,
  onTotalChange,
}: Props) {
  const usesSupabase = isSupabaseConfigured();

  const statusFlow: OrderStatus[] =
    tenant.businessType === "retail"
      ? [...BASE_STATUS_FLOW.slice(0, -1), "out_for_delivery", "delivered"]
      : BASE_STATUS_FLOW;

  const statusTabs: OrderStatus[] = [...statusFlow, "cancelled"];

  const [orders, setOrders] = useState<Order[]>([]);
  const [selected, setSelected] = useState<Order | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const updateViewport = () => setIsMobileViewport(media.matches);
    updateViewport();
    media.addEventListener("change", updateViewport);
    return () => media.removeEventListener("change", updateViewport);
  }, []);

  useEffect(() => {
    if (!selected) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selected]);

  const [filter, setFilter] = useState<OrderStatus | "all">("all");

  /**
   * searchInput updates immediately while typing.
   * search is debounced before it is sent to Supabase.
   */
  const [search, setSearch] = useState("");

  const [page, setPage] = useState(0);
  const [pagination, setPagination] =
    useState<PaginationState>(EMPTY_PAGINATION);
  const [allOrderTotal, setAllOrderTotal] = useState(0);
  const [statusCounts, setStatusCounts] =
    useState<Record<OrderStatus, number>>(EMPTY_STATUS_COUNTS);

  const [isLoading, setIsLoading] = useState(usesSupabase);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  /**
   * Avoid sending one Supabase query for every keystroke.
   */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  /**
   * Reset to the first page whenever the status filter changes.
   */
  const changeFilter = (nextFilter: OrderStatus | "all") => {
    setFilter(nextFilter);
    setPage(0);
    setSelected(null);
  };

  /**
   * Load exactly one page.
   *
   * Production:
   * - tenant filter
   * - search
   * - status filter
   * - exact row count
   * - database pagination
   *
   * Demo/local mode:
   * the bundled mock dataset is filtered and paginated locally.
   */
  const loadOrders = useCallback(async () => {
    setIsLoading(true);

    try {
      if (!usesSupabase) {
        const filtered = filterDemoOrders(tenant.id, filter, search);
        const from = page * PAGE_SIZE;
        const pageOrders = filtered.slice(from, from + PAGE_SIZE);
        const totalPages =
          filtered.length === 0 ? 0 : Math.ceil(filtered.length / PAGE_SIZE);

        setOrders(pageOrders);
        setPagination({
          page,
          pageSize: PAGE_SIZE,
          total: filtered.length,
          totalPages,
          hasPreviousPage: page > 0,
          hasNextPage: from + pageOrders.length < filtered.length,
        });

        setSelected((current) =>
          current
            ? (pageOrders.find((order) => order.id === current.id) ?? null)
            : null,
        );

        setError("");
        return;
      }

      const result = await listOrders(tenant.id, {
        page,
        pageSize: PAGE_SIZE,
        search,
        status: filter,
      });

      /**
       * If a mutation or search leaves us beyond the last available page,
       * move back to the final valid page and let the effect reload it.
       */
      if (
        result.totalPages > 0 &&
        result.page >= result.totalPages &&
        result.page > 0
      ) {
        setPage(result.totalPages - 1);
        return;
      }

      setOrders(result.orders);
      setPagination({
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
        hasPreviousPage: result.hasPreviousPage,
        hasNextPage: result.hasNextPage,
      });

      setSelected((current) =>
        current
          ? (result.orders.find((order) => order.id === current.id) ?? null)
          : null,
      );

      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load orders.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [filter, page, search, tenant.id, usesSupabase]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (filter === "all") {
      setAllOrderTotal(pagination.total);
      const nextCounts = { ...EMPTY_STATUS_COUNTS };
      orders.forEach((order) => {
        nextCounts[order.status] += 1;
      });
      setStatusCounts(nextCounts);
    } else {
      setStatusCounts((current) => ({
        ...current,
        [filter]: pagination.total,
      }));
    }
  }, [filter, orders, pagination.total]);

  useEffect(() => {
    onTotalChange?.(allOrderTotal);
  }, [allOrderTotal, onTotalChange]);

  /**
   * The first/last displayed record numbers for the pagination summary.
   */
  const pageRange = useMemo(() => {
    if (pagination.total === 0 || orders.length === 0) {
      return { first: 0, last: 0 };
    }

    const first = pagination.page * pagination.pageSize + 1;

    return {
      first,
      last: first + orders.length - 1,
    };
  }, [orders.length, pagination.page, pagination.pageSize, pagination.total]);

  /**
   * Advances an order through its operational lifecycle.
   *
   * Orders are never physically deleted from this screen. Cancellation is
   * represented by the CANCELLED status so transaction/payment/reporting
   * history remains intact.
   */
  const advance = async (id: string, status: OrderStatus) => {
    const order = orders.find((candidate) => candidate.id === id);
    if (!order) return;

    const updatedOrder: Order = {
      ...order,
      status,
    };

    /**
     * Apply an optimistic update for responsive UI.
     */
    setOrders((previous) =>
      previous.map((candidate) =>
        candidate.id === id ? updatedOrder : candidate,
      ),
    );

    setSelected((current) =>
      current?.id === id
        ? {
            ...current,
            status,
          }
        : current,
    );

    setUpdatingId(id);
    setError("");
    setNotice("");

    try {
      if (usesSupabase) {
        await setOrderStatus(tenant.id, id, status);

        /**
         * Reload because the updated status may move this order out of the
         * current server-side status filter and can change page totals.
         */
        await loadOrders();
      }

      setNotice(`Order ${order.orderNumber} marked ${capitalise(status)}.`);
    } catch (updateError) {
      /**
       * Restore the original row when persistence fails.
       */
      setOrders((previous) =>
        previous.map((candidate) => (candidate.id === id ? order : candidate)),
      );

      setSelected((current) => (current?.id === id ? order : current));

      setError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to update order.",
      );
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="orders-page dashboard-page min-h-full space-y-4 p-3 text-white light:text-[#14213a] sm:p-4">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className="orders-refresh w-full justify-center sm:w-auto"
          disabled={isLoading}
          onClick={() => void loadOrders()}
        >
          <RefreshCw
            className={cn("mr-1.5 h-3.5 w-3.5", isLoading && "animate-spin")}
          />
          Refresh orders
        </Button>
      </div>
      {/* ------------------------------------------------------------------
          Status filters
          ------------------------------------------------------------------ */}
      <div className="orders-status-grid grid grid-cols-2 gap-3">
        {statusFlow.map((status) => {
          const Icon = STATUS_ICON[status] ?? ShoppingBag;
          return (
            <button
              key={status}
              type="button"
              onClick={() => changeFilter(status)}
              className={cn(
                "order-status-card relative min-h-17 overflow-hidden rounded-xl border p-3 text-left transition-all",
                `is-${status}`,
                filter === status && "is-active",
              )}
            >
              <span className="order-status-orb" aria-hidden="true" />
              <span className="order-status-icon">
                <Icon className="h-4 w-4" />
              </span>
              <span className="relative z-10 block min-w-0 pl-12">
                <span className="block truncate text-[11px] font-extrabold capitalize text-white light:text-[#17223a]">
                  {status.replaceAll("_", " ")}
                </span>
                <span className="mt-0.5 block text-xl font-black text-white light:text-[#17223a]">
                  {statusCounts[status]}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* ------------------------------------------------------------------
          Error / success feedback
          ------------------------------------------------------------------ */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300 light:text-red-700">
          {error}
        </div>
      )}

      {notice && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300 light:text-emerald-700">
          {notice}
        </div>
      )}

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative w-full xl:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={searchInput}
            onChange={(event) => onSearchInputChange(event.target.value)}
            placeholder="Search order, customer, email or phone..."
            maxLength={120}
            className="orders-search h-10 w-full rounded-xl border pl-9 pr-3 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10"
          />
        </div>

        <div className="orders-toolbar max-w-full overflow-x-auto rounded-xl border p-1.5">
          <div className="flex min-w-max items-center gap-1">
            {(["all", ...statusTabs] as (OrderStatus | "all")[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => changeFilter(tab)}
                className={cn(
                  "whitespace-nowrap rounded-lg px-4 py-2 text-[10px] font-bold capitalize transition-all",
                  filter === tab
                    ? "bg-violet-600 text-white shadow-sm light:bg-violet-600 light:text-white"
                    : "text-slate-400 hover:text-white light:text-slate-600 light:hover:text-gray-900",
                )}
              >
                {tab.replaceAll("_", " ")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading && <p className="text-xs text-slate-400">Loading orders...</p>}

      <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
        {/* ----------------------------------------------------------------
            Order list
            ---------------------------------------------------------------- */}
        <Card className="orders-list-panel overflow-hidden">
          <div className="orders-table-head hidden grid-cols-[1.45fr_1.05fr_0.75fr_0.55fr_1fr_20px] gap-3 border-b px-4 py-2.5 text-[9px] font-bold uppercase tracking-wide sm:grid">
            <span>Order</span>
            <span>Customer</span>
            <span>Status</span>
            <span>Total</span>
            <span>Date</span>
            <span aria-hidden="true" />
          </div>
          <div className="divide-y divide-slate-700 light:divide-slate-100">
            {!isLoading && orders.length === 0 && (
              <div className="py-16 text-center text-slate-400 light:text-gray-500">
                <ShoppingBag className="mx-auto mb-3 h-10 w-10 opacity-40" />
                <p className="text-sm">
                  {search || filter !== "all"
                    ? "No orders match the current filters."
                    : "No orders"}
                </p>
              </div>
            )}

            {orders.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => setSelected(order)}
                className={cn(
                  "order-row grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 text-left transition-colors sm:grid-cols-[1.45fr_1.05fr_0.75fr_0.55fr_1fr_20px]",
                  selected?.id === order.id && "is-selected",
                )}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="order-number-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold">
                    #
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white light:text-gray-900">
                      {order.orderNumber}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {order.items.length} item
                      {order.items.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                <div className="col-span-2 min-w-0 sm:col-span-1">
                  <p className="truncate text-xs font-semibold text-white light:text-gray-900">
                    {order.customerName}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-slate-500">
                    {order.pickupTime
                      ? `Pickup ${order.pickupTime}`
                      : "No pickup time"}
                  </p>
                </div>

                <div className="col-start-2 sm:col-start-auto">
                  <StatusBadge status={order.status} />
                </div>

                <div className="col-start-3 row-start-2 shrink-0 text-right sm:col-start-auto sm:row-start-auto sm:text-left">
                  <p className="text-sm font-bold text-white light:text-gray-900">
                    {formatCurrency(order.totalAmount)}
                  </p>
                  <div className="mt-1 sm:hidden">
                    <StatusBadge status={order.paymentStatus} />
                  </div>
                </div>

                <div className="hidden min-w-0 items-center gap-2 sm:flex">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="min-w-0 text-[10px] leading-4 text-slate-300 light:text-slate-700">
                    <span className="block truncate">
                      {formatOrderDate(order.createdAt).date}
                    </span>
                    <span className="block truncate">
                      {formatOrderDate(order.createdAt).time}
                    </span>
                  </span>
                </div>

                <ChevronRight className="col-start-3 row-start-1 h-4 w-4 shrink-0 text-slate-500 light:text-gray-400 sm:col-start-auto sm:row-start-auto" />
              </button>
            ))}
          </div>

          {/* --------------------------------------------------------------
              Pagination controls
              -------------------------------------------------------------- */}
          <div className="flex flex-col gap-3 border-t border-slate-700 px-4 py-3 light:border-slate-200 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-400 light:text-slate-600">
              {pagination.total === 0
                ? "0 orders"
                : `Showing ${pageRange.first}-${pageRange.last} of ${pagination.total} orders`}
            </p>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isLoading || !pagination.hasPreviousPage}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
              >
                <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                Previous
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
                Next
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </Card>

        {/* ----------------------------------------------------------------
            Detail panel
            ---------------------------------------------------------------- */}
        {selected && (() => {
          const details = (
          <div
            className="order-detail-container"
            role="dialog"
            aria-modal={isMobileViewport ? true : undefined}
            aria-label={`Order details for ${selected.orderNumber}`}
            onClick={(event) => {
              if (event.target === event.currentTarget) setSelected(null);
            }}
          >
            <Card className="order-detail-panel overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-700 px-5 py-3 light:border-slate-200">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 light:text-slate-500">
                  Order details
                </p>
                <button
                  type="button"
                  className="order-detail-close"
                  onClick={() => setSelected(null)}
                  aria-label="Close order details"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-white light:text-gray-900">
                      {selected.orderNumber}
                    </h3>

                    <p className="text-xs text-slate-400 light:text-gray-600">
                      {selected.customerName}
                    </p>
                  </div>

                  <StatusBadge status={selected.status} />
                </div>

                <div className="space-y-2.5">
                  {selected.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3">
                      {item.productImage ? (
                        <Image
                          src={item.productImage}
                          alt={item.productName}
                          width={40}
                          height={40}
                          unoptimized
                          className="h-10 w-10 shrink-0 rounded-xl bg-slate-700 object-cover light:bg-slate-100"
                        />
                      ) : (
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-700 text-xs font-bold text-slate-300 light:bg-slate-100 light:text-slate-500"
                          aria-hidden="true"
                        >
                          {item.productName.charAt(0).toUpperCase()}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white light:text-gray-900">
                          {item.productName}
                        </p>

                        <p className="text-xs text-slate-400 light:text-gray-600">
                          ×{item.quantity}
                        </p>
                      </div>

                      <span className="shrink-0 text-sm font-bold text-white light:text-gray-900">
                        {formatCurrency(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between border-t border-slate-700 pt-3 text-sm light:border-slate-200">
                  <span className="font-medium text-slate-400 light:text-gray-600">
                    Total
                  </span>

                  <span className="text-base font-black text-white light:text-gray-900">
                    {formatCurrency(selected.totalAmount)}
                  </span>
                </div>

                {selected.notes && (
                  <div className="rounded-xl bg-amber-500/20 p-3 text-xs text-amber-400 light:bg-amber-50 light:text-amber-800">
                    <span className="font-semibold">Note: </span>
                    {selected.notes}
                  </div>
                )}

                {selected.status !== "delivered" &&
                  selected.status !== "cancelled" && (
                    <div className="space-y-2 pt-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 light:text-gray-500">
                        Update Status
                      </p>

                      <p className="text-[11px] leading-4 text-slate-400 light:text-slate-600">
                        {tenant.businessType === "ordering"
                          ? "Pending, confirmed, preparing and delivered update the tracker only. Ready or cancelled also sends one customer email."
                          : "Order statuses update the tracker only. Retail sends its customer email when payment is confirmed."}
                      </p>

                      <div className="grid grid-cols-2 gap-2">
                        {statusFlow
                          .slice(
                            Math.max(
                              0,
                              statusFlow.indexOf(selected.status) + 1,
                            ),
                          )
                          .slice(0, 2)
                          .map((next) => (
                            <Button
                              key={next}
                              variant="outline"
                              size="sm"
                              className="justify-center border-slate-600 text-white hover:bg-slate-700 light:border-slate-300 light:text-gray-800 light:hover:bg-slate-100"
                              disabled={updatingId === selected.id}
                              onClick={() => void advance(selected.id, next)}
                            >
                              <RefreshCw className="mr-1 h-3 w-3" />
                              {tenant.businessType === "ordering" &&
                              next === "ready"
                                ? "Ready & notify customer"
                                : capitalise(next.replaceAll("_", " "))}
                            </Button>
                          ))}
                      </div>

                      <Button
                        variant="danger"
                        size="sm"
                        className="w-full justify-center border-red-500/30 bg-red-500/20 text-red-400 hover:bg-red-500/30 light:border-red-200 light:bg-red-50 light:text-red-700 light:hover:bg-red-100"
                        disabled={updatingId === selected.id}
                        onClick={() => void advance(selected.id, "cancelled")}
                      >
                        <XCircle className="mr-1 h-3.5 w-3.5" />
                        {tenant.businessType === "ordering"
                          ? "Cancel & notify customer"
                          : "Cancel Order"}
                      </Button>
                    </div>
                  )}
              </div>
            </Card>
          </div>
          );
          return isMobileViewport
            ? createPortal(details, document.body)
            : details;
        })()}
      </div>
    </div>
  );
}
