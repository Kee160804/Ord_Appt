import "server-only";

import { createHash, randomInt } from "node:crypto";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function generateSecurePassword(length = 18) {
  const groups = [
    "ABCDEFGHJKLMNPQRSTUVWXYZ",
    "abcdefghijkmnopqrstuvwxyz",
    "23456789",
    "!@#$%&*",
  ];
  const all = groups.join("");
  const characters = groups.map((group) => group[randomInt(group.length)]);
  while (characters.length < Math.max(length, groups.length)) {
    characters.push(all[randomInt(all.length)]);
  }
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [characters[index], characters[swapIndex]] = [
      characters[swapIndex],
      characters[index],
    ];
  }
  return characters.join("");
}

export function isValidEmail(value: string) {
  return value.length <= 254 && EMAIL_PATTERN.test(value);
}

export function isValidUuid(value: string) {
  return UUID_PATTERN.test(value);
}

export function safeServerError(
  scope: string,
  error: unknown,
  fallback: string,
) {
  const reference = crypto.randomUUID();
  console.error(`[${scope}] ${reference}`, error);
  return Response.json(
    { error: fallback, reference },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}

export function publicOperationError(error: unknown, fallback: string) {
  const raw =
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
      ? error.message
      : "";
  const allowed = [
    "valid",
    "required",
    "unavailable",
    "not accepting",
    "closed",
    "minimum order",
    "stock",
    "cart",
    "quantity",
    "add-on",
    "discount code",
    "does not apply",
    "future",
    "outside business hours",
    "no longer available",
    "too many",
    "table number",
    "delivery address",
    "delivery area",
    "pickup time",
  ];
  return allowed.some((fragment) => raw.toLowerCase().includes(fragment))
    ? raw
    : fallback;
}

export function requestFingerprint(request: Request, identity = "") {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const ip =
    request.headers.get("cf-connecting-ip")?.trim() || forwarded || "unknown";
  const agent = request.headers.get("user-agent")?.slice(0, 160) || "unknown";
  return createHash("sha256")
    .update(`${ip}|${agent}|${identity.toLowerCase()}`)
    .digest("hex");
}

export function requestHasAllowedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function readJsonBody<T>(
  request: Request,
  maximumBytes = 32_768,
): Promise<T> {
  const length = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(length) && length > maximumBytes)
    throw new Error("REQUEST_TOO_LARGE");
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maximumBytes)
    throw new Error("REQUEST_TOO_LARGE");
  return JSON.parse(text) as T;
}

type RateBucket = { count: number; resetAt: number };
const fallbackBuckets = new Map<string, RateBucket>();

export async function enforcePublicRateLimit(
  request: Request,
  action: string,
  tenantId: string,
  identity: string,
  limit: number,
  windowSeconds: number,
) {
  const fingerprint = requestFingerprint(request, identity);
  try {
    const { getSupabaseAdminClient } = await import("@/app/lib/supabase/admin");
    const { data, error } = await getSupabaseAdminClient().rpc(
      "check_public_rate_limit",
      {
        p_tenant_id: tenantId,
        p_action: action,
        p_fingerprint: fingerprint,
        p_limit: limit,
        p_window_seconds: windowSeconds,
      },
    );
    if (!error && data && typeof data === "object") {
      const result = data as { allowed?: boolean; retryAfter?: number };
      return {
        allowed: result.allowed !== false,
        retryAfter: Number(result.retryAfter || 0),
      };
    }
  } catch {
    // Local development can operate without a service key or the protection
    // migration. The in-process limiter remains a conservative fallback.
  }

  const now = Date.now();
  const key = `${tenantId}:${action}:${fingerprint}`;
  const current = fallbackBuckets.get(key);
  if (!current || current.resetAt <= now) {
    fallbackBuckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, retryAfter: 0 };
  }
  current.count += 1;
  return {
    allowed: current.count <= limit,
    retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  };
}

export function rateLimitResponse(retryAfter: number) {
  return Response.json(
    { error: "Too many requests. Please wait a moment and try again." },
    {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, retryAfter)) },
    },
  );
}
