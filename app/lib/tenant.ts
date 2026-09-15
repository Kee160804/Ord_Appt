const RESERVED_SUBDOMAINS = new Set(["api", "app", "admin", "www"]);

export function normalizeHost(hostname: string) {
  const forwardedHost = hostname.split(",", 1)[0]?.trim().toLowerCase() ?? "";
  if (forwardedHost.startsWith("[")) {
    const closingBracket = forwardedHost.indexOf("]");
    return closingBracket >= 0
      ? forwardedHost.slice(1, closingBracket)
      : forwardedHost;
  }
  return forwardedHost.replace(/:\d+$/, "").replace(/\.$/, "");
}

export function isLocalHost(hostname: string) {
  const host = normalizeHost(hostname);
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "127.0.0.1" ||
    host === "::1"
  );
}

export function appRootDomain(appUrl?: string) {
  const configuredRoot = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim();
  if (configuredRoot) return normalizeHost(configuredRoot);
  if (!appUrl) return "";
  try {
    return normalizeHost(new URL(appUrl).hostname);
  } catch {
    return normalizeHost(appUrl);
  }
}

export function getTenantSlugFromHost(
  hostname: string,
  rootDomain = appRootDomain(process.env.NEXT_PUBLIC_APP_URL),
): string | null {
  const host = normalizeHost(hostname);
  const root = normalizeHost(rootDomain);
  let subdomain = "";

  if (host.endsWith(".localhost")) {
    subdomain = host.slice(0, -".localhost".length);
  } else if (root && host.endsWith(`.${root}`)) {
    subdomain = host.slice(0, -(root.length + 1));
  }

  if (
    !subdomain ||
    subdomain.includes(".") ||
    RESERVED_SUBDOMAINS.has(subdomain) ||
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain)
  ) {
    return null;
  }
  return subdomain;
}

export function isCustomDomainCandidate(
  hostname: string,
  rootDomain = appRootDomain(process.env.NEXT_PUBLIC_APP_URL),
) {
  const host = normalizeHost(hostname);
  const root = normalizeHost(rootDomain);
  return Boolean(
    host &&
    !isLocalHost(host) &&
    !host.endsWith(".vercel.app") &&
    (!root || (host !== root && !host.endsWith(`.${root}`))),
  );
}
