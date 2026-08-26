"use client";

import { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Clock, Shield } from "lucide-react";
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
import type { Service, Tenant } from "../types/index";

interface Props { tenant: Tenant }

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
  const [services, setServices] = useState<Service[]>(
    isSupabaseConfigured() ? [] : getServicesByTenant(tenant.id),
  );
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured());
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      const frame = window.requestAnimationFrame(() => {
        const stored = getStoredServices(tenant.id);
        if (stored) setServices(stored);
        setIsLoading(false);
      });
      return () => window.cancelAnimationFrame(frame);
    }

    let active = true;
    listServices(tenant.id)
      .then((loaded) => {
        if (!active) return;
        setServices(loaded);
        setError("");
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load services.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [tenant.id]);

  const categories = [...new Set(services.map(s => s.category))];

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
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
      depositAmount: service.depositAmount == null ? "" : String(service.depositAmount),
    });
    setError("");
    setSuccess("");
    setShowAdd(true);
  };

  const toggle = async (id: string) => {
    const current = services.find((service) => service.id === id);
    if (!current) return;
    const updated = services.map((service) =>
      service.id === id ? { ...service, isActive: !service.isActive } : service,
    );
    setServices(updated);
    setError("");

    try {
      if (isSupabaseConfigured()) {
        await setServiceAvailability(tenant.id, id, !current.isActive);
      } else {
        setStoredServices(tenant.id, updated);
      }
    } catch (updateError) {
      setServices(services);
      setError(updateError instanceof Error ? updateError.message : "Unable to update service.");
    }
  };

  const del = async (id: string) => {
    if (!window.confirm("Delete this service? This cannot be undone.")) return;
    const previous = services;
    const updated = services.filter((service) => service.id !== id);
    setServices(updated);
    setError("");

    try {
      if (isSupabaseConfigured()) await deleteService(tenant.id, id);
      else setStoredServices(tenant.id, updated);
    } catch (deleteError) {
      setServices(previous);
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete service.");
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
    if (!Number.isFinite(duration) || duration <= 0) {
      setError("Enter a valid service duration.");
      return;
    }
    if (form.requiresDeposit && (!Number.isFinite(depositAmount) || depositAmount < 0)) {
      setError("Enter a valid deposit amount.");
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
      if (isSupabaseConfigured()) {
        saved = editingId
          ? await updateService(tenant.id, editingId, input)
          : await createService(tenant.id, input);
      } else {
        saved = editingId
          ? { ...services.find((service) => service.id === editingId)!, ...input }
          : {
              id: `service-${Date.now()}`,
              tenantId: tenant.id,
              ...input,
              category: input.category || "Services",
              isActive: true,
              createdAt: new Date().toISOString(),
            };
      }

      const updated = editingId
        ? services.map((service) => (service.id === editingId ? saved : service))
        : [...services, saved];
      setServices(updated);
      if (!isSupabaseConfigured()) setStoredServices(tenant.id, updated);
      setShowAdd(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      setSuccess(editingId ? "Service updated." : "Service created.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save service.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen space-y-4 bg-[#08111f] light:bg-[#f8fafc] p-4 text-white light:text-[#14213a] md:p-5">
      <div className="flex items-center justify-end">
        <div className="sr-only">
          <h2 className="text-sm font-bold text-white light:text-[#17223a]">Services</h2>
          <p className="mt-0.5 text-[10px] text-slate-400 light:text-[#71809a]">
            {services.filter(s => s.isActive).length} active · {services.length} total
          </p>
        </div>
        <Button onClick={openAdd} size="sm">
          <Plus className="w-4 h-4" /> Add Service
        </Button>
      </div>

      {error && <p className="rounded-lg bg-red-500/10 px-4 py-3 text-xs text-red-400 light:text-red-700">{error}</p>}
      {success && <p className="rounded-lg bg-emerald-500/10 px-4 py-3 text-xs text-emerald-500 light:text-emerald-700">{success}</p>}
      {isLoading && <p className="text-xs text-slate-500">Loading services from Supabase...</p>}

      {!isLoading && services.length === 0 && (
        <Card className="p-12 text-center text-xs text-slate-500">
          No services yet. Add the first service for your storefront.
        </Card>
      )}

      {categories.map(cat => (
        <div key={cat} className="space-y-3">
          <h3 className="text-[10px] font-bold text-slate-400 light:text-slate-500 uppercase tracking-wider">{cat}</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {services.filter(s => s.category === cat).map(svc => (
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

      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title={editingId ? "Edit Service" : "Add New Service"}
        footer={
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowAdd(false)} className="flex-1">Cancel</Button>
            <Button loading={isSaving} onClick={save} className="flex-1">
              {isSaving ? "Saving..." : editingId ? "Update Service" : "Save Service"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Service Name"
            placeholder="e.g. Deep Tissue Massage"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Price ($)" type="number" min="0" step="0.01" placeholder="0.00" value={form.price}
              onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} />
            <Input label="Duration (min)" type="number" min="1" placeholder="60" value={form.duration}
              onChange={(event) => setForm((current) => ({ ...current, duration: event.target.value }))} />
          </div>
          <Textarea label="Description" rows={3} placeholder="Describe the service..." value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          <Input label="Category" placeholder="Hair, Nails, Skincare..." value={form.category}
            onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} />
          <Input label="Image URL" placeholder="https://..." value={form.image}
            onChange={(event) => setForm((current) => ({ ...current, image: event.target.value }))} />
          <div className="flex items-center gap-3 p-3 bg-violet-50 rounded-xl">
            <input type="checkbox" id="deposit" checked={form.requiresDeposit}
              onChange={(event) => setForm((current) => ({ ...current, requiresDeposit: event.target.checked }))}
              className="w-4 h-4 accent-violet-600" />
            <label htmlFor="deposit" className="text-sm font-medium text-slate-700">
              Require deposit for this service
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Deposit Type"
              value={form.depositType}
              onChange={(event) => setForm((current) => ({
                ...current,
                depositType: event.target.value as "fixed" | "percentage",
              }))}
              options={[{ value: "fixed", label: "Fixed Amount" }, { value: "percentage", label: "Percentage" }]}
            />
            <Input label="Amount" type="number" min="0" placeholder="25" value={form.depositAmount}
              onChange={(event) => setForm((current) => ({ ...current, depositAmount: event.target.value }))} />
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ServiceCard({ service, onEdit, onToggle, onDelete }: {
  service: Service;
  onEdit: (service: Service) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card className="group max-w-[270px] overflow-hidden">
      <div className="relative h-32 overflow-hidden bg-slate-800 light:bg-slate-100">
        {service.image ? (
          <img
            src={service.image} alt={service.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-500">
            <Clock className="h-10 w-10" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        <div className="absolute top-3 right-3">
          <Badge variant={service.isActive ? "success" : "default"}>
            {service.isActive ? "Active" : "Off"}
          </Badge>
        </div>
      </div>
      <div className="space-y-3 p-3.5">
        <div>
          <h4 className="text-xs font-semibold text-white light:text-[#17223a]">{service.name}</h4>
          <p className="mt-1 line-clamp-2 text-[10px] text-slate-400 light:text-[#71809a]">{service.description}</p>
        </div>
        <div className="flex items-center gap-4 text-[10px]">
          <span className="flex items-center gap-1.5 text-slate-300 light:text-[#566681]">
            <Clock className="w-3.5 h-3.5" />
            {formatDuration(service.duration)}
          </span>
          <span className="text-xs font-bold text-white light:text-[#17223a]">{formatCurrency(service.price)}</span>
          {service.requiresDeposit && (
            <span className="flex items-center gap-1 text-violet-600 text-xs">
              <Shield className="w-3.5 h-3.5" />
              Deposit
            </span>
          )}
        </div>
        {service.requiresDeposit && (
          <div className="bg-violet-50 rounded-lg px-3 py-1.5 text-xs text-violet-700">
            Deposit: {service.depositType === "fixed"
              ? formatCurrency(service.depositAmount ?? 0)
              : `${service.depositAmount}%`}
          </div>
        )}
        <div className="flex items-center justify-between border-t border-slate-700/60 light:border-[#edf0f5] pt-2">
          <div className="flex gap-1">
            <Button variant="ghost" size="xs" className="p-1.5" onClick={() => onEdit(service)}>
              <Edit2 className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="xs" className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50"
              onClick={() => onDelete(service.id)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
          <button onClick={() => onToggle(service.id)} className="text-slate-400 hover:text-slate-600 transition-colors">
            {service.isActive
              ? <ToggleRight className="w-6 h-6 text-emerald-500" />
              : <ToggleLeft className="w-6 h-6" />}
          </button>
        </div>
      </div>
    </Card>
  );
}
