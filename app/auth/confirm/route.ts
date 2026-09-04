import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/app/lib/supabase/server";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const code = request.nextUrl.searchParams.get("code");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const requestedNext =
    request.nextUrl.searchParams.get("next") ?? "/dashboard";
  const next = requestedNext.startsWith("/") ? requestedNext : "/dashboard";

  if ((tokenHash && type) || code) {
    const supabase = await getSupabaseServerClient();
    if (supabase) {
      const { error } = code
        ? await supabase.auth.exchangeCodeForSession(code)
        : await supabase.auth.verifyOtp({
            type: type!,
            token_hash: tokenHash!,
          });
      if (!error) {
        const destination = new URL(next, request.url);
        destination.searchParams.set(
          type === "recovery" || next.startsWith("/reset-password")
            ? "recovery"
            : "confirmed",
          "1",
        );
        return NextResponse.redirect(destination);
      }
    }
  }

  const errorDestination = new URL(
    next.startsWith("/reset-password") ? "/reset-password" : "/login",
    request.url,
  );
  errorDestination.searchParams.set(
    "error",
    next.startsWith("/reset-password")
      ? "This password reset link is invalid or has expired. Request a new link."
      : "Unable to confirm your email. Request a new confirmation link.",
  );
  return NextResponse.redirect(errorDestination);
}
