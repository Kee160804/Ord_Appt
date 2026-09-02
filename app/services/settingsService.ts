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
const STOREFRONT_MEDIA_BUCKET = "storefront-media";
const MAX_COVER_IMAGE_BYTES = 5 * 1024 * 1024;
const COVER_IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

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

export function validateStorefrontCoverImage(file: File) {
  if (!COVER_IMAGE_EXTENSIONS[file.type]) {
    throw new Error("Choose a JPG, PNG, or WebP image.");
  }
  if (file.size > MAX_COVER_IMAGE_BYTES) {
    throw new Error("Cover images must be 5 MB or smaller.");
  }
}

export async function uploadStorefrontCoverImage(tenantId: string, file: File) {
  validateStorefrontCoverImage(file);
  const extension = COVER_IMAGE_EXTENSIONS[file.type];
  const objectPath = `${tenantId}/covers/${crypto.randomUUID()}.${extension}`;
  const supabase = client();
  const { error } = await supabase.storage
    .from(STOREFRONT_MEDIA_BUCKET)
    .upload(objectPath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    if (error.message.toLowerCase().includes("bucket")) {
      throw new Error("Photo uploads are not installed yet. Apply the storefront media migration in Supabase.");
    }
    throw error;
  }

  const { data } = supabase.storage.from(STOREFRONT_MEDIA_BUCKET).getPublicUrl(objectPath);
  if (!data.publicUrl) throw new Error("The uploaded photo URL could not be created.");
  return data.publicUrl;
}

export async function deleteStorefrontCoverImage(tenantId: string, imageUrl: string) {
  try {
    const url = new URL(imageUrl);
    const marker = `/storage/v1/object/public/${STOREFRONT_MEDIA_BUCKET}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex < 0) return;
    const objectPath = decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
    if (!objectPath.startsWith(`${tenantId}/covers/`)) return;
    await client().storage.from(STOREFRONT_MEDIA_BUCKET).remove([objectPath]);
  } catch {
    // External URLs and malformed historical values are not managed uploads.
  }
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
