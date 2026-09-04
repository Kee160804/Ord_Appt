export interface ProfileRow {
  id: string;
  tenant_id: string | null;
  full_name: string | null;
  email: string | null;
  role: string | null;
  platform_role: string;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface RoleRow {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  is_system_role: boolean;
}

export interface MembershipRow {
  id: string;
  tenant_id: string;
  profile_id: string;
  role_id: string;
  is_active: boolean;
  roles: Pick<RoleRow, "name"> | Pick<RoleRow, "name">[] | null;
}

export interface TenantRow {
  id: string;
  business_name: string;
  slug: string;
  subdomain: string;
  business_type?: string | null;
  description?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  logo?: string | null;
  logo_url?: string | null;
  logo_bg?: string | null;
  cover_image?: string | null;
  primary_color?: string | null;
  accent_color?: string | null;
  plan?: string | null;
  subscription_status?: string | null;
  stripe_connected?: boolean | null;
  trial_ends_at?: string | null;
  created_at?: string | null;
  is_active: boolean;
  status: string;
}

export interface BusinessHourRow {
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
}

export interface ProductRow {
  id: string;
  tenant_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number | string;
  image_url: string | null;
  sku: string | null;
  stock: number | null;
  track_inventory?: boolean | null;
  available: boolean;
  addons: { id: string; name: string; price: number | string }[] | null;
  created_at: string;
}

export interface ServiceRow {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number | string;
  image_url: string | null;
  available: boolean;
  created_at: string;
  category: string | null;
  requires_deposit: boolean | null;
  deposit_amount: number | string | null;
  deposit_type: "fixed" | "percentage" | null;
  department_id?: string | null;
}

export interface AppointmentServiceRow {
  service_id: string | null;
  service_name: string;
  price: number | string;
  duration_minutes: number;
}

export interface AppointmentRow {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  service_id: string | null;
  appointment_date: string | null;
  appointment_time: string | null;
  starts_at: string | null;
  ends_at: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  status: string;
  notes: string | null;
  subtotal: number | string | null;
  deposit_required: number | string | null;
  total: number | string | null;
  created_at: string;
  appointment_services?: AppointmentServiceRow[] | null;
  staff_id?: string | null;
  staff?:
    { display_name: string | null } | { display_name: string | null }[] | null;
}

export interface CategoryRow {
  id: string;
  tenant_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export interface OrderProductRow {
  image_url: string | null;
}

export interface OrderItemRow {
  id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number | string;
  subtotal: number | string;
  products?: OrderProductRow | OrderProductRow[] | null;
}

export interface OrderRow {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  order_number: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  status: string;
  payment_status: string;
  total: number | string;
  notes: string | null;
  created_at: string;
  order_items?: OrderItemRow[] | null;
}
