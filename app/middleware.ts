import { NextRequest, NextResponse } from "next/server";
import { resolveTenantFromHost, isLocalHost } from "@/app/lib/tenant";

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/store-front/:path*", "/(.*)"],
};

export function middleware(request: NextRequest) {
  const hostname = request.headers.get("host")?.split(":")[0] ?? "";
  const url = request.nextUrl.clone();

  if (isLocalHost(hostname)) {
    return NextResponse.next();
  }

  const tenant = resolveTenantFromHost(hostname);
  if (!tenant) {
    const invalidRoute = url.pathname.startsWith("/admin") || url.pathname.startsWith("/dashboard");
    if (invalidRoute) {
      url.pathname = "/login";
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  request.headers.set("x-tenant-id", tenant.id);
  request.headers.set("x-tenant-slug", tenant.slug);

  return NextResponse.next();
}
