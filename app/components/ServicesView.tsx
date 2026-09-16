"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Clock,
  Shield,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Modal } from "../components/Modal";
import { Input, Textarea, Select } from "../components/input";
import { getServicesByTenant } from "../data/mock";
import { getStoredServices, setStoredServices } from "../lib/storage";
import { isSupabaseConfigured } from "../lib/supabase/config";
import {
  createService,
  deleteService,
  listServices,
  setServiceAvailability,
  updateService,
} from "../services/serviceService";
import { formatCurrency, formatDuration } from "../lib/utils";
import { tenantHasFeature } from "../lib/plans";
import type { Service, Tenant } from "../types/index";

interface Props {
  tenant: Tenant;
}

const EMPTY_FORM = {
  name: "",
  price: "",
  duration: "60",
  description: "",
  category: "",
  image: "",
  requiresDeposit: false,
  depositType: "fixed" as "fixed" | "percentage",
  depositAmount: "",
};

export function ServicesView({ tenant }: Props) {
  const canUseBookingDeposits = tenantHasFeature(tenant, "booking_deposits");
  const usesSupabase = isSupabaseConfigured();
  const [services, setServices] = useState<Service[]>(
    usesSupabase ? [] : getServicesByTenant(tenant.id),
  );
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(usesSupabase);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Server-backed list controls.
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [availability, setAvailability] = useState<boolean | "all">("all");
  const [page, setPage] = useState(0);
  const [pagination, setPagination] = useState({
    page: 0,
    pageSize: 25,
    total: usesSupabase ? 0 : getServicesByTenant(tenant.id).length,
    totalPages: usesSupabase
      ? 0
      : Math.ceil(getServicesByTenant(tenant.id).length / 25),
    hasPreviousPage: false,
    hasNextPage: !usesSupabase && getServicesByTenant(tenant.id).length > 25,
  });

  // Debounce search so typing does not issue a Supabase query on every keypress.
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const loadServicePage = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      if (!usesSupabase) {
        const stored = getStoredServices(tenant.id);
        const allServices = stored ?? getServicesByTenant(tenant.id);
        const normalizedSearch = search.toLowerCase();

        const filtered = allServices.filter((service) => {
          const matchesSearch =
            !normalizedSearch ||
            service.name.toLowerCase().includes(normalizedSearch) ||
            service.description.toLowerCase().includes(normalizedSearch) ||
            service.category.toLowerCase().includes(normalizedSearch);
          const matchesAvailability =
            availability === "all" || service.isActive === availability;

          return matchesSearch && matchesAvailability;
        });

        const pageSize = 25;
        const totalPages =
          filtered.length === 0 ? 0 : Math.ceil(filtered.length / pageSize);
        const safePage = totalPages === 0 ? 0 : Math.min(page, totalPages - 1);
        const from = safePage * pageSize;
        const pageServices = filtered.slice(from, from + pageSize);

        setServices(pageServices);
        setPagination({
          page: safePage,
          pageSize,
          total: filtered.length,
          totalPages,
          hasPreviousPage: safePage > 0,
          hasNextPage: safePage + 1 < totalPages,
        });

        if (safePage !== page) setPage(safePage);
        return;
      }

      const result = await listServices(tenant.id, {
        page,
        pageSize: 25,
        search,
        availability,
      });

      // If a mutation/search leaves us beyond the final page, move back once
      // and let the effect load the valid page.
      if (result.totalPages > 0 && page >= result.totalPages) {
        setPage(result.totalPages - 1);
        return;
      }

      setServices(result.services);
      setPagination({
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
        hasPreviousPage: result.hasPreviousPage,
        hasNextPage: result.hasNextPage,
      });
    } catch (loadError: unknown) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load services.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [availability, page, search, tenant.id, usesSupabase]);

  useEffect(() => {
    void loadServicePage();
  }, [loadServicePage]);

  // Categories shown on the current page are used only for visual grouping.
  // A tenant-wide category filter would require a separate distinct-category
  // query/RPC; deriving a global filter from one page would be misleading.
  const categories = useMemo(
    () => [...new Set(services.map((service) => service.category))],
    [services],
  );

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, requiresDeposit: false });
    setError("");
    setSuccess("");
    setShowAdd(true);
  };

  const openEdit = (service: Service) => {
    setEditingId(service.id);
    setForm({
      name: service.name,
      price: String(service.price),
      duration: String(service.duration),
      description: service.description,
      category: service.category,
      image: service.image,
      requiresDeposit: service.requiresDeposit,
      depositType: service.depositType ?? "fixed",
      depositAmount:
        service.depositAmount == null ? "" : String(service.depositAmount),
    });
    setError("");
    setSuccess("");
    setShowAdd(true);
  };

  const toggle = async (id: string) => {
    const current = services.find((service) => service.id === id);
    if (!current) return;

    const previous = services;
    const updated = services.map((service) =>
      service.id === id ? { ...service, isActive: !service.isActive } : service,
    );

    setServices(updated);
    setError("");

    try {
      if (usesSupabase) {
        await setServiceAvailability(tenant.id, id, !current.isActive);
        await loadServicePage();
      } else {
        const stored =
          getStoredServices(tenant.id) ?? getServicesByTenant(tenant.id);
        setStoredServices(
          tenant.id,
          stored.map((service) =>
            service.id === id
              ? { ...service, isActive: !service.isActive }
              : service,
          ),
        );
        await loadServicePage();
      }
    } catch (updateError) {
      setServices(previous);
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to update service.",
      );
    }
  };

  const del = async (id: string) => {
    if (!window.confirm("Delete this service? This cannot be undone.")) return;

    const previous = services;
    setServices((current) => current.filter((service) => service.id !== id));
    setError("");

    try {
      if (usesSupabase) {
        await deleteService(tenant.id, id);
      } else {
        const stored =
          getStoredServices(tenant.id) ?? getServicesByTenant(tenant.id);
        setStoredServices(
          tenant.id,
          stored.filter((service) => service.id !== id),
        );
      }

      await loadServicePage();
    } catch (deleteError) {
      setServices(previous);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete service.",
      );
    }
  };

  const save = async () => {
    const price = Number(form.price);
    const duration = Number(form.duration);
    const depositAmount = form.depositAmount ? Number(form.depositAmount) : 0;

    if (!form.name.trim()) {
      setError("Service name is required.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setError("Enter a valid service price.");
      return;
    }
    if (
      !Number.isFinite(duration) ||
      !Number.isInteger(duration) ||
      duration <= 0
    ) {
      setError("Enter a valid whole-number service duration.");
      return;
    }
    if (
      form.requiresDeposit &&
      (!Number.isFinite(depositAmount) || depositAmount < 0)
    ) {
      setError("Enter a valid deposit amount.");
      return;
    }
    if (
      form.requiresDeposit &&
      form.depositType === "percentage" &&
      depositAmount > 100
    ) {
      setError("Deposit percentage cannot exceed 100%.");
      return;
    }
    if (
      form.requiresDeposit &&
      form.depositType === "fixed" &&
      depositAmount > price
    ) {
      setError("Fixed deposit cannot exceed the service price.");
      return;
    }

    const input = {
      name: form.name,
      description: form.description,
      duration,
      price,
      image: form.image,
      category: form.category,
      requiresDeposit: form.requiresDeposit,
      depositType: form.depositType,
      depositAmount,
    };

    setIsSaving(true);
    setError("");
    setSuccess("");
    try {
      let saved: Service;
      if (usesSupabase) {
        saved = editingId
          ? await updateService(tenant.id, editingId, input)
          : await createService(tenant.id, input);
      } else {
        saved = editingId
          ? {
              ...services.find((service) => service.id === editingId)!,
              ...input,
            }
          : {
              id: `service-${Date.now()}`,
              tenantId: tenant.id,
              ...input,
              category: input.category || "Services",
              isActive: true,
              createdAt: new Date().toISOString(),
            };
      }

      if (!usesSupabase) {
        const stored =
          getStoredServices(tenant.id) ?? getServicesByTenant(tenant.id);
        const updated = editingId
          ? stored.map((service) =>
              service.id === editingId ? saved : service,
            )
          : [...stored, saved];
        setStoredServices(tenant.id, updated);
      }

      const successMessage = editingId
        ? "Service updated."
        : "Service created.";

      setShowAdd(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      setSuccess(successMessage);

      // New records are ordered newest-first, so return to page one after
      // creation. Edits refresh the current server page.
      if (!editingId && page !== 0) {
        setPage(0);
      } else {
        await loadServicePage();
      }
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save service.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-full space-y-4 bg-[#08111f] light:bg-[#f8fafc] p-4 text-white light:text-[#14213a] md:p-5">
      <div className="flex items-center justify-end">
        <div className="sr-only">
          <h2 className="text-sm font-bold text-white light:text-[#17223a]">
            Services
          </h2>
          <p className="mt-0.5 text-[10px] text-slate-400 light:text-[#71809a]">
            {availability === true
              ? `${pagination.total} active`
              : availability === false
                ? `${pagination.total} paused`
                : `${pagination.total} total`}
          </p>
        </div>
        <Button onClick={openAdd} size="sm">
          <Plus className="w-4 h-4" /> Add Service
        </Button>
      </div>

      {error && (
        <p className="rounded-lg bg-red-500/10 px-4 py-3 text-xs text-red-400 light:text-red-700">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg bg-emerald-500/10 px-4 py-3 text-xs text-emerald-500 light:text-emerald-700">
          {success}
        </p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchInput}
            maxLength={120}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search services..."
            className="h-8 w-full rounded-lg border border-slate-700 bg-slate-800 pl-9 pr-3 text-[10px] text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30 light:border-[#e3e8f0] light:bg-white light:text-gray-900 light:placeholder:text-gray-400"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["all", "All"],
              [true, "Active"],
              [false, "Paused"],
            ] as const
          ).map(([value, label]) => (
            <button
              type="button"
              key={String(value)}
              onClick={() => {
                setAvailability(value);
                setPage(0);
              }}
              className={`rounded-lg px-3 py-1.5 text-[10px] font-medium transition-colors ${
                availability === value
                  ? "bg-violet-600 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700 light:bg-gray-100 light:text-gray-700 light:hover:bg-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <p className="text-xs text-slate-500">
          Loading services from Supabase...
        </p>
      )}

      {!isLoading && services.length === 0 && (
        <Card className="p-12 text-center text-xs text-slate-500">
          {search || availability !== "all"
            ? "No services match the current filters."
            : "No services yet. Add the first service for your storefront."}
        </Card>
      )}

      {categories.map((cat) => (
        <div key={cat} className="space-y-3">
          <h3 className="text-[10px] font-bold text-slate-400 light:text-slate-500 uppercase tracking-wider">
            {cat}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {services
              .filter((s) => s.category === cat)
              .map((svc) => (
                <ServiceCard
                  key={svc.id}
                  service={svc}
                  onEdit={openEdit}
                  onToggle={toggle}
                  onDelete={del}
                />
              ))}
          </div>
        </div>
      ))}

      {!isLoading && pagination.total > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-slate-800 px-3 py-2 text-[10px] text-slate-400 light:border-slate-200 light:text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing {pagination.page * pagination.pageSize + 1}–
            {Math.min(
              (pagination.page + 1) * pagination.pageSize,
              pagination.total,
            )}{" "}
            of {pagination.total}
          </span>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="xs"
              disabled={!pagination.hasPreviousPage || isLoading}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </Button>

            <span>
              Page {pagination.totalPages === 0 ? 0 : pagination.page + 1} of{" "}
              {pagination.totalPages}
            </span>

            <Button
              type="button"
              variant="outline"
              size="xs"
              disabled={!pagination.hasNextPage || isLoading}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title={editingId ? "Edit Service" : "Add New Service"}
        footer={
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowAdd(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button loading={isSaving} onClick={save} className="flex-1">
              {isSaving
                ? "Saving..."
                : editingId
                  ? "Update Service"
                  : "Save Service"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Service Name"
            placeholder="e.g. Deep Tissue Massage"
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Price ($)"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.price}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  price: event.target.value,
                }))
              }
            />
            <Input
              label="Duration (min)"
              type="number"
              min="1"
              placeholder="60"
              value={form.duration}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  duration: event.target.value,
                }))
              }
            />
          </div>
          <Textarea
            label="Description"
            rows={3}
            placeholder="Describe the service..."
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
          />
          <Input
            label="Category"
            placeholder="Hair, Nails, Skincare..."
            value={form.category}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                category: event.target.value,
              }))
            }
          />
          <Input
            label="Image URL"
            placeholder="https://..."
            value={form.image}
            onChange={(event) =>
              setForm((current) => ({ ...current, image: event.target.value }))
            }
          />
          {canUseBookingDeposits ? (
            <>
              <div className="flex items-center gap-3 p-3 bg-violet-50 rounded-xl">
                <input
                  type="checkbox"
                  id="deposit"
                  checked={form.requiresDeposit}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      requiresDeposit: event.target.checked,
                    }))
                  }
                  className="w-4 h-4 accent-violet-600"
                />
                <label
                  htmlFor="deposit"
                  className="text-sm font-medium text-slate-700"
                >
                  Require deposit for this service
                </label>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Select
                  label="Deposit Type"
                  value={form.depositType}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      depositType: event.target.value as "fixed" | "percentage",
                    }))
                  }
                  options={[
                    { value: "fixed", label: "Fixed Amount" },
                    { value: "percentage", label: "Percentage" },
                  ]}
                />
                <Input
                  label="Amount"
                  type="number"
                  min="0"
                  placeholder="25"
                  value={form.depositAmount}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      depositAmount: event.target.value,
                    }))
                  }
                />
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-violet-500/25 bg-violet-500/10 p-3 text-xs text-violet-200 light:border-violet-200 light:bg-violet-50 light:text-violet-800">
              Appointment deposit settings are available on the Pro plan. You
              can continue creating and editing basic services on Beginner.
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

function ServiceCard({
  service,
  onEdit,
  onToggle,
  onDelete,
}: {
  service: Service;
  onEdit: (service: Service) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card className="group w-full overflow-hidden">
      <div className="relative h-32 overflow-hidden bg-slate-800 light:bg-slate-100">
        {service.image ? (
          // Tenant-configured image URLs can use arbitrary hosts, so a native
          // image is retained instead of restricting them through next/image.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={service.image}
            alt={service.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-500">
            <Clock className="h-10 w-10" />
          </div>
        )}
        <div className="absolute inset-0 bg-linear-to-t from-black/30 to-transparent" />
        <div className="absolute top-3 right-3">
          <Badge variant={service.isActive ? "success" : "default"}>
            {service.isActive ? "Active" : "Off"}
          </Badge>
        </div>
      </div>
      <div className="space-y-3 p-3.5">
        <div>
          <h4 className="text-xs font-semibold text-white light:text-[#17223a]">
            {service.name}
          </h4>
          <p className="mt-1 line-clamp-2 text-[10px] text-slate-400 light:text-[#71809a]">
            {service.description}
          </p>
        </div>
        <div className="flex items-center gap-4 text-[10px]">
          <span className="flex items-center gap-1.5 text-slate-300 light:text-[#566681]">
            <Clock className="w-3.5 h-3.5" />
            {formatDuration(service.duration)}
          </span>
          <span className="text-xs font-bold text-white light:text-[#17223a]">
            {formatCurrency(service.price)}
          </span>
          {service.requiresDeposit && (
            <span className="flex items-center gap-1 text-violet-600 text-xs">
              <Shield className="w-3.5 h-3.5" />
              Deposit
            </span>
          )}
        </div>
        {service.requiresDeposit && (
          <div className="bg-violet-50 rounded-lg px-3 py-1.5 text-xs text-violet-700">
            Deposit:{" "}
            {service.depositType === "fixed"
              ? formatCurrency(service.depositAmount ?? 0)
              : `${service.depositAmount}%`}
          </div>
        )}
        <div className="flex items-center justify-between border-t border-slate-700/60 light:border-[#edf0f5] pt-2">
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="xs"
              className="p-1.5"
              onClick={() => onEdit(service)}
            >
              <Edit2 className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="xs"
              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50"
              onClick={() => onDelete(service.id)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
          <button
            type="button"
            onClick={() => onToggle(service.id)}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label={
              service.isActive
                ? `Pause ${service.name}`
                : `Publish ${service.name}`
            }
          >
            {service.isActive ? (
              <ToggleRight className="w-6 h-6 text-emerald-500" />
            ) : (
              <ToggleLeft className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>
    </Card>
  );
}
