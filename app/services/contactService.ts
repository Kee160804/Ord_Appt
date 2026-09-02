import { getSupabaseBrowserClient } from "@/app/lib/supabase/client";

export interface StorefrontContactInput {
  tenantId: string;
  name: string;
  email: string;
  subject?: string;
  message: string;
}

export async function submitStorefrontContactMessage(input: StorefrontContactInput) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Storefront messaging is not configured.");
  const { data, error } = await supabase.rpc("submit_storefront_contact_message", {
    p_tenant_id: input.tenantId,
    p_sender_name: input.name.trim(),
    p_sender_email: input.email.trim().toLowerCase(),
    p_subject: input.subject?.trim() || "",
    p_message: input.message.trim(),
  });
  if (error) {
    if (error.code === "PGRST202") {
      throw new Error("Storefront messaging is not installed yet. Apply the transactional email migration in Supabase.");
    }
    throw new Error(error.message);
  }
  return data as string;
}
