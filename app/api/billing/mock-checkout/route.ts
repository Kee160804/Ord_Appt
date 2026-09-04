import { getSupabaseAdminClient } from "@/app/lib/supabase/admin";
import { getSupabaseServerClient } from "@/app/lib/supabase/server";
import { PLAN_DEFINITIONS } from "@/app/lib/plans";
import {
  isValidUuid,
  readJsonBody,
  requestHasAllowedOrigin,
  safeServerError,
} from "@/app/lib/server/security";
import type { PlanType } from "@/app/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!requestHasAllowedOrigin(request))
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const supabase = await getSupabaseServerClient();
    if (!supabase)
      return Response.json(
        { error: "Billing is not configured." },
        { status: 503 },
      );
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user)
      return Response.json({ error: "Unauthorized." }, { status: 401 });
    const body = await readJsonBody<{ tenantId?: string; plan?: PlanType }>(
      request,
      4_096,
    );
    const tenantId = body.tenantId?.trim() || "";
    const plan = body.plan;
    if (!isValidUuid(tenantId) || !plan || !PLAN_DEFINITIONS[plan])
      return Response.json({ error: "Choose a valid plan." }, { status: 400 });
    const { data: membership } = await supabase
      .from("tenant_memberships")
      .select("roles(name)")
      .eq("tenant_id", tenantId)
      .eq("profile_id", authData.user.id)
      .eq("is_active", true)
      .maybeSingle();
    const roles = membership?.roles as unknown as
      { name?: string } | Array<{ name?: string }> | null;
    const role = Array.isArray(roles) ? roles[0]?.name : roles?.name;
    if (role?.toUpperCase() !== "OWNER")
      return Response.json(
        { error: "Only the business owner can change billing." },
        { status: 403 },
      );

    const admin = getSupabaseAdminClient();
    const { data, error } = await admin.rpc(
      "complete_mock_subscription_checkout",
      { p_tenant_id: tenantId, p_plan: plan },
    );
    if (error) throw error;
    return Response.json(data);
  } catch (error) {
    return safeServerError(
      "mock-subscription-checkout",
      error,
      "Unable to complete mock checkout. Please try again.",
    );
  }
}
