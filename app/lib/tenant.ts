import { getAllTenants, getTenantBySlug } from "@/app/lib/data";
import type { Tenant } from "@/app/types/index";

type TenantWithDomain = Tenant & { domain?: string };

export function normalizeHost(hostname: string) {
  return hostname.trim().toLowerCase();
}

export function isLocalHost(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "127.0.0.1"
  );
}

export function getTenantSlugFromHost(hostname: string): string | null {
  const cleanHost = normalizeHost(hostname).split(":")[0];
  if (!cleanHost || isLocalHost(cleanHost)) return null;
  const parts = cleanHost.split(".");
  if (parts.length < 3) return null;
  const subdomain = parts[0];
  if (subdomain === "www") return null;
  return subdomain;
}

export function resolveTenantFromHostname(hostname: string): Tenant | null {
  const slug = getTenantSlugFromHost(hostname);
  if (!slug) return null;
  return getTenantBySlug(slug) ?? null;
}

export function findTenantByDomain(domain: string): Tenant | null {
  const cleanHost = normalizeHost(domain).split(":")[0];
  return (
    getAllTenants().find(
      (tenant): tenant is TenantWithDomain =>
        typeof tenant.domain === "string" && tenant.domain === cleanHost,
    ) ?? null
  );
}

export function resolveTenantFromHost(hostname: string): Tenant | null {
  const tenantBySlug = resolveTenantFromHostname(hostname);
  if (tenantBySlug) return tenantBySlug;
  return findTenantByDomain(hostname);
}
