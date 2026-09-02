"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { BellRing, Copy, Download, Percent, Plus, QrCode, Tags, Users } from "lucide-react";
import { Button } from "@/app/components/Button";
import { Card, CardBody, CardHeader } from "@/app/components/Card";
import { Input, Select, Textarea } from "@/app/components/input";
import { Modal } from "@/app/components/Modal";
import { listProducts } from "@/app/services/productService";
import { listServices } from "@/app/services/serviceService";
import {
  assignServiceDepartment, createDepartment, getReminderSettings, listAppointmentReminders,
  listDepartments, listPromotions, listServiceProviders, savePromotion, saveReminderSettings,
  saveServiceProvider, setDepartmentActive, setPromotionActive,
  type AppointmentReminder, type Promotion, type ProviderAvailability, type ReminderSettings,
  type ServiceDepartment, type ServiceProvider,
} from "@/app/services/businessToolsService";
import type { Product, Service, Tenant } from "@/app/types/index";

type ToolTab = "providers" | "departments" | "promotions" | "reminders" | "qr";
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DEFAULT_AVAILABILITY: ProviderAvailability[] = DAYS.map((_, dayOfWeek) => ({ dayOfWeek, startTime: "09:00", endTime: "17:00", isAvailable: dayOfWeek > 0 && dayOfWeek < 6 }));

function emptyProvider(): Omit<ServiceProvider, "tenantId"> {
  return { id: "", name: "", email: "", phone: "", bio: "", color: "#8b5cf6", isActive: true, serviceIds: [], availability: DEFAULT_AVAILABILITY };
}

function emptyPromotion(): Omit<Promotion, "tenantId" | "usageCount"> {
  return { id: "", code: "", name: "", discountType: "PERCENTAGE", discountValue: 10, startsAt: "", endsAt: "", usageLimit: null, applicableProductIds: [], applicableServiceIds: [], isActive: true };
}

export function BusinessToolsView({ tenant }: { tenant: Tenant }) {
  const isAppointment = tenant.businessType === "appointment";
  const [tab, setTab] = useState<ToolTab>(isAppointment ? "providers" : "promotions");
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [departments, setDepartments] = useState<ServiceDepartment[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>({ enabled: true, minutes: [1440, 120] });
  const [reminders, setReminders] = useState<AppointmentReminder[]>([]);
  const [providerForm, setProviderForm] = useState<ReturnType<typeof emptyProvider> | null>(null);
  const [promotionForm, setPromotionForm] = useState<ReturnType<typeof emptyPromotion> | null>(null);
  const [departmentForm, setDepartmentForm] = useState({ name: "", description: "" });
  const [qrData, setQrData] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const storefrontUrl = useMemo(() => typeof window === "undefined" ? `/store-front/${tenant.slug}` : `${window.location.origin}/store-front/${tenant.slug}`, [tenant.slug]);
  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const [promotionData, inventory] = await Promise.all([listPromotions(tenant.id), isAppointment ? listServices(tenant.id) : listProducts(tenant.id)]);
      setPromotions(promotionData);
      if (isAppointment) {
        setServices(inventory as Service[]);
        const [providerData, departmentData, settings, reminderData] = await Promise.all([listServiceProviders(tenant.id), listDepartments(tenant.id), getReminderSettings(tenant.id), listAppointmentReminders(tenant.id)]);
        setProviders(providerData); setDepartments(departmentData); setReminderSettings(settings); setReminders(reminderData);
      } else setProducts(inventory as Product[]);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load business tools. Apply the business growth migration in Supabase.");
    } finally { setIsLoading(false); }
  }, [isAppointment, tenant.id]);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => { QRCode.toDataURL(storefrontUrl, { width: 640, margin: 2, color: { dark: "#111827", light: "#ffffff" } }).then(setQrData).catch(() => setError("Unable to generate the QR code.")); }, [storefrontUrl]);

  const done = (value: string) => { setMessage(value); window.setTimeout(() => setMessage(""), 3500); };
  const saveProvider = async () => {
    if (!providerForm?.name.trim()) return setError("Provider name is required.");
    setIsSaving(true); setError("");
    try { await saveServiceProvider(tenant.id, providerForm); setProviderForm(null); await reload(); done("Service provider saved."); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Unable to save provider."); }
    finally { setIsSaving(false); }
  };
  const saveDiscount = async () => {
    if (!promotionForm?.code.trim() || !promotionForm.name.trim() || promotionForm.discountValue <= 0) return setError("Code, name, and a positive discount are required.");
    setIsSaving(true); setError("");
    try { await savePromotion(tenant.id, promotionForm); setPromotionForm(null); await reload(); done("Promotion saved."); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Unable to save promotion."); }
    finally { setIsSaving(false); }
  };
  const tabs = [
    ...(isAppointment ? [{ id: "providers" as const, label: "Providers", icon: Users }, { id: "departments" as const, label: "Departments", icon: Tags }] : []),
    { id: "promotions" as const, label: "Promotions", icon: Percent },
    ...(isAppointment ? [{ id: "reminders" as const, label: "Reminders", icon: BellRing }] : []),
    { id: "qr" as const, label: "QR Storefront", icon: QrCode },
  ];

  return (
    <div className="min-h-full space-y-4 bg-[#08111f] p-4 text-white light:bg-[#f8fafc] light:text-[#14213a] md:p-5">
      <div><h2 className="text-sm font-bold">Business Tools</h2><p className="mt-1 text-[10px] text-slate-400">Owner-controlled growth and operations for {tenant.name}.</p></div>
      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300 light:text-red-700">{error}</div>}
      {message && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300 light:text-emerald-700">{message}</div>}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTab(id)} className={`flex min-h-11 flex-none items-center gap-2 rounded-xl px-4 text-xs font-semibold ${tab === id ? "bg-violet-600 text-white" : "border border-slate-700 bg-slate-900/60 text-slate-300 light:border-slate-200 light:bg-white light:text-slate-600"}`}><Icon className="h-4 w-4" />{label}</button>)}
      </div>
      {isLoading ? <p className="py-10 text-center text-xs text-slate-400">Loading business tools…</p> : (
        <>
          {tab === "providers" && <Card><CardHeader><div><h3 className="text-sm font-bold">Team / Service Providers</h3><p className="mt-1 text-[10px] text-slate-400">Optional for solo businesses. Providers do not require a login.</p></div><Button size="sm" onClick={() => setProviderForm(emptyProvider())}><Plus className="h-3 w-3" /> Add provider</Button></CardHeader><CardBody className="grid gap-3 md:grid-cols-2">
            {providers.length === 0 && <p className="py-8 text-xs text-slate-400 md:col-span-2">No providers configured. Bookings continue using your normal business availability.</p>}
            {providers.map((provider) => <button key={provider.id} onClick={() => setProviderForm({ ...provider, availability: provider.availability.length ? provider.availability : DEFAULT_AVAILABILITY })} className="rounded-xl border border-slate-700 p-4 text-left light:border-slate-200"><div className="flex items-center gap-3"><span className="h-9 w-9 rounded-full" style={{ backgroundColor: provider.color }} /><div><p className="text-xs font-bold">{provider.name}</p><p className="text-[10px] text-slate-400">{provider.serviceIds.length} assigned service{provider.serviceIds.length === 1 ? "" : "s"} · {provider.isActive ? "Active" : "Inactive"}</p></div></div></button>)}
          </CardBody></Card>}

          {tab === "departments" && <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"><Card><CardHeader><h3 className="text-sm font-bold">Add Department</h3></CardHeader><CardBody className="space-y-3"><Input label="Name" placeholder="Hair, Barbering, Nails…" value={departmentForm.name} onChange={(event) => setDepartmentForm({ ...departmentForm, name: event.target.value })} /><Textarea label="Description" rows={3} value={departmentForm.description} onChange={(event) => setDepartmentForm({ ...departmentForm, description: event.target.value })} /><Button disabled={!departmentForm.name.trim()} onClick={() => void createDepartment(tenant.id, departmentForm.name, departmentForm.description).then(() => { setDepartmentForm({ name: "", description: "" }); return reload(); }).then(() => done("Department added.")).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to add department."))}>Add department</Button></CardBody></Card>
            <Card><CardHeader><h3 className="text-sm font-bold">Organize Services</h3></CardHeader><CardBody className="space-y-3">{services.map((service) => <div key={service.id} className="grid gap-2 rounded-xl border border-slate-700 p-3 light:border-slate-200 sm:grid-cols-[1fr_180px]"><div><p className="text-xs font-semibold">{service.name}</p><p className="text-[10px] text-slate-400">Current: {service.category}</p></div><select aria-label={`Department for ${service.name}`} value={departments.find((item) => item.name === service.category)?.id ?? ""} onChange={(event) => { const department = departments.find((item) => item.id === event.target.value) ?? null; void assignServiceDepartment(tenant.id, service.id, department).then(reload).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to assign department.")); }} className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs light:bg-white"><option value="">Unassigned</option>{departments.filter((item) => item.isActive).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></div>)}
              <div className="border-t border-slate-700 pt-3 light:border-slate-200">{departments.map((department) => <div key={department.id} className="flex items-center justify-between py-2"><span className="text-xs">{department.name}</span><button onClick={() => void setDepartmentActive(tenant.id, department.id, !department.isActive).then(reload)} className="text-[10px] font-semibold text-violet-400">{department.isActive ? "Deactivate" : "Activate"}</button></div>)}</div>
            </CardBody></Card></div>}

          {tab === "promotions" && <Card><CardHeader><div><h3 className="text-sm font-bold">Promotions & Discount Codes</h3><p className="mt-1 text-[10px] text-slate-400">Checkout validates every code securely in Supabase.</p></div><Button size="sm" onClick={() => setPromotionForm(emptyPromotion())}><Plus className="h-3 w-3" /> Add promotion</Button></CardHeader><CardBody className="grid gap-3 md:grid-cols-2">{promotions.length === 0 && <p className="py-8 text-xs text-slate-400 md:col-span-2">No promotions yet.</p>}{promotions.map((promotion) => <div key={promotion.id} className="rounded-xl border border-slate-700 p-4 light:border-slate-200"><div className="flex justify-between gap-3"><div><p className="text-sm font-bold text-violet-400">{promotion.code}</p><p className="text-xs">{promotion.name}</p></div><span className="text-xs font-bold">{promotion.discountType === "PERCENTAGE" ? `${promotion.discountValue}%` : `$${promotion.discountValue.toFixed(2)}`}</span></div><p className="mt-3 text-[10px] text-slate-400">Used {promotion.usageCount}{promotion.usageLimit ? ` of ${promotion.usageLimit}` : " times"}</p><div className="mt-3 flex gap-3"><button className="text-[10px] font-semibold text-violet-400" onClick={() => setPromotionForm({ id: promotion.id, code: promotion.code, name: promotion.name, discountType: promotion.discountType, discountValue: promotion.discountValue, startsAt: promotion.startsAt, endsAt: promotion.endsAt, usageLimit: promotion.usageLimit, applicableProductIds: promotion.applicableProductIds, applicableServiceIds: promotion.applicableServiceIds, isActive: promotion.isActive })}>Edit</button><button className="text-[10px] font-semibold text-violet-400" onClick={() => void setPromotionActive(tenant.id, promotion.id, !promotion.isActive).then(reload)}>{promotion.isActive ? "Deactivate" : "Activate"}</button></div></div>)}</CardBody></Card>}

          {tab === "reminders" && <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><h3 className="text-sm font-bold">Appointment Reminder Rules</h3></CardHeader><CardBody className="space-y-4"><label className="flex items-center gap-3 text-xs"><input type="checkbox" checked={reminderSettings.enabled} onChange={(event) => setReminderSettings({ ...reminderSettings, enabled: event.target.checked })} className="h-4 w-4 accent-violet-600" />Schedule reminders when appointments are confirmed</label><div><p className="mb-2 text-xs font-semibold">Send before appointment</p>{[{ value: 2880, label: "48 hours" }, { value: 1440, label: "24 hours" }, { value: 120, label: "2 hours" }, { value: 60, label: "1 hour" }].map((option) => <label key={option.value} className="mr-4 inline-flex items-center gap-2 py-2 text-xs"><input type="checkbox" checked={reminderSettings.minutes.includes(option.value)} onChange={(event) => setReminderSettings({ ...reminderSettings, minutes: event.target.checked ? [...reminderSettings.minutes, option.value] : reminderSettings.minutes.filter((value) => value !== option.value) })} className="accent-violet-600" />{option.label}</label>)}</div><Button onClick={() => void saveReminderSettings(tenant.id, reminderSettings).then(() => done("Reminder settings saved.")).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to save reminders."))}>Save reminder settings</Button><p className="text-[10px] leading-4 text-slate-400">Reminder rows are securely scheduled and tracked. Connect your chosen email/SMS provider to process pending deliveries.</p></CardBody></Card><Card><CardHeader><h3 className="text-sm font-bold">Recent Reminder Status</h3></CardHeader><CardBody className="space-y-2">{reminders.length === 0 ? <p className="py-8 text-xs text-slate-400">No reminders scheduled yet.</p> : reminders.map((reminder) => <div key={reminder.id} className="flex items-center justify-between rounded-lg border border-slate-700 px-3 py-2 text-[10px] light:border-slate-200"><div><p>{new Date(reminder.dueAt).toLocaleString()}</p><p className="text-slate-400">{reminder.reminderMinutes} minutes before · {reminder.channel}</p></div><span className="rounded-full bg-violet-500/15 px-2 py-1 text-violet-300">{reminder.status}</span></div>)}</CardBody></Card></div>}

          {tab === "qr" && <Card><CardHeader><div><h3 className="text-sm font-bold">QR Storefront</h3><p className="mt-1 text-[10px] text-slate-400">Download for signs, menus, cards, and social posts.</p></div></CardHeader><CardBody><div className="mx-auto flex max-w-xl flex-col items-center gap-5 text-center">{qrData && <Image unoptimized width={224} height={224} src={qrData} alt={`QR code for ${tenant.name} storefront`} className="h-56 w-56 rounded-2xl bg-white p-3" />}<div className="w-full rounded-xl border border-slate-700 px-3 py-3 text-left text-[10px] text-slate-400 light:border-slate-200">{storefrontUrl}</div><div className="flex flex-wrap justify-center gap-2"><Button variant="outline" onClick={() => void navigator.clipboard.writeText(storefrontUrl).then(() => done("Storefront link copied."))}><Copy className="h-4 w-4" /> Copy link</Button><Button disabled={!qrData} onClick={() => { const link = document.createElement("a"); link.href = qrData; link.download = `${tenant.slug}-storefront-qr.png`; link.click(); }}><Download className="h-4 w-4" /> Download PNG</Button></div></div></CardBody></Card>}
        </>
      )}

      <Modal open={!!providerForm} onClose={() => setProviderForm(null)} title={providerForm?.id ? "Edit Service Provider" : "Add Service Provider"} maxWidth="max-w-2xl" footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setProviderForm(null)}>Cancel</Button><Button loading={isSaving} onClick={() => void saveProvider()}>Save provider</Button></div>}>
        {providerForm && <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2"><Input label="Display name" value={providerForm.name} onChange={(event) => setProviderForm({ ...providerForm, name: event.target.value })} /><Input label="Email (private, optional)" type="email" value={providerForm.email} onChange={(event) => setProviderForm({ ...providerForm, email: event.target.value })} /><Input label="Phone (private, optional)" value={providerForm.phone} onChange={(event) => setProviderForm({ ...providerForm, phone: event.target.value })} /><Input label="Calendar color" type="color" value={providerForm.color} onChange={(event) => setProviderForm({ ...providerForm, color: event.target.value })} /></div><Textarea label="Public bio" rows={3} value={providerForm.bio} onChange={(event) => setProviderForm({ ...providerForm, bio: event.target.value })} /><div><p className="mb-2 text-xs font-semibold">Assigned services</p><div className="grid gap-2 sm:grid-cols-2">{services.map((service) => <label key={service.id} className="flex items-center gap-2 rounded-lg border border-slate-700 p-2 text-xs light:border-slate-200"><input type="checkbox" checked={providerForm.serviceIds.includes(service.id)} onChange={(event) => setProviderForm({ ...providerForm, serviceIds: event.target.checked ? [...providerForm.serviceIds, service.id] : providerForm.serviceIds.filter((id) => id !== service.id) })} className="accent-violet-600" />{service.name}</label>)}</div></div><div><p className="mb-2 text-xs font-semibold">Weekly schedule</p><div className="space-y-2">{providerForm.availability.map((day, index) => <div key={day.dayOfWeek} className="grid grid-cols-[90px_1fr_1fr] items-center gap-2"><label className="flex items-center gap-2 text-[11px]"><input type="checkbox" checked={day.isAvailable} onChange={(event) => { const next = [...providerForm.availability]; next[index] = { ...day, isAvailable: event.target.checked }; setProviderForm({ ...providerForm, availability: next }); }} className="accent-violet-600" />{DAYS[day.dayOfWeek].slice(0, 3)}</label><input aria-label={`${DAYS[day.dayOfWeek]} start`} type="time" disabled={!day.isAvailable} value={day.startTime} onChange={(event) => { const next = [...providerForm.availability]; next[index] = { ...day, startTime: event.target.value }; setProviderForm({ ...providerForm, availability: next }); }} className="min-w-0 rounded-lg border border-slate-600 bg-slate-800 p-2 text-xs light:bg-white" /><input aria-label={`${DAYS[day.dayOfWeek]} end`} type="time" disabled={!day.isAvailable} value={day.endTime} onChange={(event) => { const next = [...providerForm.availability]; next[index] = { ...day, endTime: event.target.value }; setProviderForm({ ...providerForm, availability: next }); }} className="min-w-0 rounded-lg border border-slate-600 bg-slate-800 p-2 text-xs light:bg-white" /></div>)}</div></div><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={providerForm.isActive} onChange={(event) => setProviderForm({ ...providerForm, isActive: event.target.checked })} className="accent-violet-600" />Active and bookable</label></div>}
      </Modal>

      <Modal open={!!promotionForm} onClose={() => setPromotionForm(null)} title={promotionForm?.id ? "Edit Promotion" : "Add Promotion"} maxWidth="max-w-2xl" footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setPromotionForm(null)}>Cancel</Button><Button loading={isSaving} onClick={() => void saveDiscount()}>Save promotion</Button></div>}>
        {promotionForm && <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><Input label="Code" placeholder="WELCOME10" value={promotionForm.code} onChange={(event) => setPromotionForm({ ...promotionForm, code: event.target.value.toUpperCase().replace(/\s/g, "") })} /><Input label="Name" value={promotionForm.name} onChange={(event) => setPromotionForm({ ...promotionForm, name: event.target.value })} /><Select label="Discount type" value={promotionForm.discountType} onChange={(event) => setPromotionForm({ ...promotionForm, discountType: event.target.value as "PERCENTAGE" | "FIXED" })} options={[{ value: "PERCENTAGE", label: "Percentage" }, { value: "FIXED", label: "Fixed BZD amount" }]} /><Input label="Discount value" type="number" min="0.01" max={promotionForm.discountType === "PERCENTAGE" ? 100 : undefined} step="0.01" value={promotionForm.discountValue} onChange={(event) => setPromotionForm({ ...promotionForm, discountValue: Number(event.target.value) })} /><Input label="Starts (optional)" type="datetime-local" value={promotionForm.startsAt?.slice(0, 16)} onChange={(event) => setPromotionForm({ ...promotionForm, startsAt: event.target.value ? new Date(event.target.value).toISOString() : "" })} /><Input label="Ends (optional)" type="datetime-local" value={promotionForm.endsAt?.slice(0, 16)} onChange={(event) => setPromotionForm({ ...promotionForm, endsAt: event.target.value ? new Date(event.target.value).toISOString() : "" })} /><Input label="Usage limit (blank = unlimited)" type="number" min="1" value={promotionForm.usageLimit ?? ""} onChange={(event) => setPromotionForm({ ...promotionForm, usageLimit: event.target.value ? Number(event.target.value) : null })} /></div><div><p className="mb-2 text-xs font-semibold">Applies to (none selected = entire storefront)</p><div className="max-h-48 space-y-2 overflow-y-auto">{(isAppointment ? services : products).map((item) => { const key = isAppointment ? "applicableServiceIds" : "applicableProductIds"; const selected = promotionForm[key].includes(item.id); return <label key={item.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={selected} onChange={(event) => setPromotionForm({ ...promotionForm, [key]: event.target.checked ? [...promotionForm[key], item.id] : promotionForm[key].filter((id) => id !== item.id) })} className="accent-violet-600" />{item.name}</label>; })}</div></div><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={promotionForm.isActive} onChange={(event) => setPromotionForm({ ...promotionForm, isActive: event.target.checked })} className="accent-violet-600" />Active</label></div>}
      </Modal>
    </div>
  );
}
