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

/**
 * One page of tenant customers plus the metadata required by the UI.
 *
 * Pages are zero-based to match Supabase/PostgREST range offsets.
 */
export interface CustomerPage {
  customers: CustomerRecord[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

/**
 * Database-backed filters supported by the Customers screen.
 */
export interface ListCustomersOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  active?: boolean | "all";
}

interface CustomerRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

const CUSTOMER_SELECT =
  "id, first_name, last_name, email, phone, notes, is_active, created_at";

const DEFAULT_CUSTOMER_PAGE_SIZE = 25;
const MAX_CUSTOMER_PAGE_SIZE = 100;
const MAX_CUSTOMER_SEARCH_LENGTH = 120;

function client() {
  const supabase = getSupabaseBrowserClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  return supabase;
}

function mapCustomer(row: CustomerRow): CustomerRecord {
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

function normalizePage(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value ?? 0));
}

function normalizePageSize(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_CUSTOMER_PAGE_SIZE;
  }

  return Math.min(
    MAX_CUSTOMER_PAGE_SIZE,
    Math.max(1, Math.floor(value ?? DEFAULT_CUSTOMER_PAGE_SIZE)),
  );
}

/**
 * Free-text search is inserted into a PostgREST `.or()` expression, so remove
 * characters that can alter the expression structure.
 */
function normalizeSearch(value: string | undefined): string {
  return (value ?? "")
    .trim()
    .slice(0, MAX_CUSTOMER_SEARCH_LENGTH)
    .replace(/[(),]/g, " ")
    .trim();
}

/**
 * Loads one tenant-scoped customer page.
 *
 * Search and active/inactive filtering happen in Supabase before pagination,
 * ensuring the UI searches the tenant's complete customer list rather than
 * only the rows currently loaded in the browser.
 */
export async function listCustomers(
  tenantId: string,
  options: ListCustomersOptions = {},
): Promise<CustomerPage> {
  const safePage = normalizePage(options.page);
  const safePageSize = normalizePageSize(options.pageSize);
  const search = normalizeSearch(options.search);

  const from = safePage * safePageSize;
  const to = from + safePageSize - 1;

  let query = client()
    .from("customers")
    .select(CUSTOMER_SELECT, { count: "exact" })
    .eq("tenant_id", tenantId);

  if (options.active !== undefined && options.active !== "all") {
    query = query.eq("is_active", options.active);
  }

  if (search) {
    query = query.or(
      [
        `first_name.ilike.%${search}%`,
        `last_name.ilike.%${search}%`,
        `email.ilike.%${search}%`,
        `phone.ilike.%${search}%`,
      ].join(","),
    );
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);

  if (error) {
    throw error;
  }

  const customers = ((data ?? []) as CustomerRow[]).map(mapCustomer);
  const total = count ?? 0;
  const totalPages =
    total === 0 ? 0 : Math.ceil(total / safePageSize);

  return {
    customers,
    page: safePage,
    pageSize: safePageSize,
    total,
    totalPages,
    hasPreviousPage: safePage > 0,
    hasNextPage: from + customers.length < total,
  };
}

function customerNames(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (!parts.length) {
    throw new Error("Customer name is required.");
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function normalizeCustomerContact(
  input: Pick<CustomerRecord, "email" | "phone">,
) {
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();

  if (!email && !phone) {
    throw new Error("Enter an email address or phone number.");
  }

  return {
    email: email || null,
    phone: phone || null,
  };
}

export async function createCustomer(
  tenantId: string,
  input: Pick<CustomerRecord, "name" | "email" | "phone" | "notes">,
) {
  const { firstName, lastName } = customerNames(input.name);
  const contact = normalizeCustomerContact(input);

  const { data, error } = await client()
    .from("customers")
    .insert({
      tenant_id: tenantId,
      first_name: firstName,
      last_name: lastName,
      email: contact.email,
      phone: contact.phone,
      notes: input.notes.trim() || null,
      is_active: true,
    })
    .select(CUSTOMER_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return mapCustomer(data as CustomerRow);
}

export async function updateCustomer(
  tenantId: string,
  customerId: string,
  input: Pick<CustomerRecord, "name" | "email" | "phone" | "notes">,
) {
  const { firstName, lastName } = customerNames(input.name);
  const contact = normalizeCustomerContact(input);

  const { data, error } = await client()
    .from("customers")
    .update({
      first_name: firstName,
      last_name: lastName,
      email: contact.email,
      phone: contact.phone,
      notes: input.notes.trim() || null,
    })
    .eq("tenant_id", tenantId)
    .eq("id", customerId)
    .select(CUSTOMER_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return mapCustomer(data as CustomerRow);
}

/**
 * Customers are deactivated/reactivated rather than physically deleted.
 */
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

  if (error) {
    throw error;
  }
}
