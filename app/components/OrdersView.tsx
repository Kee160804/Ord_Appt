"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  ShoppingBag,
  XCircle,
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

/**
 * Status styling shared by the summary/filter controls and order list.
 */
const STATUS_BG: Record<OrderStatus, string> = {
  pending:
    "bg-amber-500/20 light:bg-amber-50 border-amber-500/30 light:border-amber-200",
  confirmed:
    "bg-blue-500/20 light:bg-blue-50 border-blue-500/30 light:border-blue-200",
  preparing:
    "bg-violet-500/20 light:bg-violet-50 border-violet-500/30 light:border-violet-200",
  ready:
    "bg-green-500/20 light:bg-green-50 border-green-500/30 light:border-green-200",
  delivered:
    "bg-slate-700/50 light:bg-slate-50 border-slate-600 light:border-slate-200",
  out_for_delivery:
    "bg-cyan-500/20 light:bg-cyan-50 border-cyan-500/30 light:border-cyan-200",
  cancelled:
    "bg-red-500/20 light:bg-red-50 border-red-500/30 light:border-red-200",
};

interface Props {
  tenant: Tenant;
}

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

export function OrdersView({ tenant }: Props) {
  const usesSupabase = isSupabaseConfigured();

  const statusFlow: OrderStatus[] =
    tenant.businessType === "retail"
      ? [...BASE_STATUS_FLOW.slice(0, -1), "out_for_delivery", "delivered"]
      : BASE_STATUS_FLOW;

  const statusTabs: OrderStatus[] = [...statusFlow, "cancelled"];

  const [orders, setOrders] = useState<Order[]>([]);
  const [selected, setSelected] = useState<Order | null>(null);

  const [filter, setFilter] = useState<OrderStatus | "all">("all");

  /**
   * searchInput updates immediately while typing.
   * search is debounced before it is sent to Supabase.
   */
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [page, setPage] = useState(0);
  const [pagination, setPagination] =
    useState<PaginationState>(EMPTY_PAGINATION);

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

      setNotice(
        `Order ${order.orderNumber} marked ${capitalise(status)}.`,
      );
    } catch (updateError) {
      /**
       * Restore the original row when persistence fails.
       */
      setOrders((previous) =>
        previous.map((candidate) =>
          candidate.id === id ? order : candidate,
        ),
      );

      setSelected((current) =>
        current?.id === id ? order : current,
      );

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
    <div className="min-h-full space-y-4 bg-[#08111f] p-4 text-white light:bg-[#f8fafc] light:text-[#14213a] md:p-5">
      {/* ------------------------------------------------------------------
          Status filters
          ------------------------------------------------------------------ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {statusFlow.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => changeFilter(status)}
            className={cn(
              "rounded-xl border p-3 text-left transition-all hover:shadow-sm",
              STATUS_BG[status],
              filter === status &&
                "ring-2 ring-violet-500 ring-offset-2 ring-offset-[#0a0f1a] light:ring-violet-400 light:ring-offset-white",
            )}
          >
            <p className="text-xs font-medium capitalize text-slate-400 light:text-slate-600">
              {status.replaceAll("_", " ")}
            </p>

            <p className="mt-1 text-xl font-black text-white light:text-[#17223a]">
              {filter === status ? pagination.total : "—"}
            </p>

            <p className="mt-0.5 text-[9px] text-slate-500 light:text-slate-500">
              {filter === status ? "matching orders" : "select to view"}
            </p>
          </button>
        ))}
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

      {/* ------------------------------------------------------------------
          Search + filter strip
          ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search order, customer, email or phone..."
            maxLength={120}
            className="h-10 w-full rounded-lg border border-slate-700/60 bg-slate-900/70 pl-9 pr-3 text-sm text-white outline-none transition focus:border-violet-500 light:border-[#e5e9f1] light:bg-white light:text-slate-900"
          />
        </div>

        <div className="flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-slate-700/60 bg-slate-900/70 p-1 light:border-[#e5e9f1] light:bg-white">
          {(["all", ...statusTabs] as (OrderStatus | "all")[]).map(
            (tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => changeFilter(tab)}
                className={cn(
                  "whitespace-nowrap rounded-md px-3 py-1.5 text-[10px] font-medium capitalize transition-all",
                  filter === tab
                    ? "bg-violet-600 text-white shadow-sm light:bg-violet-600 light:text-white"
                    : "text-slate-400 hover:text-white light:text-slate-600 light:hover:text-gray-900",
                )}
              >
                {tab.replaceAll("_", " ")}
              </button>
            ),
          )}
        </div>
      </div>

      {isLoading && (
        <p className="text-xs text-slate-400">
          Loading orders...
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ----------------------------------------------------------------
            Order list
            ---------------------------------------------------------------- */}
        <Card className="lg:col-span-2">
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
                  "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-700 light:hover:bg-[#fafbfe]",
                  selected?.id === order.id &&
                    "bg-violet-900/30 light:bg-violet-50",
                )}
              >
                <div
                  className={cn(
                    "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border text-sm font-bold",
                    STATUS_BG[order.status],
                  )}
                >
                  #
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-white light:text-gray-900">
                      {order.orderNumber}
                    </p>

                    <StatusBadge status={order.status} />
                  </div>

                  <p className="mt-0.5 text-xs text-slate-400 light:text-gray-600">
                    {order.customerName} · {order.items.length} item
                    {order.items.length !== 1 ? "s" : ""}
                    {order.pickupTime
                      ? ` · Pickup ${order.pickupTime}`
                      : ""}
                  </p>
                </div>

                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-bold text-white light:text-gray-900">
                    {formatCurrency(order.totalAmount)}
                  </p>

                  <StatusBadge status={order.paymentStatus} />
                </div>

                <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-500 light:text-gray-400" />
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
                disabled={
                  isLoading ||
                  !pagination.hasPreviousPage
                }
                onClick={() =>
                  setPage((current) => Math.max(0, current - 1))
                }
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
                disabled={
                  isLoading ||
                  !pagination.hasNextPage
                }
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
        <div>
          {selected ? (
            <Card className="sticky top-6">
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
                    <div
                      key={item.id}
                      className="flex items-center gap-3"
                    >
                      {item.productImage ? (
                        <Image
                          src={item.productImage}
                          alt={item.productName}
                          width={40}
                          height={40}
                          unoptimized
                          className="h-10 w-10 flex-shrink-0 rounded-xl bg-slate-700 object-cover light:bg-slate-100"
                        />
                      ) : (
                        <div
                          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-700 text-xs font-bold text-slate-300 light:bg-slate-100 light:text-slate-500"
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

                      <span className="flex-shrink-0 text-sm font-bold text-white light:text-gray-900">
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
                              onClick={() =>
                                void advance(selected.id, next)
                              }
                            >
                              <RefreshCw className="mr-1 h-3 w-3" />
                              {capitalise(next.replaceAll("_", " "))}
                            </Button>
                          ))}
                      </div>

                      <Button
                        variant="danger"
                        size="sm"
                        className="w-full justify-center border-red-500/30 bg-red-500/20 text-red-400 hover:bg-red-500/30 light:border-red-200 light:bg-red-50 light:text-red-700 light:hover:bg-red-100"
                        disabled={updatingId === selected.id}
                        onClick={() =>
                          void advance(selected.id, "cancelled")
                        }
                      >
                        <XCircle className="mr-1 h-3.5 w-3.5" />
                        Cancel Order
                      </Button>
                    </div>
                  )}
              </div>
            </Card>
          ) : (
            <div className="flex h-48 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-700 bg-slate-800/50 text-slate-400 light:border-slate-200 light:bg-slate-50 light:text-gray-500">
              <ShoppingBag className="mb-2 h-8 w-8 opacity-40" />
              <p className="text-sm">Select an order to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
