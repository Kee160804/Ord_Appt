import { getSupabaseBrowserClient } from "@/app/lib/supabase/client";
import type { Service } from "@/app/types/index";
import type { ServiceRow } from "@/app/types/supabase";

export interface ServiceInput {
  name: string;
  description: string;
  duration: number;
  price: number;
  image: string;
  category: string;
  requiresDeposit: boolean;
  depositAmount?: number;
  depositType?: "fixed" | "percentage";
}

function client() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

function mapService(row: ServiceRow): Service {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    description: row.description ?? "",
    duration: row.duration_minutes,
    price: Number(row.price),
    image: row.image_url ?? "",
    category: row.category ?? "Services",
    isActive: row.available,
    requiresDeposit: row.requires_deposit ?? false,
    depositAmount: row.deposit_amount == null ? undefined : Number(row.deposit_amount),
    depositType: row.deposit_type ?? undefined,
    createdAt: row.created_at,
  };
}

function serviceValues(tenantId: string, input: ServiceInput) {
  return {
    tenant_id: tenantId,
    name: input.name.trim(),
    description: input.description.trim(),
    duration_minutes: input.duration,
    price: input.price,
    image_url: input.image.trim() || null,
    category: input.category.trim() || "Services",
    available: true,
    requires_deposit: input.requiresDeposit,
    deposit_type: input.requiresDeposit ? input.depositType ?? "fixed" : null,
    deposit_amount: input.requiresDeposit ? input.depositAmount ?? 0 : null,
  };
}

export async function listServices(tenantId: string): Promise<Service[]> {
  const { data, error } = await client()
    .from("services")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at");

  if (error) throw error;
  return ((data ?? []) as ServiceRow[]).map(mapService);
}

export async function createService(tenantId: string, input: ServiceInput): Promise<Service> {
  const { data, error } = await client()
    .from("services")
    .insert(serviceValues(tenantId, input))
    .select("*")
    .single();

  if (error) throw error;
  return mapService(data as ServiceRow);
}

export async function updateService(
  tenantId: string,
  serviceId: string,
  input: ServiceInput,
): Promise<Service> {
  const { data, error } = await client()
    .from("services")
    .update(serviceValues(tenantId, input))
    .eq("id", serviceId)
    .eq("tenant_id", tenantId)
    .select("*")
    .single();

  if (error) throw error;
  return mapService(data as ServiceRow);
}

export async function setServiceAvailability(
  tenantId: string,
  serviceId: string,
  available: boolean,
) {
  const { error } = await client()
    .from("services")
    .update({ available })
    .eq("id", serviceId)
    .eq("tenant_id", tenantId);

  if (error) throw error;
}

export async function deleteService(tenantId: string, serviceId: string) {
  const { error } = await client()
    .from("services")
    .delete()
    .eq("id", serviceId)
    .eq("tenant_id", tenantId);

  if (error) throw error;
}
