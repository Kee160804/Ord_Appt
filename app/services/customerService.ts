import { getSupabaseBrowserClient } from "@/app/lib/supabase/client";

export interface CustomerRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  isActive: boolean;
  createdAt: string;
}

function client() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

function mapCustomer(row: {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}): CustomerRecord {
  return {
    id: row.id,
    name:
      [row.first_name, row.last_name].filter(Boolean).join(" ").trim() ||
      "Customer",
    email: row.email ?? "",
    phone: row.phone ?? "",
    notes: row.notes ?? "",
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export async function listCustomers(
  tenantId: string,
  page = 0,
  pageSize = 250,
): Promise<CustomerRecord[]> {
  const safePage = Math.max(0, Math.floor(page));
  const safePageSize = Math.min(500, Math.max(1, Math.floor(pageSize)));
  const from = safePage * safePageSize;
  const { data, error } = await client()
    .from("customers")
    .select(
      "id, first_name, last_name, email, phone, notes, is_active, created_at",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .range(from, from + safePageSize - 1);
  if (error) throw error;
  return (data ?? []).map(mapCustomer);
}

function customerNames(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) throw new Error("Customer name is required.");
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export async function createCustomer(
  tenantId: string,
  input: Pick<CustomerRecord, "name" | "email" | "phone" | "notes">,
) {
  const { firstName, lastName } = customerNames(input.name);
  if (!input.email.trim() && !input.phone.trim()) {
    throw new Error("Enter an email address or phone number.");
  }
  const { data, error } = await client()
    .from("customers")
    .insert({
      tenant_id: tenantId,
      first_name: firstName,
      last_name: lastName,
      email: input.email.trim().toLowerCase() || null,
      phone: input.phone.trim() || null,
      notes: input.notes.trim() || null,
      is_active: true,
    })
    .select(
      "id, first_name, last_name, email, phone, notes, is_active, created_at",
    )
    .single();
  if (error) throw error;
  return mapCustomer(data);
}

export async function updateCustomer(
  tenantId: string,
  customerId: string,
  input: Pick<CustomerRecord, "name" | "email" | "phone" | "notes">,
) {
  const { firstName, lastName } = customerNames(input.name);
  const { data, error } = await client()
    .from("customers")
    .update({
      first_name: firstName,
      last_name: lastName,
      email: input.email.trim().toLowerCase() || null,
      phone: input.phone.trim() || null,
      notes: input.notes.trim() || null,
    })
    .eq("tenant_id", tenantId)
    .eq("id", customerId)
    .select(
      "id, first_name, last_name, email, phone, notes, is_active, created_at",
    )
    .single();
  if (error) throw error;
  return mapCustomer(data);
}

export async function setCustomerActive(
  tenantId: string,
  customerId: string,
  isActive: boolean,
) {
  const { error } = await client()
    .from("customers")
    .update({ is_active: isActive })
    .eq("tenant_id", tenantId)
    .eq("id", customerId)
    .select("id")
    .single();
  if (error) throw error;
}
