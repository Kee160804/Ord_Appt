"use client";

import { useState } from "react";
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Clock, Shield } from "lucide-react";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Modal } from "../components/Modal";
import { Input, Textarea, Select } from "../components/input";
import { getServicesByTenant } from "../data/mock";
import { formatCurrency, formatDuration, cn } from "../lib/utils";
import type { Service, Tenant } from "../types/index";

interface Props { tenant: Tenant }

export function ServicesView({ tenant }: Props) {
  const [services, setServices] = useState<Service[]>(getServicesByTenant(tenant.id));
  const [showAdd, setShowAdd] = useState(false);

  const categories = [...new Set(services.map(s => s.category))];

  const toggle = (id: string) =>
    setServices(prev => prev.map(s => s.id === id ? { ...s, isActive: !s.isActive } : s));

  const del = (id: string) =>
    setServices(prev => prev.filter(s => s.id !== id));

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Services</h2>
          <p className="text-sm text-slate-500">
            {services.filter(s => s.isActive).length} active · {services.length} total
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="w-4 h-4" /> Add Service
        </Button>
      </div>

      {categories.map(cat => (
        <div key={cat} className="space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{cat}</h3>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {services.filter(s => s.category === cat).map(svc => (
              <ServiceCard key={svc.id} service={svc} onToggle={toggle} onDelete={del} />
            ))}
          </div>
        </div>
      ))}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add New Service"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowAdd(false)} className="flex-1">Cancel</Button>
            <Button className="flex-1">Save Service</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input label="Service Name" placeholder="e.g. Deep Tissue Massage" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Price ($)" type="number" placeholder="0.00" />
            <Input label="Duration (min)" type="number" placeholder="60" />
          </div>
          <Textarea label="Description" rows={3} placeholder="Describe the service..." />
          <Input label="Category" placeholder="Hair, Nails, Skincare..." />
          <Input label="Image URL" placeholder="https://..." />
          <div className="flex items-center gap-3 p-3 bg-violet-50 rounded-xl">
            <input type="checkbox" id="deposit" className="w-4 h-4 accent-violet-600" />
            <label htmlFor="deposit" className="text-sm font-medium text-slate-700">
              Require deposit for this service
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Deposit Type"
              options={[{ value: "fixed", label: "Fixed Amount" }, { value: "percentage", label: "Percentage" }]}
            />
            <Input label="Amount" type="number" placeholder="25" />
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ServiceCard({ service, onToggle, onDelete }: {
  service: Service;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card className="overflow-hidden group">
      <div className="relative h-36 overflow-hidden bg-slate-100">
        <img
          src={service.image} alt={service.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        <div className="absolute top-3 right-3">
          <Badge variant={service.isActive ? "success" : "default"}>
            {service.isActive ? "Active" : "Off"}
          </Badge>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <h4 className="font-semibold text-slate-900">{service.name}</h4>
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{service.description}</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5 text-slate-600">
            <Clock className="w-3.5 h-3.5" />
            {formatDuration(service.duration)}
          </span>
          <span className="font-bold text-slate-900">{formatCurrency(service.price)}</span>
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
        <div className="flex items-center justify-between pt-1 border-t border-slate-50">
          <div className="flex gap-1">
            <Button variant="ghost" size="xs" className="p-1.5"><Edit2 className="w-3.5 h-3.5" /></Button>
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