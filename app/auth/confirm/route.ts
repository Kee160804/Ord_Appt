import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseServerClient } from "@/app/lib/supabase/server";

/**
 * Safely validate an internal redirect path.
 *
 * SECURITY:
 * ------------------------------------------------------------------
 * Only same-origin, application-relative paths are allowed.
 *
 * Valid examples:
 *   /dashboard
 *   /reset-password
 *   /dashboard/settings
 *
 * Rejected examples:
 *   https://malicious.example
 *   //malicious.example
 *   \malicious.example
 *   /\malicious.example
 *
 * The returned value is guaranteed to remain on the current
 * application's origin.
 * ------------------------------------------------------------------
 */
function getSafeRedirectPath(
  requestedPath: string | null,
  requestUrl: string,
): string {
  const fallback = "/dashboard";

  if (!requestedPath) {
    return fallback;
  }

  /**
   * Internal application paths must begin with exactly one "/".
   *
   * "//example.com" is a protocol-relative URL and must be rejected.
   */
  if (!requestedPath.startsWith("/") || requestedPath.startsWith("//")) {
    return fallback;
  }

  /**
   * Backslashes can sometimes be normalized by URL parsers/browsers
   * in surprising ways, so reject them completely.
   */
  if (requestedPath.includes("\\")) {
    return fallback;
  }

  try {
    const applicationOrigin = new URL(requestUrl).origin;
    const destination = new URL(requestedPath, applicationOrigin);

    /**
     * Defense in depth:
     *
     * Even after the path checks above, verify that URL resolution did
     * not change the origin.
     */
    if (destination.origin !== applicationOrigin) {
      return fallback;
    }

    /**
     * Return the complete internal path, including query string and
     * hash if one was supplied.
     */
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return fallback;
  }
}

/**
 * GET /auth/confirm
 *
 * Handles Supabase authentication callback links for:
 * - Email confirmation
 * - Password recovery
 * - PKCE/code exchange callbacks
 *
 * The `next` query parameter is validated before being used as a
 * redirect destination.
 */
export async function GET(request: NextRequest) {
  /* ================================================================
     1. READ CALLBACK PARAMETERS
     ================================================================ */

  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const code = request.nextUrl.searchParams.get("code");

  const type = request.nextUrl.searchParams.get(
    "type",
  ) as EmailOtpType | null;

  const requestedNext =
    request.nextUrl.searchParams.get("next");

  /**
   * SECURITY FIX:
   *
   * Previously:
   *
   * const next =
   *   requestedNext.startsWith("/")
   *     ? requestedNext
   *     : "/dashboard";
   *
   * That allowed values such as:
   *
   * //malicious.example
   *
   * which could resolve to an external origin.
   */
  const next = getSafeRedirectPath(
    requestedNext,
    request.url,
  );

  /* ================================================================
     2. ATTEMPT SUPABASE AUTH CONFIRMATION
     ================================================================ */

  if ((tokenHash && type) || code) {
    const supabase = await getSupabaseServerClient();

    if (supabase) {
      /**
       * PKCE authentication flows return a `code`.
       *
       * OTP-style confirmation links return:
       * - token_hash
       * - type
       */
      const { error } = code
        ? await supabase.auth.exchangeCodeForSession(code)
        : await supabase.auth.verifyOtp({
            type: type!,
            token_hash: tokenHash!,
          });

      /* ============================================================
         3. SUCCESSFUL CONFIRMATION
         ============================================================ */

      if (!error) {
        /**
         * Build the destination from the validated internal path.
         *
         * request.nextUrl.origin is used explicitly so the callback
         * can never redirect to an external host.
         */
        const destination = new URL(
          next,
          request.nextUrl.origin,
        );

        /**
         * Password recovery links need a recovery flag so the
         * reset-password page knows the callback was successfully
         * validated.
         *
         * Normal confirmations receive confirmed=1.
         */
        const isRecoveryFlow =
          type === "recovery" ||
          destination.pathname.startsWith(
            "/reset-password",
          );

        destination.searchParams.set(
          isRecoveryFlow ? "recovery" : "confirmed",
          "1",
        );

        return NextResponse.redirect(destination);
      }
    }
  }

  /* ================================================================
     4. FAILED / EXPIRED CONFIRMATION
     ================================================================ */

  /**
   * Determine whether this was intended to be a password recovery
   * callback.
   *
   * We inspect the already validated destination rather than the raw
   * user-controlled `next` value.
   */
  const safeNextUrl = new URL(
    next,
    request.nextUrl.origin,
  );

  const isPasswordRecovery =
    type === "recovery" ||
    safeNextUrl.pathname.startsWith(
      "/reset-password",
    );

  /**
   * Failed recovery callbacks stay on the reset-password page so the
   * user receives the correct recovery-specific message.
   *
   * Other failed confirmations return to login.
   */
  const errorDestination = new URL(
    isPasswordRecovery
      ? "/reset-password"
      : "/login",
    request.nextUrl.origin,
  );

  errorDestination.searchParams.set(
    "error",
    isPasswordRecovery
      ? "This password reset link is invalid or has expired. Request a new link."
      : "Unable to confirm your email. Request a new confirmation link.",
  );

  return NextResponse.redirect(errorDestination);
}
