// ─── Business / Tenant ────────────────────────────────────────
export type BusinessType = "appointment" | "ordering";
export type UserRole = "owner" | "admin" | "manager" | "staff" | "superadmin";
export type PlanType = "starter" | "pro" | "enterprise";
export type OrderStatus =
  "pending" | "confirmed" | "preparing" | "ready" | "delivered" | "cancelled";
export type AppointmentStatus =
  "pending" | "confirmed" | "cancelled" | "completed" | "no_show";
export type PaymentStatus = "unpaid" | "partial" | "paid" | "refunded";
export type TenantStatus = "active" | "inactive" | "suspended";
export type PermissionType =
  | "view_dashboard"
  | "manage_tenants"
  | "edit_storefront"
  | "view_analytics"
  | "manage_agents"
  | "manage_roles";

export interface BusinessHours {
  day: string;
  open: string;
  close: string;
  closed: boolean;
}
export interface SocialLinks {
  instagram?: string;
  facebook?: string;
  twitter?: string;
  website?: string;
}

export interface OrderingSettings {
  enabled: boolean;
  paused: boolean;
  orderTypes: Array<"dine_in" | "pickup" | "delivery">;
  taxRate: number;
  discountEnabled: boolean;
  discountThreshold: number;
  discountRate: number;
  minimumOrder: number;
  deliveryFee: number;
  deliveryAreas: string[];
  preparationMinutes: number;
  openTime?: string;
  closeTime?: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  businessType: BusinessType;
  logo: string;
  logoBg: string;
  description: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  coverImage: string;
  businessHours: BusinessHours[];
  socialLinks: SocialLinks;
  primaryColor: string;
  accentColor: string;
  createdAt: string;
  isActive: boolean;
  plan: PlanType;
  stripeConnected: boolean;
  subscriptionStatus: "active" | "trial" | "cancelled" | "past_due";
  trialEndsAt?: string;
  monthlyRevenue?: number;
  orderingSettings?: OrderingSettings;
}
export interface User {
  id: string;
  tenantId: string | null;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  createdAt: string;
  lastLogin: string;
}
export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: PermissionType[];
  isSystem: boolean;
  createdAt: string;
}
export interface Agent {
  id: string;
  tenantId: string | null;
  name: string;
  email: string;
  phone?: string;
  role: string;
  roleId: string;
  isActive: boolean;
  avatar?: string;
  createdAt: string;
}
export interface Service {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  duration: number;
  price: number;
  image: string;
  category: string;
  isActive: boolean;
  requiresDeposit: boolean;
  depositAmount?: number;
  depositType?: "fixed" | "percentage";
  createdAt: string;
  departmentId?: string;
}
export interface PublicServiceProvider {
  id: string;
  tenantId: string;
  name: string;
  bio: string;
  color: string;
  serviceIds: string[];
}
export interface Category {
  id: string;
  tenantId: string;
  name: string;
  sortOrder: number;
  isActive?: boolean;
}
export interface Product {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  price: number;
  image: string;
  categoryId: string;
  categoryName: string;
  isActive: boolean;
  inventory?: number;
  trackInventory?: boolean;
  tags: string[];
  addons?: ProductAddon[];
  createdAt: string;
}
export interface ProductAddon {
  id: string;
  name: string;
  price: number;
}
export interface Appointment {
  id: string;
  tenantId: string;
  customerId?: string;
  serviceId: string;
  serviceName: string;
  servicePrice: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  date: string;
  time: string;
  duration: number;
  status: AppointmentStatus;
  paymentStatus: PaymentStatus;
  notes?: string;
  depositPaid?: number;
  createdAt: string;
  providerId?: string;
  providerName?: string;
}
export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  quantity: number;
  price: number;
}
export interface Order {
  id: string;
  tenantId: string;
  customerId?: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: OrderItem[];
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  notes?: string;
  pickupTime?: string;
  createdAt: string;
}
export interface RevenuePoint {
  date: string;
  revenue: number;
  count: number;
}
export interface TopItem {
  name: string;
  count: number;
  revenue: number;
}
export interface AnalyticsSummary {
  totalRevenue: number;
  totalActivity: number;
  newCustomers: number;
  avgOrderValue: number;
  revenueChange: number;
  activityChange: number;
  topItems: TopItem[];
  revenueData: RevenuePoint[];
  returningCustomers?: number;
  busiestDay?: string;
  busiestTime?: string;
  completionRate?: number;
}
export interface CartItem {
  product: Product;
  quantity: number;
}
