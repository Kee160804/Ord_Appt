import { listAppointments } from "@/app/services/appointmentService";
import { listOrders } from "@/app/services/orderService";
import type {
  AnalyticsSummary,
  Appointment,
  Order,
  RevenuePoint,
  Tenant,
  TopItem,
} from "@/app/types/index";

export interface CustomerSummary {
  key: string;
  name: string;
  email: string;
  phone: string;
  lastActivity: string;
  activityCount: number;
  totalValue: number;
}

export interface DashboardData {
  analytics: AnalyticsSummary;
  appointments: Appointment[];
  orders: Order[];
  customers: CustomerSummary[];
}

function dateKey(value: string) {
  return value.slice(0, 10);
}

function lastTenDateKeys() {
  const dates: string[] = [];
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  for (let offset = 9; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    dates.push(date.toLocaleDateString("en-CA"));
  }
  return dates;
}

function customerKey(email: string, phone: string, name: string) {
  return email.trim().toLowerCase() || phone.replace(/\D/g, "") || name.trim().toLowerCase();
}

function buildAppointmentCustomers(appointments: Appointment[]) {
  const customers = new Map<string, CustomerSummary>();
  for (const appointment of appointments) {
    const key = customerKey(
      appointment.customerEmail,
      appointment.customerPhone,
      appointment.customerName,
    );
    const current = customers.get(key);
    const activityDate = appointment.date || dateKey(appointment.createdAt);
    const value = appointment.status === "cancelled" ? 0 : appointment.servicePrice;
    customers.set(key, {
      key,
      name: appointment.customerName,
      email: appointment.customerEmail,
      phone: appointment.customerPhone,
      lastActivity:
        !current || activityDate > current.lastActivity ? activityDate : current.lastActivity,
      activityCount: (current?.activityCount ?? 0) + 1,
      totalValue: (current?.totalValue ?? 0) + value,
    });
  }
  return [...customers.values()].sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
}

function buildOrderCustomers(orders: Order[]) {
  const customers = new Map<string, CustomerSummary>();
  for (const order of orders) {
    const key = customerKey(order.customerEmail, order.customerPhone, order.customerName);
    const current = customers.get(key);
    const activityDate = dateKey(order.createdAt);
    const value = order.status === "cancelled" ? 0 : order.totalAmount;
    customers.set(key, {
      key,
      name: order.customerName,
      email: order.customerEmail,
      phone: order.customerPhone,
      lastActivity:
        !current || activityDate > current.lastActivity ? activityDate : current.lastActivity,
      activityCount: (current?.activityCount ?? 0) + 1,
      totalValue: (current?.totalValue ?? 0) + value,
    });
  }
  return [...customers.values()].sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
}

function aggregateAppointments(appointments: Appointment[], customers: CustomerSummary[]) {
  const completed = appointments.filter((appointment) => appointment.status === "completed");
  const active = appointments.filter((appointment) => appointment.status !== "cancelled");
  const revenueByDate = new Map<string, RevenuePoint>();
  for (const key of lastTenDateKeys()) revenueByDate.set(key, { date: key, revenue: 0, count: 0 });

  for (const appointment of appointments) {
    const point = revenueByDate.get(appointment.date);
    if (!point) continue;
    point.count += 1;
    if (appointment.status === "completed") point.revenue += appointment.servicePrice;
  }

  const items = new Map<string, TopItem>();
  for (const appointment of active) {
    const item = items.get(appointment.serviceName) ?? {
      name: appointment.serviceName,
      count: 0,
      revenue: 0,
    };
    item.count += 1;
    if (appointment.status === "completed") item.revenue += appointment.servicePrice;
    items.set(item.name, item);
  }

  const completedValue = completed.reduce((sum, appointment) => sum + appointment.servicePrice, 0);
  return {
    totalRevenue: completedValue,
    totalActivity: appointments.length,
    newCustomers: customers.length,
    avgOrderValue: active.length
      ? active.reduce((sum, appointment) => sum + appointment.servicePrice, 0) / active.length
      : 0,
    revenueChange: 0,
    activityChange: 0,
    topItems: [...items.values()].sort((a, b) => b.count - a.count).slice(0, 5),
    revenueData: [...revenueByDate.values()],
  } satisfies AnalyticsSummary;
}

function aggregateOrders(orders: Order[], customers: CustomerSummary[]) {
  const delivered = orders.filter((order) => order.status === "delivered");
  const active = orders.filter((order) => order.status !== "cancelled");
  const revenueByDate = new Map<string, RevenuePoint>();
  for (const key of lastTenDateKeys()) revenueByDate.set(key, { date: key, revenue: 0, count: 0 });

  for (const order of orders) {
    const point = revenueByDate.get(dateKey(order.createdAt));
    if (!point) continue;
    point.count += 1;
    if (order.status === "delivered") point.revenue += order.totalAmount;
  }

  const items = new Map<string, TopItem>();
  for (const order of active) {
    for (const orderItem of order.items) {
      const item = items.get(orderItem.productName) ?? {
        name: orderItem.productName,
        count: 0,
        revenue: 0,
      };
      item.count += orderItem.quantity;
      if (order.status === "delivered") item.revenue += orderItem.price * orderItem.quantity;
      items.set(item.name, item);
    }
  }

  const deliveredValue = delivered.reduce((sum, order) => sum + order.totalAmount, 0);
  return {
    totalRevenue: deliveredValue,
    totalActivity: orders.length,
    newCustomers: customers.length,
    avgOrderValue: active.length
      ? active.reduce((sum, order) => sum + order.totalAmount, 0) / active.length
      : 0,
    revenueChange: 0,
    activityChange: 0,
    topItems: [...items.values()].sort((a, b) => b.count - a.count).slice(0, 5),
    revenueData: [...revenueByDate.values()],
  } satisfies AnalyticsSummary;
}

export async function loadDashboardData(tenant: Tenant): Promise<DashboardData> {
  if (tenant.businessType === "appointment") {
    const appointments = await listAppointments(tenant.id);
    const customers = buildAppointmentCustomers(appointments);
    return {
      appointments,
      orders: [],
      customers,
      analytics: aggregateAppointments(appointments, customers),
    };
  }

  const orders = await listOrders(tenant.id);
  const customers = buildOrderCustomers(orders);
  return {
    appointments: [],
    orders,
    customers,
    analytics: aggregateOrders(orders, customers),
  };
}
