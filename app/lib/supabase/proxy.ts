import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseConfig, isSupabaseConfigured } from "./config";

/**
 * Application areas that require an authenticated Supabase user.
 *
 * `startsWith()` intentionally protects both the root route and
 * everything underneath it:
 *
 * /dashboard
 * /dashboard/orders
 * /admin
 * /admin/agents
 */
const PROTECTED_ROUTES = ["/dashboard", "/admin"] as const;

/**
 * Determines whether the requested pathname belongs to an
 * authenticated section of the application.
 */
function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(
    (route) =>
      pathname === route ||
      pathname.startsWith(`${route}/`),
  );
}

/**
 * Refreshes/validates the Supabase session for the current request
 * and redirects unauthenticated users away from protected routes.
 *
 * IMPORTANT:
 * Authentication here determines whether a user is signed in.
 *
 * It does NOT determine whether a signed-in user is authorized to
 * perform a particular tenant/platform action. Those permissions
 * must continue to be enforced by server APIs and Supabase RLS.
 */
export async function updateSession(
  request: NextRequest,
): Promise<NextResponse> {
  /* ================================================================
     1. ALLOW APPLICATION TO RUN WHEN SUPABASE IS NOT CONFIGURED
     ================================================================ */

  if (!isSupabaseConfigured()) {
    return NextResponse.next({ request });
  }

  /* ================================================================
     2. CREATE RESPONSE USED TO PROPAGATE REFRESHED AUTH COOKIES
     ================================================================ */

  let response = NextResponse.next({ request });

  const { url, key } = getSupabaseConfig();

  /* ================================================================
     3. CREATE REQUEST-SCOPED SUPABASE SERVER CLIENT
     ================================================================ */

  const supabase = createServerClient(url, key, {
    cookies: {
      /**
       * Supabase reads the authentication cookies from the incoming
       * request.
       */
      getAll() {
        return request.cookies.getAll();
      },

      /**
       * Supabase may refresh authentication cookies while validating
       * the session.
       *
       * Keep both the request and outgoing response synchronized.
       */
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });

        cookiesToSet.forEach(
          ({ name, value, options }) => {
            response.cookies.set(
              name,
              value,
              options,
            );
          },
        );
      },
    },
  });

  /* ================================================================
     4. VALIDATE CURRENT AUTHENTICATED USER
     ================================================================ */

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  if (!isProtectedRoute(pathname)) {
    return response;
  }

  /* ================================================================
     5. REDIRECT UNAUTHENTICATED USERS TO LOGIN
     ================================================================ */

  if (!user) {
    /**
     * Clone the current application's URL rather than accepting an
     * externally supplied redirect URL.
     *
     * This keeps the redirect on the same origin.
     */
    const loginUrl = request.nextUrl.clone();

    loginUrl.pathname = "/login";

    /**
     * Preserve the user's original INTERNAL destination.
     *
     * Example:
     *
     * /dashboard/orders?status=pending
     *
     * becomes:
     *
     * /login?next=%2Fdashboard%2Forders%3Fstatus%3Dpending
     *
     * The login handler must still validate `next` before redirecting
     * to it. Never trust a `next` query parameter merely because this
     * proxy normally generates it.
     */
    const requestedDestination =
      `${request.nextUrl.pathname}${request.nextUrl.search}`;

    loginUrl.search = "";
    loginUrl.searchParams.set(
      "next",
      requestedDestination,
    );

    return NextResponse.redirect(loginUrl);
  }

  /* ================================================================
     6. AUTHENTICATED REQUEST
     ================================================================ */

  return response;
}
