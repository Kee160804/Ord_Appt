import { authorizeActiveSuperAdmin } from "@/app/lib/server/admin-authorization";
import { isValidUuid, safeServerError } from "@/app/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ tenantId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { tenantId } = await context.params;
    if (!isValidUuid(tenantId)) {
      return Response.json({ error: "Invalid business ID." }, { status: 400 });
    }

    const authorization = await authorizeActiveSuperAdmin(
      "Only a platform super admin can verify custom domains.",
    );
    if (!authorization.authorized) return authorization.response;

    const { admin } = authorization;

    const body = (await request.json()) as { verified?: unknown };
    if (typeof body.verified !== "boolean") {
      return Response.json(
        { error: "A verification state is required." },
        { status: 400 },
      );
    }

    const verifiedAt = body.verified ? new Date().toISOString() : null;
    const { data: tenant, error: updateError } = await admin
      .from("tenants")
      .update({ custom_domain_verified_at: verifiedAt })
      .eq("id", tenantId)
      .not("custom_domain", "is", null)
      .select("custom_domain, custom_domain_verified_at")
      .maybeSingle();
    if (updateError) throw updateError;
    if (!tenant) {
      return Response.json(
        { error: "The business has no custom domain to verify." },
        { status: 409 },
      );
    }
    return Response.json({
      domain: tenant.custom_domain,
      verified: Boolean(tenant.custom_domain_verified_at),
    });
  } catch (error) {
    return safeServerError(
      "admin-domain-verification",
      error,
      "Unable to update custom-domain verification.",
    );
  }
}
