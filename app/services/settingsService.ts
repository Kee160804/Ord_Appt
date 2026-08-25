import { getSupabaseBrowserClient } from "@/app/lib/supabase/client";
import type { BusinessHours } from "@/app/types/index";

export interface BusinessDetailsInput {
  name: string;
  description: string;
  phone: string;
  email: string;
  address: string;
  city: string;
}

export interface StorefrontSettingsInput {
  slug: string;
  coverImage: string;
  primaryColor: string;
  accentColor: string;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function client() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function updateBusinessDetails(tenantId: string, input: BusinessDetailsInput) {
  const businessName = input.name.trim();
  if (!businessName) throw new Error("Business name is required.");

  const { error } = await client()
    .from("tenants")
    .update({
      business_name: businessName,
      description: input.description.trim(),
      phone: input.phone.trim(),
      email: input.email.trim().toLowerCase(),
      address: input.address.trim(),
      city: input.city.trim(),
    })
    .eq("id", tenantId)
    .select("id")
    .single();

  if (error) throw error;
  return { ...input, name: businessName };
}

export async function updateStorefrontSettings(
  tenantId: string,
  input: StorefrontSettingsInput,
) {
  const slug = slugify(input.slug);
  if (!slug) throw new Error("Storefront URL is required.");

  const coverImage = input.coverImage.trim();
  if (coverImage) {
    let imageUrl: URL;
    try {
      imageUrl = new URL(coverImage);
    } catch {
      throw new Error("Cover image must be a valid URL.");
    }
    if (imageUrl.protocol !== "https:" && imageUrl.protocol !== "http:") {
      throw new Error("Cover image must use an HTTP or HTTPS URL.");
    }
  }

  const { error } = await client()
    .from("tenants")
    .update({
      slug,
      subdomain: slug,
      cover_image: coverImage || null,
      primary_color: input.primaryColor,
      accent_color: input.accentColor,
    })
    .eq("id", tenantId)
    .select("id")
    .single();

  if (error) throw error;
  return { ...input, slug, coverImage };
}

export async function updateBusinessHours(tenantId: string, hours: BusinessHours[]) {
  const rows = hours.map((hour) => {
    const dayOfWeek = DAYS.indexOf(hour.day);
    if (dayOfWeek < 0) throw new Error(`Unknown business day: ${hour.day}`);

    return {
      tenant_id: tenantId,
      day_of_week: dayOfWeek,
      open_time: hour.closed ? null : hour.open || null,
      close_time: hour.closed ? null : hour.close || null,
      is_closed: hour.closed,
    };
  });

  const { error } = await client()
    .from("business_hours")
    .upsert(rows, { onConflict: "tenant_id,day_of_week" });

  if (error) throw error;
  return hours;
}
