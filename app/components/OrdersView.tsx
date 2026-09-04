"use client";

import { useEffect, useState } from "react";
import {
  ShoppingBag,
  RefreshCw,
  XCircle,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { StatusBadge } from "../components/Badge";
import { Modal } from "../components/Modal";
import { getOrdersByTenant } from "../data/mock";
import { isSupabaseConfigured } from "../lib/supabase/config";
import { formatCurrency, capitalise, cn } from "../lib/utils";
import {
  deleteOrder,
  listOrders,
  setOrderStatus,
} from "../services/orderService";
import type { Order, OrderStatus, Tenant } from "../types/index";

const STATUS_FLOW: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "delivered",
];
const STATUS_TABS: OrderStatus[] = [...STATUS_FLOW, "cancelled"];

// Status background colors – default dark, light overrides
const STATUS_BG: Record<string, string> = {
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
  cancelled:
    "bg-red-500/20 light:bg-red-50 border-red-500/30 light:border-red-200",
};

interface Props {
  tenant: Tenant;
}

export function OrdersView({ tenant }: Props) {
  const [orders, setOrders] = useState<Order[]>(
    isSupabaseConfigured() ? [] : getOrdersByTenant(tenant.id),
  );
  const [selected, setSelected] = useState<Order | null>(null);
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured());
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let active = true;

    listOrders(tenant.id)
      .then((loadedOrders) => {
        if (!active) return;
        setOrders(loadedOrders);
        setSelected((current) =>
          current
            ? (loadedOrders.find((order) => order.id === current.id) ?? null)
            : null,
        );
        setError("");
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load orders.",
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [tenant.id]);

  const filtered =
    filter === "all" ? orders : orders.filter((o) => o.status === filter);

  const advance = async (id: string, status: OrderStatus) => {
    const order = orders.find((candidate) => candidate.id === id);
    if (!order) return;

    const updatedOrder = { ...order, status };
    setOrders((previous) =>
      previous.map((candidate) =>
        candidate.id === id ? updatedOrder : candidate,
      ),
    );
    setSelected((prev) => (prev?.id === id ? { ...prev, status } : prev));
    setUpdatingId(id);
    setError("");
    setNotice("");

    try {
      if (isSupabaseConfigured()) await setOrderStatus(tenant.id, id, status);
      setNotice(`Order ${order.orderNumber} marked ${status}.`);
    } catch (updateError) {
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

  const removeOrder = async () => {
    if (!deleteTarget) return;
    const order = deleteTarget;
    setIsDeleting(true);
    setError("");
    setNotice("");
    try {
      if (isSupabaseConfigured()) await deleteOrder(tenant.id, order.id);
      setOrders((current) =>
        current.filter((candidate) => candidate.id !== order.id),
      );
      setSelected((current) => (current?.id === order.id ? null : current));
      setDeleteTarget(null);
      setNotice(`Order ${order.orderNumber} was permanently deleted.`);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete order.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-full space-y-4 bg-[#08111f] light:bg-[#f8fafc] p-4 text-white light:text-[#14213a] md:p-5">
      {/* Status summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {STATUS_FLOW.map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={cn(
              "rounded-xl border p-3 text-left transition-all hover:shadow-sm",
              STATUS_BG[status],
              filter === status &&
                "ring-2 ring-violet-500 light:ring-violet-400 ring-offset-2 ring-offset-[#0a0f1a] light:ring-offset-white",
            )}
          >
            <p className="text-xs font-medium text-slate-400 light:text-slate-600 capitalize">
              {status}
            </p>
            <p className="mt-1 text-xl font-black text-white light:text-[#17223a]">
              {orders.filter((o) => o.status === status).length}
            </p>
          </button>
        ))}
      </div>

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
      {isLoading && (
        <p className="text-xs text-slate-400">
          Loading orders from Supabase...
        </p>
      )}

      {/* Filter strip */}
      <div className="flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-slate-700/60 light:border-[#e5e9f1] bg-slate-900/70 light:bg-white p-1">
        {(["all", ...STATUS_TABS] as (OrderStatus | "all")[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={cn(
              "rounded-md px-3 py-1.5 text-[10px] font-medium capitalize transition-all",
              filter === tab
                ? "bg-violet-600 light:bg-white text-white light:text-gray-900 shadow-sm"
                : "text-slate-400 light:text-slate-600 hover:text-white light:hover:text-gray-900",
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* List */}
        <Card className="lg:col-span-2">
          <div className="divide-y divide-slate-700 light:divide-slate-100">
            {filtered.length === 0 && (
              <div className="py-16 text-center text-slate-400 light:text-gray-500">
                <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No orders</p>
              </div>
            )}
            {filtered.map((order) => (
              <button
                key={order.id}
                onClick={() => setSelected(order)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-700 light:hover:bg-[#fafbfe]",
                  selected?.id === order.id &&
                    "bg-violet-900/30 light:bg-violet-50",
                )}
              >
                <div
                  className={cn(
                    "w-11 h-11 rounded-xl flex items-center justify-center border text-sm font-bold flex-shrink-0",
                    STATUS_BG[order.status],
                  )}
                >
                  #
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-white light:text-gray-900">
                      {order.orderNumber}
                    </p>
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="text-xs text-slate-400 light:text-gray-600 mt-0.5">
                    {order.customerName} · {order.items.length} item
                    {order.items.length !== 1 ? "s" : ""}
                    {order.pickupTime && ` · Pickup ${order.pickupTime}`}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-white light:text-gray-900">
                    {formatCurrency(order.totalAmount)}
                  </p>
                  <StatusBadge status={order.paymentStatus} />
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 light:text-gray-400 flex-shrink-0" />
              </button>
            ))}
          </div>
        </Card>

        {/* Detail panel */}
        <div>
          {selected ? (
            <Card className="sticky top-6">
              <div className="p-5 space-y-4">
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
                      <img
                        src={item.productImage}
                        alt={item.productName}
                        className="w-10 h-10 rounded-xl object-cover bg-slate-700 light:bg-slate-100 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white light:text-gray-900 truncate">
                          {item.productName}
                        </p>
                        <p className="text-xs text-slate-400 light:text-gray-600">
                          ×{item.quantity}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-white light:text-gray-900 flex-shrink-0">
                        {formatCurrency(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-700 light:border-slate-200 pt-3 flex justify-between text-sm">
                  <span className="font-medium text-slate-400 light:text-gray-600">
                    Total
                  </span>
                  <span className="font-black text-white light:text-gray-900 text-base">
                    {formatCurrency(selected.totalAmount)}
                  </span>
                </div>

                {selected.notes && (
                  <div className="bg-amber-500/20 light:bg-amber-50 text-amber-400 light:text-amber-800 text-xs rounded-xl p-3">
                    <span className="font-semibold">Note: </span>
                    {selected.notes}
                  </div>
                )}

                {selected.status !== "delivered" &&
                  selected.status !== "cancelled" && (
                    <div className="space-y-2 pt-1">
                      <p className="text-xs font-semibold text-slate-400 light:text-gray-500 uppercase tracking-wide">
                        Update Status
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {STATUS_FLOW.slice(
                          STATUS_FLOW.indexOf(selected.status as OrderStatus) +
                            1,
                        )
                          .slice(0, 2)
                          .map((next) => (
                            <Button
                              key={next}
                              variant="outline"
                              size="sm"
                              className="justify-center border-slate-600 light:border-slate-300 text-white light:text-gray-800 hover:bg-slate-700 light:hover:bg-slate-100"
                              disabled={updatingId === selected.id}
                              onClick={() => advance(selected.id, next)}
                            >
                              <RefreshCw className="w-3 h-3 mr-1" />
                              {capitalise(next)}
                            </Button>
                          ))}
                      </div>
                      <Button
                        variant="danger"
                        size="sm"
                        className="w-full justify-center bg-red-500/20 light:bg-red-50 text-red-400 light:text-red-700 border-red-500/30 light:border-red-200 hover:bg-red-500/30 light:hover:bg-red-100"
                        disabled={updatingId === selected.id}
                        onClick={() => advance(selected.id, "cancelled")}
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1" /> Cancel Order
                      </Button>
                    </div>
                  )}

                {(selected.status === "delivered" ||
                  selected.status === "cancelled") && (
                  <Button
                    variant="danger"
                    size="sm"
                    className="w-full justify-center"
                    onClick={() => setDeleteTarget(selected)}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete Order
                  </Button>
                )}
              </div>
            </Card>
          ) : (
            <div
              className="flex flex-col items-center justify-center h-48 text-slate-400 light:text-gray-500
                            bg-slate-800/50 light:bg-slate-50 rounded-2xl border-2 border-dashed border-slate-700 light:border-slate-200"
            >
              <ShoppingBag className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">Select an order to view details</p>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Order"
        footer={
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setDeleteTarget(null)}
            >
              Keep Order
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              disabled={isDeleting}
              onClick={removeOrder}
            >
              {isDeleting ? "Deleting..." : "Delete Order"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-300 light:text-gray-700">
          This permanently removes <strong>{deleteTarget?.orderNumber}</strong>{" "}
          and its line items.
        </p>
      </Modal>
    </div>
  );
}
