import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/app/lib/supabase/server";
import { getSupabaseAdminClient } from "@/app/lib/supabase/admin";

/**
 * Admin Layout
 *
 * SECURITY PURPOSE:
 * ------------------------------------------------------------------
 * This layout protects every route under /admin.
 *
 * Authorization is performed on the SERVER before any admin page
 * content is rendered.
 *
 * This replaces the previous client-only authorization approach,
 * where useEffect() redirected unauthorized users only after the
 * page had already started loading in the browser.
 *
 * IMPORTANT:
 * - Authentication is checked using the user's Supabase session.
 * - Authorization is checked using the profiles.platform_role field.
 * - Only active SUPER_ADMIN users may continue.
 * - Client-side hiding/redirects may still be used for UX elsewhere,
 *   but they are not treated as security controls.
 * ------------------------------------------------------------------
 */

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  /* ================================================================
     1. GET SERVER-SIDE SUPABASE SESSION CLIENT
     ================================================================ */

  const supabase = await getSupabaseServerClient();

  /**
   * If Supabase is unavailable, do not allow the admin area
   * to continue loading.
   *
   * In production, failing closed is safer than accidentally allowing
   * access because an authorization dependency is unavailable.
   */
  if (!supabase) {
    redirect("/login?next=/admin");
  }

  /* ================================================================
     2. VERIFY AUTHENTICATED USER
     ================================================================ */

  /**
   * auth.getUser() verifies the session against Supabase rather than
   * trusting client-side state.
   */
  const { data: authData, error: authError } =
    await supabase.auth.getUser();

  if (authError || !authData.user) {
    /**
     * User is not authenticated.
     *
     * Preserve the intended destination so the user may return to the
     * admin area after a successful login.
     */
    redirect("/login?next=/admin");
  }

  /* ================================================================
     3. LOAD SERVER-SIDE PROFILE
     ================================================================ */

  /**
   * Use the admin client only after authentication has been verified.
   *
   * The admin/service-role client bypasses RLS, so it must never be
   * exposed to the browser.
   */
  const admin = getSupabaseAdminClient();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, platform_role, is_active")
    .eq("id", authData.user.id)
    .maybeSingle();

  /**
   * Authorization-related database errors should fail closed.
   */
  if (profileError || !profile) {
    redirect("/login?next=/admin");
  }

  /* ================================================================
     4. VERIFY ACTIVE SUPER ADMIN ROLE
     ================================================================ */

  const isSuperAdmin =
    profile.is_active === true &&
    profile.platform_role?.toUpperCase() === "SUPER_ADMIN";

  if (!isSuperAdmin) {
    /**
     * The user is authenticated but is not authorized for the platform
     * administration area.
     *
     * Sending them to the regular dashboard is usually clearer than
     * returning them to login because their credentials are valid.
     */
    redirect("/dashboard");
  }

  /* ================================================================
     5. RENDER PROTECTED ADMIN AREA
     ================================================================ */

  return (
    <div className="min-h-dvh bg-slate-50 light:bg-white">
      {children}
    </div>
  );
}
