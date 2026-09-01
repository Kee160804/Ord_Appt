"use client";

import { useMemo, useState, type ComponentType } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  DollarSign,
  LayoutDashboard,
  Package,
  Plus,
  Save,
  Scissors,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import {
  getAppointmentsByTenant,
  getOrdersByTenant,
  getProductsByTenant,
  getServicesByTenant,
  mockAnalytics,
} from "@/app/data/mock";
import { cn, formatCurrency, formatDate, formatTime } from "@/app/lib/utils";
import type { Tenant } from "@/app/types";

type DemoSection = "overview" | "activity" | "catalog" | "customers" | "analytics" | "settings";

interface DemoActivity {
  id: string;
  customerName: string;
  reference: string;
  detail: string;
  value: number;
  status: string;
}

interface DemoCatalogItem {
  id: string;
  name: string;
  description: string;
  price: number;
  active: boolean;
  image: string;
}

interface DemoCustomer {
  id: string;
  name: string;
  contact: string;
  visits: number;
  value: number;
}

const panelClass = "rounded-2xl border border-slate-700 bg-slate-900 light:border-slate-200 light:bg-white";

export function DemoDashboardPreview({ tenant }: { tenant: Tenant }) {
  const isAppointment = tenant.businessType === "appointment";
  const analytics = mockAnalytics[tenant.id] ?? {
    totalRevenue: 0,
    totalActivity: 0,
    newCustomers: 0,
    avgOrderValue: 0,
    revenueChange: 0,
    activityChange: 0,
    topItems: [],
    revenueData: [],
  };
  const initialOrders = getOrdersByTenant(tenant.id);
  const initialAppointments = getAppointmentsByTenant(tenant.id);
  const [activeSection, setActiveSection] = useState<DemoSection>("overview");
  const [activitySearch, setActivitySearch] = useState("");
  const [activityFilter, setActivityFilter] = useState("all");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [settingsForm, setSettingsForm] = useState({
    businessName: tenant.name,
    phone: tenant.phone,
    description: tenant.description,
    primaryColor: tenant.primaryColor,
  });
  const [activities, setActivities] = useState<DemoActivity[]>(() =>
    isAppointment
      ? initialAppointments.map((appointment) => ({
          id: appointment.id,
          customerName: appointment.customerName,
          reference: appointment.serviceName,
          detail: `${formatDate(appointment.date)} at ${formatTime(appointment.time)}`,
          value: appointment.servicePrice,
          status: appointment.status,
        }))
      : initialOrders.map((order) => ({
          id: order.id,
          customerName: order.customerName,
          reference: order.orderNumber,
          detail: `${order.items.length} item${order.items.length === 1 ? "" : "s"}`,
          value: order.totalAmount,
          status: order.status,
        })),
  );
  const [catalogItems, setCatalogItems] = useState<DemoCatalogItem[]>(() =>
    (isAppointment ? getServicesByTenant(tenant.id) : getProductsByTenant(tenant.id)).map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      active: item.isActive,
      image: item.image,
    })),
  );

  const customers = useMemo<DemoCustomer[]>(() => {
    const values = new Map<string, DemoCustomer>();
    activities.forEach((activity, index) => {
      const existing = values.get(activity.customerName);
      if (existing) {
        existing.visits += 1;
        existing.value += activity.value;
      } else {
        values.set(activity.customerName, {
          id: `customer-${index}`,
          name: activity.customerName,
          contact: `${activity.customerName.toLowerCase().replace(/\s+/g, ".")}@example.com`,
          visits: 1,
          value: activity.value,
        });
      }
    });
    return [...values.values()];
  }, [activities]);

  const navItems: { id: DemoSection; label: string; icon: ComponentType<{ className?: string }> }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "activity", label: isAppointment ? "Appointments" : "Orders", icon: isAppointment ? CalendarDays : ShoppingBag },
    { id: "catalog", label: isAppointment ? "Services" : "Products", icon: isAppointment ? Scissors : Package },
    { id: "customers", label: "Customers", icon: Users },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "settings", label: "Settings", icon: Settings },
  ];
  const currentLabel = navItems.find((item) => item.id === activeSection)?.label ?? "Overview";

  const selectSection = (section: DemoSection) => {
    setActiveSection(section);
    setNotice("");
  };

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };

  const advanceStatus = (activity: DemoActivity) => {
    const flow = isAppointment
      ? ["pending", "confirmed", "completed"]
      : ["pending", "confirmed", "preparing", "ready", "delivered"];
    const currentIndex = flow.indexOf(activity.status);
    const nextStatus = flow[Math.min(currentIndex + 1, flow.length - 1)];
    setActivities((current) => current.map((item) => item.id === activity.id ? { ...item, status: nextStatus } : item));
    showNotice(`${activity.reference} moved to ${nextStatus}. Demo data only.`);
  };

  const toggleCatalogItem = (id: string) => {
    setCatalogItems((current) => current.map((item) => item.id === id ? { ...item, active: !item.active } : item));
    showNotice("Availability updated for this preview only.");
  };

  const addDemoItem = () => {
    const suffix = catalogItems.length + 1;
    setCatalogItems((current) => [{
      id: `demo-${Date.now()}`,
      name: isAppointment ? `New Demo Service ${suffix}` : `New Demo Product ${suffix}`,
      description: "A temporary sample item added during your demo session.",
      price: isAppointment ? 65 : 12.5,
      active: true,
      image: "/fallback-product.png",
    }, ...current]);
    showNotice(`Demo ${isAppointment ? "service" : "product"} added. It will reset when you refresh.`);
  };

  return (
    <div className="flex min-h-[calc(100vh-112px)] bg-[#08111f] text-white light:bg-[#f6f8fc] light:text-slate-900">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-white/5 bg-[#111a35] md:flex">
        <div className="flex items-center gap-3 border-b border-white/5 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-700"><Sparkles className="h-4 w-4" /></div>
          <div><p className="text-sm font-bold">YuhBusiness</p><p className="text-[9px] uppercase tracking-[0.2em] text-slate-400">Demo Dashboard</p></div>
        </div>
        <div className="border-b border-white/5 p-4">
          <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ backgroundColor: tenant.logoBg }}>{tenant.logo}</div>
            <div className="min-w-0"><p className="truncate text-xs font-semibold">{settingsForm.businessName}</p><p className="mt-1 text-[9px] capitalize text-violet-300">{tenant.businessType} business</p></div>
          </div>
        </div>
        <nav className="space-y-1 p-3" aria-label="Demo dashboard navigation">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              data-demo-section={id}
              onClick={() => selectSection(id)}
              className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs transition", activeSection === id ? "bg-violet-500/20 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white")}
            >
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </nav>
        <div className="mt-auto space-y-3 border-t border-white/5 p-4">
          <p className="text-[10px] leading-4 text-slate-500">Everything here is temporary sample data.</p>
          <Link href="/register" className="flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-violet-500">Create your business <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-hidden p-4 sm:p-6">
        <div className="mx-auto max-w-6xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-xl font-bold">{currentLabel}</h2><p className="mt-1 text-xs text-slate-400 light:text-slate-600">Explore how you would manage {settingsForm.businessName}</p></div>
            <div className="flex items-center gap-2"><span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-300 light:text-violet-700">Interactive demo</span><Link href="/register" className="rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-violet-500">Start free</Link></div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 md:hidden">
            {navItems.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => selectSection(id)} className={cn("inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold", activeSection === id ? "bg-violet-600 text-white" : "bg-slate-900 text-slate-400 light:bg-white light:text-slate-600")}><Icon className="h-3.5 w-3.5" />{label}</button>)}
          </div>

          {activeSection === "overview" && <OverviewSection tenant={tenant} businessName={settingsForm.businessName} analytics={analytics} activities={activities} catalogItems={catalogItems} isAppointment={isAppointment} onSelect={selectSection} />}
          {activeSection === "activity" && <ActivitySection activities={activities} filter={activityFilter} isAppointment={isAppointment} onAdvance={advanceStatus} onFilter={setActivityFilter} onSearch={setActivitySearch} search={activitySearch} />}
          {activeSection === "catalog" && <CatalogSection items={catalogItems} isAppointment={isAppointment} onAdd={addDemoItem} onSearch={setCatalogSearch} onToggle={toggleCatalogItem} search={catalogSearch} />}
          {activeSection === "customers" && <CustomersSection customers={customers} onSearch={setCustomerSearch} search={customerSearch} />}
          {activeSection === "analytics" && <AnalyticsSection analytics={analytics} isAppointment={isAppointment} />}
          {activeSection === "settings" && <SettingsSection form={settingsForm} onChange={setSettingsForm} onSave={() => showNotice("Preview settings saved locally. Create an account to publish them.")} />}

          <section className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-violet-500/25 bg-gradient-to-r from-violet-950/70 to-indigo-950/50 p-5 text-center sm:flex-row sm:text-left light:from-violet-50 light:to-indigo-50">
            <div><h3 className="font-bold">Ready to make this dashboard yours?</h3><p className="mt-1 text-xs text-slate-400 light:text-slate-600">Create your business, customize your storefront, and start accepting customers.</p></div>
            <Link href="/register" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-xs font-bold text-white hover:bg-violet-500">Create my free account <ArrowRight className="h-4 w-4" /></Link>
          </section>
        </div>
      </main>

      {notice && <div role="status" className="fixed bottom-5 right-5 z-50 flex max-w-sm items-start gap-3 rounded-xl border border-emerald-500/30 bg-slate-950 px-4 py-3 text-xs text-emerald-300 shadow-2xl light:bg-white light:text-emerald-700"><Check className="h-4 w-4 shrink-0" /><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Close message"><X className="h-3.5 w-3.5" /></button></div>}
    </div>
  );
}

function OverviewSection({ tenant, businessName, analytics, activities, catalogItems, isAppointment, onSelect }: {
  tenant: Tenant;
  businessName: string;
  analytics: typeof mockAnalytics[string];
  activities: DemoActivity[];
  catalogItems: DemoCatalogItem[];
  isAppointment: boolean;
  onSelect: (section: DemoSection) => void;
}) {
  const maxRevenue = Math.max(1, ...analytics.revenueData.map((point) => point.revenue));
  return <>
    <section className="relative min-h-36 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 light:border-slate-200 light:bg-white">
      <Image src={tenant.coverImage} alt="" fill sizes="100vw" className="object-cover opacity-35 light:opacity-25" unoptimized />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/90 to-transparent light:from-white light:via-white/90" />
      <div className="relative z-10 p-6"><p className="text-xs text-slate-400 light:text-slate-600">Good morning, Business Owner!</p><h3 className="mt-2 text-xl font-bold">Welcome back to {businessName}</h3><p className="mt-1 text-xs text-slate-400 light:text-slate-600">Your daily performance and customer activity appears here.</p></div>
    </section>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><DemoStat icon={DollarSign} label="Total Revenue" value={formatCurrency(analytics.totalRevenue)} color="violet" /><DemoStat icon={isAppointment ? CalendarDays : ShoppingBag} label={isAppointment ? "Appointments" : "Orders"} value={String(analytics.totalActivity)} color="blue" /><DemoStat icon={Users} label="New Customers" value={String(analytics.newCustomers)} color="emerald" /><DemoStat icon={WalletCards} label="Average Value" value={formatCurrency(analytics.avgOrderValue)} color="orange" /></section>
    <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
      <div className={cn(panelClass, "p-5")}><div className="flex items-center justify-between"><div><h3 className="text-sm font-bold">Revenue Overview</h3><p className="mt-1 text-[10px] text-slate-500">Sample seven-day performance</p></div><TrendingUp className="h-4 w-4 text-violet-400" /></div><div className="mt-5 flex h-40 items-end gap-2 border-b border-slate-700 px-2 light:border-slate-200">{analytics.revenueData.slice(-7).map((point) => <div key={point.date} className="flex h-full flex-1 items-end"><div className="w-full rounded-t bg-gradient-to-t from-violet-700 to-violet-400" style={{ height: `${Math.max(8, (point.revenue / maxRevenue) * 100)}%` }} title={`${point.date}: ${formatCurrency(point.revenue)}`} /></div>)}</div></div>
      <div className={cn(panelClass, "p-5")}><div className="flex items-center justify-between"><h3 className="text-sm font-bold">{isAppointment ? "Top Services" : "Top Products"}</h3><button onClick={() => onSelect("catalog")} className="text-[10px] font-bold text-violet-400">Manage</button></div><div className="mt-4 space-y-3">{catalogItems.filter((item) => item.active).slice(0, 4).map((item, index) => <div key={item.id} className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 text-xs font-bold text-violet-300">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{item.name}</p><p className="text-[10px] text-slate-500">Active in your storefront</p></div><span className="text-xs font-bold">{formatCurrency(item.price)}</span></div>)}</div></div>
    </section>
    <section className={panelClass}><div className="flex items-center justify-between border-b border-slate-700 px-5 py-4 light:border-slate-200"><h3 className="text-sm font-bold">Recent {isAppointment ? "Appointments" : "Orders"}</h3><button onClick={() => onSelect("activity")} className="text-[10px] font-bold text-violet-400">View all</button></div><div className="divide-y divide-slate-800 light:divide-slate-100">{activities.slice(0, 4).map((activity) => <ActivityRow key={activity.id} activity={activity} isAppointment={isAppointment} />)}</div></section>
  </>;
}

function ActivitySection({ activities, filter, isAppointment, onAdvance, onFilter, onSearch, search }: { activities: DemoActivity[]; filter: string; isAppointment: boolean; onAdvance: (activity: DemoActivity) => void; onFilter: (value: string) => void; onSearch: (value: string) => void; search: string }) {
  const filtered = activities.filter((activity) => (filter === "all" || activity.status === filter) && [activity.customerName, activity.reference].some((value) => value.toLowerCase().includes(search.toLowerCase())));
  const statuses = [...new Set(activities.map((activity) => activity.status))];
  return <section className={cn(panelClass, "overflow-hidden")}><div className="flex flex-wrap gap-3 border-b border-slate-700 p-4 light:border-slate-200"><SearchBox value={search} onChange={onSearch} placeholder={`Search ${isAppointment ? "appointments" : "orders"}...`} /><select value={filter} onChange={(event) => onFilter(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs outline-none light:border-slate-200 light:bg-white"><option value="all">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{capitalise(status)}</option>)}</select></div><div className="divide-y divide-slate-800 light:divide-slate-100">{filtered.map((activity) => <div key={activity.id} className="flex flex-wrap items-center gap-3 px-5 py-4"><ActivityRow activity={activity} isAppointment={isAppointment} compact /><button onClick={() => onAdvance(activity)} className="ml-auto rounded-lg border border-violet-500/30 px-3 py-2 text-[10px] font-bold text-violet-300 hover:bg-violet-500/10 light:text-violet-700">Advance status</button></div>)}{filtered.length === 0 && <EmptyMessage text="No sample activity matches your filters." />}</div></section>;
}

function CatalogSection({ items, isAppointment, onAdd, onSearch, onToggle, search }: { items: DemoCatalogItem[]; isAppointment: boolean; onAdd: () => void; onSearch: (value: string) => void; onToggle: (id: string) => void; search: string }) {
  const filtered = items.filter((item) => [item.name, item.description].some((value) => value.toLowerCase().includes(search.toLowerCase())));
  return <section className={cn(panelClass, "overflow-hidden")}><div className="flex flex-wrap items-center gap-3 border-b border-slate-700 p-4 light:border-slate-200"><SearchBox value={search} onChange={onSearch} placeholder={`Search ${isAppointment ? "services" : "products"}...`} /><button onClick={onAdd} className="ml-auto inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-violet-500"><Plus className="h-4 w-4" />Add demo {isAppointment ? "service" : "product"}</button></div><div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">{filtered.map((item) => <article key={item.id} className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800/50 light:border-slate-200 light:bg-slate-50"><div className="relative h-32"><Image src={item.image || "/fallback-product.png"} alt={item.name} fill sizes="320px" className="object-cover" unoptimized /></div><div className="p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold">{item.name}</h3><p className="mt-1 line-clamp-2 text-[10px] text-slate-500">{item.description}</p></div><span className="text-sm font-bold">{formatCurrency(item.price)}</span></div><button onClick={() => onToggle(item.id)} className={cn("mt-4 w-full rounded-lg px-3 py-2 text-xs font-bold", item.active ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-700 text-slate-400 light:bg-slate-200 light:text-slate-600")}>{item.active ? "Available — click to turn off" : "Unavailable — click to turn on"}</button></div></article>)}{filtered.length === 0 && <div className="sm:col-span-2 xl:col-span-3"><EmptyMessage text="No sample catalog items match your search." /></div>}</div></section>;
}

function CustomersSection({ customers, onSearch, search }: { customers: DemoCustomer[]; onSearch: (value: string) => void; search: string }) {
  const filtered = customers.filter((customer) => [customer.name, customer.contact].some((value) => value.toLowerCase().includes(search.toLowerCase())));
  return <section className={cn(panelClass, "overflow-hidden")}><div className="border-b border-slate-700 p-4 light:border-slate-200"><SearchBox value={search} onChange={onSearch} placeholder="Search customers..." /></div><div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-xs"><thead className="border-b border-slate-700 text-[10px] uppercase tracking-wider text-slate-500 light:border-slate-200"><tr><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Contact</th><th className="px-5 py-3">Visits</th><th className="px-5 py-3">Total value</th></tr></thead><tbody className="divide-y divide-slate-800 light:divide-slate-100">{filtered.map((customer) => <tr key={customer.id}><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/15 text-[10px] font-bold text-violet-300">{initials(customer.name)}</span><span className="font-semibold">{customer.name}</span></div></td><td className="px-5 py-4 text-slate-500">{customer.contact}</td><td className="px-5 py-4">{customer.visits}</td><td className="px-5 py-4 font-bold">{formatCurrency(customer.value)}</td></tr>)}</tbody></table>{filtered.length === 0 && <EmptyMessage text="No sample customers match your search." />}</div></section>;
}

function AnalyticsSection({ analytics, isAppointment }: { analytics: typeof mockAnalytics[string]; isAppointment: boolean }) {
  const maxRevenue = Math.max(1, ...analytics.revenueData.map((point) => point.revenue));
  return <div className="space-y-4"><section className="grid gap-3 sm:grid-cols-3"><DemoStat icon={DollarSign} label="Revenue" value={formatCurrency(analytics.totalRevenue)} color="violet" /><DemoStat icon={TrendingUp} label="Revenue growth" value={`+${analytics.revenueChange}%`} color="emerald" /><DemoStat icon={isAppointment ? CalendarDays : ShoppingBag} label="Activity growth" value={`+${analytics.activityChange}%`} color="blue" /></section><section className={cn(panelClass, "p-5")}><h3 className="text-sm font-bold">Performance trend</h3><p className="mt-1 text-[10px] text-slate-500">Hover over the bars to inspect the sample values</p><div className="mt-5 flex h-60 items-end gap-3 border-b border-slate-700 px-3 light:border-slate-200">{analytics.revenueData.map((point) => <div key={point.date} className="group flex h-full flex-1 items-end"><div className="relative w-full rounded-t bg-gradient-to-t from-indigo-700 to-violet-400 transition group-hover:from-indigo-600 group-hover:to-violet-300" style={{ height: `${Math.max(6, point.revenue / maxRevenue * 100)}%` }} title={`${point.date}: ${formatCurrency(point.revenue)} · ${point.count} activities`} /></div>)}</div></section><section className={cn(panelClass, "p-5")}><h3 className="text-sm font-bold">Top performers</h3><div className="mt-4 grid gap-3 sm:grid-cols-2">{analytics.topItems.map((item, index) => <div key={item.name} className="flex items-center gap-3 rounded-xl bg-slate-800/50 p-3 light:bg-slate-50"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/15 text-xs font-bold text-violet-300">#{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{item.name}</p><p className="text-[10px] text-slate-500">{item.count} sales</p></div><span className="text-xs font-bold">{formatCurrency(item.revenue)}</span></div>)}</div></section></div>;
}

function SettingsSection({ form, onChange, onSave }: { form: { businessName: string; phone: string; description: string; primaryColor: string }; onChange: (value: typeof form) => void; onSave: () => void }) {
  return <section className={cn(panelClass, "p-5 sm:p-6")}><div className="max-w-2xl"><h3 className="text-sm font-bold">Storefront settings preview</h3><p className="mt-1 text-xs text-slate-500">Try editing these fields. Changes stay only in this browser session.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><DemoField label="Business name" value={form.businessName} onChange={(value) => onChange({ ...form, businessName: value })} /><DemoField label="Phone number" value={form.phone} onChange={(value) => onChange({ ...form, phone: value })} /><label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-semibold">Description</span><textarea value={form.description} onChange={(event) => onChange({ ...form, description: event.target.value })} rows={4} className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-xs outline-none focus:border-violet-500 light:border-slate-200 light:bg-slate-50" /></label><label><span className="mb-1.5 block text-xs font-semibold">Brand color</span><div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800 p-2 light:border-slate-200 light:bg-slate-50"><input type="color" value={form.primaryColor} onChange={(event) => onChange({ ...form, primaryColor: event.target.value })} className="h-9 w-12 cursor-pointer rounded" /><span className="text-xs text-slate-500">{form.primaryColor}</span></div></label></div><button onClick={onSave} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-xs font-bold text-white hover:bg-violet-500"><Save className="h-4 w-4" />Save preview changes</button></div></section>;
}

function ActivityRow({ activity, isAppointment, compact = false }: { activity: DemoActivity; isAppointment: boolean; compact?: boolean }) {
  return <div className={cn("flex min-w-0 items-center gap-3", !compact && "px-5 py-3")}><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-400">{isAppointment ? <CalendarDays className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{activity.customerName}</p><p className="mt-0.5 truncate text-[10px] text-slate-500">{activity.reference} · {activity.detail}</p></div><span className="hidden text-xs font-bold sm:block">{formatCurrency(activity.value)}</span><span className={cn("rounded-full px-2 py-1 text-[9px] font-semibold capitalize", statusClass(activity.status))}>{activity.status}</span></div>;
}

function DemoStat({ icon: Icon, label, value, color }: { icon: ComponentType<{ className?: string }>; label: string; value: string; color: "violet" | "blue" | "emerald" | "orange" }) {
  const colors = { violet: "bg-violet-500/15 text-violet-400", blue: "bg-blue-500/15 text-blue-400", emerald: "bg-emerald-500/15 text-emerald-400", orange: "bg-orange-500/15 text-orange-400" }[color];
  return <div className={cn(panelClass, "p-4")}><div className={cn("inline-flex rounded-xl p-2.5", colors)}><Icon className="h-4 w-4" /></div><p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>;
}

function SearchBox({ onChange, placeholder, value }: { onChange: (value: string) => void; placeholder: string; value: string }) {
  return <label className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-slate-700 bg-slate-800 py-2.5 pl-10 pr-3 text-xs outline-none focus:border-violet-500 light:border-slate-200 light:bg-slate-50" /></label>;
}

function DemoField({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return <label><span className="mb-1.5 block text-xs font-semibold">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-xs outline-none focus:border-violet-500 light:border-slate-200 light:bg-slate-50" /></label>;
}

function EmptyMessage({ text }: { text: string }) { return <p className="px-5 py-12 text-center text-xs text-slate-500">{text}</p>; }
function capitalise(value: string) { return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " "); }
function initials(name: string) { return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }
function statusClass(status: string) {
  if (["completed", "delivered", "ready"].includes(status)) return "bg-emerald-500/10 text-emerald-400";
  if (["confirmed", "preparing"].includes(status)) return "bg-blue-500/10 text-blue-400";
  if (status === "cancelled") return "bg-red-500/10 text-red-400";
  return "bg-amber-500/10 text-amber-400";
}
