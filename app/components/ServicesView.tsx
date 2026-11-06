"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Clock,
  Shield,
  Search,
  FolderTree,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "../contexts/auth";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Modal } from "../components/Modal";
import { Input, Textarea, Select } from "../components/input";
import { getServicesByTenant } from "../data/mock";
import {
  getStoredServiceCategories,
  getStoredServices,
  setStoredServiceCategories,
  setStoredServices,
} from "../lib/storage";
import { isSupabaseConfigured } from "../lib/supabase/config";
import {
  createService,
  createServiceCategory,
  deleteServiceCategory,
  deleteService,
  listServiceCategories,
  listServices,
  renameServiceCategory,
  separateDepartmentServiceCategories,
  setServiceAvailability,
  updateService,
  type ServiceCategory,
} from "../services/serviceService";
import {
  listDepartments,
  type ServiceDepartment,
} from "../services/businessToolsService";
import { formatCurrency, formatDuration, cn } from "../lib/utils";
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
  departmentId: "",
  requiresDeposit: false,
  depositType: "fixed" as "fixed" | "percentage",
  depositAmount: "",
};

export function ServicesView({ tenant }: Props) {
  const { user } = useAuth();
  const isBusinessAdmin = user?.role === "owner" || user?.role === "admin";
  const canUseBookingDeposits = tenantHasFeature(tenant, "booking_deposits");
  const canUseDepartments = tenantHasFeature(tenant, "team_management");
  const canAssignDepartments = canUseDepartments && isBusinessAdmin;
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
  const [departments, setDepartments] = useState<ServiceDepartment[]>([]);
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>(
    [],
  );
  const [showCategories, setShowCategories] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryPosition, setCategoryPosition] = useState("1");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null,
  );
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const categorySeparationAttempted = useRef(false);

  // Server-backed list controls.
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [availability, setAvailability] = useState<boolean | "all">("all");
  const [category, setCategory] = useState("all");
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

        const filtered = allServices
          .filter((service) => {
            const matchesSearch =
              !normalizedSearch ||
              service.name.toLowerCase().includes(normalizedSearch) ||
              service.description.toLowerCase().includes(normalizedSearch) ||
              service.category.toLowerCase().includes(normalizedSearch);
            const matchesAvailability =
              availability === "all" || service.isActive === availability;
            const matchesCategory =
              category === "all" || service.category === category;

            return matchesSearch && matchesAvailability && matchesCategory;
          })
          .sort((first, second) =>
            first.name.localeCompare(second.name, undefined, {
              sensitivity: "base",
              numeric: true,
            }),
          );

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
        category,
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
  }, [availability, category, page, search, tenant.id, usesSupabase]);

  useEffect(() => {
    void loadServicePage();
  }, [loadServicePage]);

  const loadDepartments = useCallback(async () => {
    if (!usesSupabase) return;
    try {
      setDepartments(await listDepartments(tenant.id));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to load departments.",
      );
    }
  }, [tenant.id, usesSupabase]);

  useEffect(() => {
    void loadDepartments();
  }, [loadDepartments]);

  const loadServiceCategories = useCallback(async () => {
    try {
      if (usesSupabase) {
        setServiceCategories(await listServiceCategories(tenant.id));
        return;
      }

      const allServices =
        getStoredServices(tenant.id) ?? getServicesByTenant(tenant.id);
      const storedCategories = getStoredServiceCategories(tenant.id);
      setServiceCategories(
        [
          ...new Set(
            storedCategories ??
              allServices.map((service) => service.category).filter(Boolean),
          ),
        ]
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b))
          .map((name, index) => ({
            id: `local-category-${name}`,
            tenantId: tenant.id,
            name,
            sortOrder: index,
          })),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to load service categories.",
      );
    }
  }, [tenant.id, usesSupabase]);

  useEffect(() => {
    void loadServiceCategories();
  }, [loadServiceCategories]);

  const departmentNameSet = useMemo(
    () =>
      new Set(
        departments
          .map((item) => item.name.trim().toLowerCase())
          .filter(Boolean),
      ),
    [departments],
  );
  const categoryOnlyItems = useMemo(
    () =>
      serviceCategories
        .filter(
          (item) =>
            item.name.trim().toLowerCase() !== "services" &&
            !departmentNameSet.has(item.name.trim().toLowerCase()),
        )
        .sort(
          (first, second) =>
            first.sortOrder - second.sortOrder ||
            first.name.localeCompare(second.name),
        ),
    [departmentNameSet, serviceCategories],
  );
  const filterCategories = useMemo(
    () => categoryOnlyItems.map((item) => item.name),
    [categoryOnlyItems],
  );

  useEffect(() => {
    if (
      !usesSupabase ||
      !isBusinessAdmin ||
      categorySeparationAttempted.current
    ) {
      return;
    }

    const hasOverlap = serviceCategories.some((item) => {
      const normalizedName = item.name.trim().toLowerCase();
      return (
        normalizedName === "services" || departmentNameSet.has(normalizedName)
      );
    });
    if (!hasOverlap) return;

    categorySeparationAttempted.current = true;
    void separateDepartmentServiceCategories(
      tenant.id,
      departments.map((item) => item.name),
    )
      .then(async (changed) => {
        if (changed) {
          setCategory("all");
          await Promise.all([loadServiceCategories(), loadServicePage()]);
        }
      })
      .catch((cause) => {
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to separate categories from departments.",
        );
      });
  }, [
    departmentNameSet,
    departments,
    isBusinessAdmin,
    loadServiceCategories,
    loadServicePage,
    serviceCategories,
    tenant.id,
    usesSupabase,
  ]);

  const saveCategory = async () => {
    const normalizedName = categoryName.trim();
    const position = Number(categoryPosition);
    if (!normalizedName) {
      setError("Category name is required.");
      return;
    }
    if (normalizedName.toLowerCase() === "services") {
      setError('"Services" is represented by All and cannot be a category.');
      return;
    }
    if (!Number.isInteger(position) || position < 1) {
      setError("Position must be a whole number greater than zero.");
      return;
    }

    setIsSavingCategory(true);
    setError("");
    try {
      if (usesSupabase) {
        if (editingCategoryId) {
          await renameServiceCategory(
            tenant.id,
            editingCategoryId,
            normalizedName,
            position - 1,
          );
        } else {
          await createServiceCategory(tenant.id, normalizedName, position - 1);
        }
      } else if (editingCategoryId) {
        const previousName = serviceCategories.find(
          (item) => item.id === editingCategoryId,
        )?.name;
        if (previousName) {
          const stored =
            getStoredServices(tenant.id) ?? getServicesByTenant(tenant.id);
          setStoredServices(
            tenant.id,
            stored.map((service) =>
              service.category === previousName
                ? { ...service, category: normalizedName }
                : service,
            ),
          );
          setStoredServiceCategories(
            tenant.id,
            categoryOnlyItems.map((item) =>
              item.id === editingCategoryId ? normalizedName : item.name,
            ),
          );
        }
      } else {
        setStoredServiceCategories(tenant.id, [
          ...categoryOnlyItems.map((item) => item.name),
          normalizedName,
        ]);
        setServiceCategories((current) => [
          ...current,
          {
            id: `local-category-${Date.now()}`,
            tenantId: tenant.id,
            name: normalizedName,
            sortOrder: position - 1,
          },
        ]);
      }

      setCategoryName("");
      setCategoryPosition(String(categoryOnlyItems.length + 1));
      setEditingCategoryId(null);
      await Promise.all([loadServiceCategories(), loadServicePage()]);
      setSuccess(editingCategoryId ? "Category updated." : "Category added.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to save category.",
      );
    } finally {
      setIsSavingCategory(false);
    }
  };

  const removeCategory = async (item: ServiceCategory) => {
    if (
      !window.confirm(
        `Delete ${item.name}? Categories assigned to services cannot be deleted.`,
      )
    ) {
      return;
    }

    setError("");
    try {
      if (usesSupabase) {
        await deleteServiceCategory(tenant.id, item.id);
      } else {
        const allServices =
          getStoredServices(tenant.id) ?? getServicesByTenant(tenant.id);
        if (allServices.some((service) => service.category === item.name)) {
          throw new Error(
            "Move services to another category before deleting this category.",
          );
        }
        setServiceCategories((current) =>
          current.filter((categoryItem) => categoryItem.id !== item.id),
        );
        setStoredServiceCategories(
          tenant.id,
          categoryOnlyItems
            .filter((categoryItem) => categoryItem.id !== item.id)
            .map((categoryItem) => categoryItem.name),
        );
      }

      if (category === item.name) setCategory("all");
      await loadServiceCategories();
      setSuccess("Category deleted.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to delete category.",
      );
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, requiresDeposit: false });
    setError("");
    setSuccess("");
    setShowAdd(true);
  };

  useEffect(() => {
    const handlePrimaryAction = () => openAdd();
    window.addEventListener("dashboard-primary-action", handlePrimaryAction);
    return () =>
      window.removeEventListener(
        "dashboard-primary-action",
        handlePrimaryAction,
      );
  });

  const openEdit = (service: Service) => {
    setEditingId(service.id);
    setForm({
      name: service.name,
      price: String(service.price),
      duration: String(service.duration),
      description: service.description,
      category:
        service.category.trim().toLowerCase() === "services"
          ? ""
          : service.category,
      image: service.image,
      departmentId: service.departmentId ?? "",
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
    if (!form.category.trim()) {
      setError("Choose a category for this service.");
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
      departmentId: canAssignDepartments
        ? form.departmentId || undefined
        : undefined,
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

      // The catalog is ordered alphabetically, so return to page one after
      // creation. Edits refresh the current filtered page.
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
    <div className="products-page min-h-full space-y-4 p-3 text-white light:text-[#14213a] sm:p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-extrabold tracking-[-0.04em] text-white light:text-[#17223a]">
            Services
          </h2>
          <p className="mt-0.5 text-[12px] text-slate-400 light:text-[#71809a]">
            {pagination.total} service{pagination.total === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {isBusinessAdmin && (
            <Button
              onClick={() => {
                setShowCategories(true);
                setCategoryName("");
                setCategoryPosition(String(categoryOnlyItems.length + 1));
                setEditingCategoryId(null);
                setError("");
              }}
              variant="outline"
              size="sm"
              className="hidden h-10 px-4 md:inline-flex"
            >
              <FolderTree className="h-4 w-4" /> Manage Categories
            </Button>
          )}
          <Button
            onClick={openAdd}
            size="sm"
            className="product-action-button hidden h-10 bg-violet-600 px-4 text-white hover:bg-violet-700 md:inline-flex"
          >
            <Plus className="h-4 w-4" /> Add Service
          </Button>
        </div>
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
      <div className="flex flex-col gap-3 md:flex-row">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchInput}
            maxLength={120}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search services..."
            className="product-search h-10 w-full rounded-xl border pl-9 pr-3 text-[11px] text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30 light:text-gray-900 light:placeholder:text-gray-400"
          />
        </div>

        <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
          <button
            type="button"
            onClick={() => {
              setCategory("all");
              setPage(0);
            }}
            className={cn(
              "filter-pill shrink-0 rounded-lg px-3 py-2 text-[10px] font-semibold transition-colors",
              category === "all" && "bg-violet-600 text-white",
            )}
          >
            All
          </button>
          {filterCategories.map((categoryName) => (
            <button
              type="button"
              key={categoryName}
              onClick={() => {
                setCategory(categoryName);
                setPage(0);
              }}
              className={cn(
                "filter-pill shrink-0 rounded-lg px-3 py-2 text-[10px] font-semibold transition-colors",
                category === categoryName && "bg-violet-600 text-white",
              )}
            >
              {categoryName}
            </button>
          ))}
          {(
            [
              [true, "Live"],
              [false, "Paused"],
            ] as const
          ).map(([value, label]) => (
            <button
              type="button"
              key={String(value)}
              onClick={() => {
                setAvailability((current) =>
                  current === value ? "all" : value,
                );
                setPage(0);
              }}
              className={cn(
                "filter-pill shrink-0 rounded-lg px-3 py-2 text-[10px] font-semibold transition-colors",
                availability === value && "bg-violet-600 text-white",
              )}
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

      {!isLoading && services.length > 0 && (
        <div className="products-grid grid grid-cols-2 gap-2.5 sm:gap-x-3 sm:gap-y-4 lg:grid-cols-3">
          {services.map((service) => (
            <ServiceCatalogCard
              key={service.id}
              service={service}
              onEdit={openEdit}
              onToggle={toggle}
              onDelete={del}
            />
          ))}
        </div>
      )}

      {!isLoading && pagination.total > 0 && (
        <div className="pagination-panel flex flex-col gap-3 rounded-xl border px-4 py-3 text-[10px] text-slate-400 light:text-slate-600 sm:flex-row sm:items-center sm:justify-between">
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
          <Select
            label="Category"
            value={form.category}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                category: event.target.value,
              }))
            }
            options={[
              {
                value: "",
                label:
                  categoryOnlyItems.length > 0
                    ? "Choose a category"
                    : "Add a category first",
              },
              ...categoryOnlyItems.map((item) => ({
                value: item.name,
                label: item.name,
              })),
            ]}
          />
          {canAssignDepartments ? (
            <Select
              label="Department (optional)"
              value={form.departmentId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  departmentId: event.target.value,
                }))
              }
              options={[
                { value: "", label: "No department" },
                ...departments
                  .filter(
                    (item) => item.isActive || item.id === form.departmentId,
                  )
                  .map((item) => ({
                    value: item.id,
                    label: item.isActive
                      ? item.name
                      : `${item.name} (inactive)`,
                  })),
              ]}
            />
          ) : !canUseDepartments ? (
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-3 text-xs text-slate-400 light:border-slate-200 light:bg-slate-50 light:text-slate-600">
              Department assignment becomes available with a multi-seat
              subscription. Categories remain available on every plan.
            </div>
          ) : (
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-3 text-xs text-slate-400 light:border-slate-200 light:bg-slate-50 light:text-slate-600">
              Only the business owner or admin can assign a service to a
              department.
            </div>
          )}
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

      <Modal
        open={showCategories}
        onClose={() => setShowCategories(false)}
        title="Manage Service Categories"
        footer={
          <Button variant="outline" onClick={() => setShowCategories(false)}>
            Close
          </Button>
        }
      >
        <div className="space-y-4">
          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400 light:text-red-700">
              {error}
            </p>
          )}
          <p className="text-xs text-slate-400 light:text-slate-600">
            Create and organize the categories used to group your services.
          </p>
          <div className="grid grid-cols-[minmax(0,1fr)_7rem_auto] items-end gap-2">
            <Input
              label={editingCategoryId ? "Category name" : "New category"}
              placeholder="Haircuts, Nails, Skincare..."
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void saveCategory();
              }}
            />
            <Input
              label="Position"
              type="number"
              min="1"
              step="1"
              value={categoryPosition}
              onChange={(event) => setCategoryPosition(event.target.value)}
            />
            <Button
              type="button"
              loading={isSavingCategory}
              onClick={() => void saveCategory()}
              className="mb-px shrink-0"
            >
              {editingCategoryId ? "Save" : "Add"}
            </Button>
          </div>
          {editingCategoryId && (
            <button
              type="button"
              className="text-xs font-semibold text-slate-400 hover:text-white light:hover:text-slate-900"
              onClick={() => {
                setEditingCategoryId(null);
                setCategoryName("");
                setCategoryPosition(
                  String(Math.max(1, categoryOnlyItems.length + 1)),
                );
              }}
            >
              Cancel rename
            </button>
          )}
          <div className="divide-y divide-slate-700 rounded-xl border border-slate-700 light:divide-slate-200 light:border-slate-200">
            {categoryOnlyItems.length === 0 ? (
              <p className="p-4 text-center text-xs text-slate-500">
                No categories yet. Add the first category above.
              </p>
            ) : (
              categoryOnlyItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 p-3"
                >
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-white light:text-slate-900">
                      {item.name}
                    </span>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      Position {item.sortOrder + 1}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => {
                        setEditingCategoryId(item.id);
                        setCategoryName(item.name);
                        setCategoryPosition(String(item.sortOrder + 1));
                      }}
                    >
                      <Edit2 className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      className="text-red-400 hover:bg-red-500/10"
                      onClick={() => void removeCategory(item)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ServiceCatalogCard({
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
    <Card className="product-card group flex h-full flex-col overflow-hidden">
      <div className="relative aspect-[8/5] overflow-hidden bg-slate-700 light:bg-slate-100">
        {service.image ? (
          // Tenant-configured image URLs can use arbitrary hosts, so a native
          // image is retained instead of restricting them through next/image.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={service.image}
            alt={service.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-500">
            <Clock className="h-10 w-10" />
          </div>
        )}
        <div className="absolute right-2 top-2">
          <Badge
            variant={service.isActive ? "success" : "default"}
            className={cn(
              "product-state-badge border-0 px-2 py-1 text-[9px] text-white shadow-sm",
              service.isActive ? "is-live" : "is-paused",
            )}
          >
            {service.isActive ? "Live" : "Paused"}
          </Badge>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-2.5 sm:p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="line-clamp-2 text-[11px] font-bold leading-tight text-white light:text-gray-900 sm:text-sm">
              {service.name}
            </h4>
            <p className="mt-1.5 line-clamp-3 min-h-10 text-[9px] leading-[1.4] text-slate-400 light:text-gray-600 sm:text-[10px]">
              {service.description}
            </p>
          </div>
          <span className="shrink-0 text-[10px] font-black text-white light:text-gray-900 sm:text-sm">
            {formatCurrency(service.price)}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="max-w-[55%] truncate rounded-full bg-slate-700 px-2.5 py-1 text-[9px] text-slate-300 light:bg-violet-100 light:text-violet-800 sm:text-[10px]">
            {service.category.trim().toLowerCase() === "services"
              ? "Uncategorized"
              : service.category || "Uncategorized"}
          </span>
          <span className="flex shrink-0 items-center gap-1 text-[9px] font-semibold text-slate-400 light:text-gray-500 sm:text-[10px]">
            <Clock className="h-3.5 w-3.5" />
            {formatDuration(service.duration)}
          </span>
        </div>
        {service.requiresDeposit && (
          <div className="mt-2 flex items-center gap-1 rounded-lg bg-violet-500/10 px-2.5 py-1.5 text-[9px] text-violet-300 light:bg-violet-50 light:text-violet-700 sm:text-[10px]">
            <Shield className="h-3.5 w-3.5" />
            Deposit:{" "}
            {service.depositType === "fixed"
              ? formatCurrency(service.depositAmount ?? 0)
              : `${service.depositAmount}%`}
          </div>
        )}
        <div className="mt-auto flex items-center gap-1 border-t border-slate-700 pt-2.5 light:border-slate-200">
          <Button
            variant="ghost"
            size="xs"
            className="flex-1 justify-center px-1 text-[10px] text-violet-300 hover:bg-violet-500/10 light:text-violet-700 light:hover:bg-violet-50 sm:px-2.5 sm:text-[11px]"
            onClick={() => onEdit(service)}
          >
            <Edit2 className="mr-1 h-3.5 w-3.5" /> Edit
          </Button>
          <div className="h-5 w-px bg-slate-700 light:bg-slate-200" />
          <Button
            variant="ghost"
            size="xs"
            className="text-red-400 hover:bg-red-500/10 hover:text-red-300 light:text-red-600 light:hover:bg-red-50 light:hover:text-red-800"
            onClick={() => onDelete(service.id)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          <div className="h-5 w-px bg-slate-700 light:bg-slate-200" />
          <button
            type="button"
            onClick={() => onToggle(service.id)}
            className="product-toggle-button transition-transform active:scale-95"
            aria-label={
              service.isActive
                ? `Pause ${service.name}`
                : `Publish ${service.name}`
            }
          >
            <span
              className={cn(
                "product-toggle-track",
                service.isActive && "is-active",
              )}
              aria-hidden="true"
            >
              <span className="product-toggle-knob" />
            </span>
          </button>
        </div>
      </div>
    </Card>
  );
}
