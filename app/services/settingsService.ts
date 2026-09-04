import { getSupabaseBrowserClient } from "@/app/lib/supabase/client";
import type { BusinessHours, OrderingSettings } from "@/app/types/index";

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

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
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
      throw new Error(
        "Photo uploads are not installed yet. Apply the storefront media migration in Supabase.",
      );
    }
    throw error;
  }

  const { data } = supabase.storage
    .from(STOREFRONT_MEDIA_BUCKET)
    .getPublicUrl(objectPath);
  if (!data.publicUrl)
    throw new Error("The uploaded photo URL could not be created.");
  return data.publicUrl;
}

export async function deleteStorefrontCoverImage(
  tenantId: string,
  imageUrl: string,
) {
  try {
    const url = new URL(imageUrl);
    const marker = `/storage/v1/object/public/${STOREFRONT_MEDIA_BUCKET}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex < 0) return;
    const objectPath = decodeURIComponent(
      url.pathname.slice(markerIndex + marker.length),
    );
    if (!objectPath.startsWith(`${tenantId}/covers/`)) return;
    await client().storage.from(STOREFRONT_MEDIA_BUCKET).remove([objectPath]);
  } catch {
    // External URLs and malformed historical values are not managed uploads.
  }
}

export async function updateBusinessDetails(
  tenantId: string,
  input: BusinessDetailsInput,
) {
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

export async function updateBusinessHours(
  tenantId: string,
  hours: BusinessHours[],
) {
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

export async function getOrderingSettings(
  tenantId: string,
): Promise<OrderingSettings> {
  const { data, error } = await client()
    .from("business_settings")
    .select(
      "ordering_enabled,ordering_paused,order_types,tax_rate,discount_enabled,discount_threshold,discount_rate,minimum_order,delivery_fee,delivery_areas,preparation_minutes,ordering_open_time,ordering_close_time",
    )
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  return {
    enabled: data?.ordering_enabled !== false,
    paused: data?.ordering_paused === true,
    orderTypes: (data?.order_types ?? [
      "dine_in",
      "pickup",
      "delivery",
    ]) as OrderingSettings["orderTypes"],
    taxRate: Number(data?.tax_rate ?? 10),
    discountEnabled: data?.discount_enabled !== false,
    discountThreshold: Number(data?.discount_threshold ?? 100),
    discountRate: Number(data?.discount_rate ?? 5),
    minimumOrder: Number(data?.minimum_order ?? 0),
    deliveryFee: Number(data?.delivery_fee ?? 0),
    deliveryAreas: data?.delivery_areas ?? [],
    preparationMinutes: Number(data?.preparation_minutes ?? 30),
    openTime: data?.ordering_open_time?.slice(0, 5),
    closeTime: data?.ordering_close_time?.slice(0, 5),
  };
}

export async function updateOrderingSettings(
  tenantId: string,
  settings: OrderingSettings,
) {
  if (!settings.orderTypes.length)
    throw new Error("Enable at least one order type.");
  if (
    settings.taxRate < 0 ||
    settings.taxRate > 100 ||
    settings.discountRate < 0 ||
    settings.discountRate > 100
  )
    throw new Error("Tax and discount rates must be between 0 and 100.");
  if (
    settings.minimumOrder < 0 ||
    settings.deliveryFee < 0 ||
    settings.preparationMinutes < 5
  )
    throw new Error(
      "Enter valid non-negative order values and at least five preparation minutes.",
    );
  const { error } = await client()
    .from("business_settings")
    .upsert(
      {
        tenant_id: tenantId,
        ordering_enabled: settings.enabled,
        ordering_paused: settings.paused,
        order_types: settings.orderTypes,
        tax_rate: settings.taxRate,
        discount_enabled: settings.discountEnabled,
        discount_threshold: settings.discountThreshold,
        discount_rate: settings.discountRate,
        minimum_order: settings.minimumOrder,
        delivery_fee: settings.deliveryFee,
        delivery_areas: settings.deliveryAreas
          .map((area) => area.trim())
          .filter(Boolean),
        preparation_minutes: settings.preparationMinutes,
        ordering_open_time: settings.openTime || null,
        ordering_close_time: settings.closeTime || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id" },
    );
  if (error) throw error;
  return settings;
}
