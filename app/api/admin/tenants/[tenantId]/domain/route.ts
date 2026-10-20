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
      "Only a platform super admin can manage storefront URL access.",
    );
    if (!authorization.authorized) return authorization.response;

    const { admin } = authorization;

    const body = (await request.json()) as {
      verified?: unknown;
      allowStorefrontUrlEdit?: unknown;
    };
    if (typeof body.allowStorefrontUrlEdit === "boolean") {
      const { data: tenant, error: updateError } = await admin
        .from("tenants")
        .update({ allow_storefront_url_edit: body.allowStorefrontUrlEdit })
        .eq("id", tenantId)
        .select(
          "custom_domain,custom_domain_verified_at,allow_storefront_url_edit",
        )
        .maybeSingle();
      if (updateError) throw updateError;
      if (!tenant) {
        return Response.json({ error: "Business not found." }, { status: 404 });
      }
      return Response.json({
        domain: tenant.custom_domain,
        verified: Boolean(tenant.custom_domain_verified_at),
        allowStorefrontUrlEdit: tenant.allow_storefront_url_edit,
      });
    }

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
