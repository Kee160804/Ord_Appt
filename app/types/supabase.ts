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
  stock: number;
  available: boolean;
  created_at: string;
}

export interface CategoryRow {
  id: string;
  tenant_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}
