import "server-only";

import { createHash, randomInt, randomUUID } from "node:crypto";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DEFAULT_RATE_LIMIT_RETRY_SECONDS = 60;

export function generateSecurePassword(length = 18) {
  const groups = [
    "ABCDEFGHJKLMNPQRSTUVWXYZ",
    "abcdefghijkmnopqrstuvwxyz",
    "23456789",
    "!@#$%&*",
  ];

  const requestedLength = Math.max(
    Number.isFinite(length) ? Math.floor(length) : 18,
    groups.length,
  );

  const all = groups.join("");
  const characters = groups.map((group) => group[randomInt(group.length)]);

  while (characters.length < requestedLength) {
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
  const normalized = value.trim();
  return normalized.length <= 254 && EMAIL_PATTERN.test(normalized);
}

export function isValidUuid(value: string) {
  return UUID_PATTERN.test(value.trim());
}

export function safeServerError(
  scope: string,
  error: unknown,
  fallback: string,
) {
  const reference = randomUUID();

  console.error(`[${scope}] ${reference}`, error);

  return Response.json(
    { error: fallback, reference },
    {
      status: 500,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

/**
 * Only known business-rule errors are exposed to public callers.
 *
 * Longer-term improvement:
 * replace fragment matching with structured application error codes.
 */
export function publicOperationError(error: unknown, fallback: string) {
  const raw =
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
      ? error.message.trim()
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

/**
 * Creates a one-way fingerprint for rate limiting.
 *
 * This is NOT an authentication identity and must never be used for
 * authorization decisions.
 */
export function requestFingerprint(request: Request, identity = "") {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();

  const ip =
    request.headers.get("cf-connecting-ip")?.trim() || forwarded || "unknown";

  const agent =
    request.headers.get("user-agent")?.trim().slice(0, 160) || "unknown";

  return createHash("sha256")
    .update(`${ip}|${agent}|${identity.trim().toLowerCase()}`)
    .digest("hex");
}

/**
 * Provides basic same-origin protection for browser-originated requests.
 *
 * Requests without Origin remain allowed because legitimate server clients
 * may omit it. This function must therefore not replace authentication,
 * authorization or rate limiting.
 */
export function requestHasAllowedOrigin(request: Request) {
  const origin = request.headers.get("origin");

  if (!origin) {
    return true;
  }

  try {
    const suppliedOrigin = new URL(origin);

    if (
      suppliedOrigin.username ||
      suppliedOrigin.password ||
      suppliedOrigin.pathname !== "/" ||
      suppliedOrigin.search ||
      suppliedOrigin.hash
    ) {
      return false;
    }

    return suppliedOrigin.origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

/**
 * Reads a JSON request while enforcing an application-level body limit.
 *
 * Content-Length is only an early check. The actual body size is checked
 * afterward because clients can omit or falsify Content-Length.
 */
export async function readJsonBody<T>(
  request: Request,
  maximumBytes = 32_768,
): Promise<T> {
  const safeMaximumBytes =
    Number.isFinite(maximumBytes) && maximumBytes > 0
      ? Math.floor(maximumBytes)
      : 32_768;

  const contentLengthHeader = request.headers.get("content-length");

  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);

    if (
      Number.isFinite(contentLength) &&
      contentLength > safeMaximumBytes
    ) {
      throw new Error("REQUEST_TOO_LARGE");
    }
  }

  const text = await request.text();

  if (new TextEncoder().encode(text).byteLength > safeMaximumBytes) {
    throw new Error("REQUEST_TOO_LARGE");
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("INVALID_JSON");
  }
}

export type PublicRateLimitResult = {
  allowed: boolean;
  retryAfter: number;
};

/**
 * Enforces the distributed Supabase-backed public rate limit.
 *
 * Production intentionally FAILS CLOSED if the distributed limiter cannot be
 * reached. An in-memory fallback is unreliable on serverless platforms such
 * as Vercel because separate instances do not share memory.
 *
 * Development may fail open so local development is not blocked before the
 * Supabase protection migration/service key is available.
 */
export async function enforcePublicRateLimit(
  request: Request,
  action: string,
  tenantId: string,
  identity: string,
  limit: number,
  windowSeconds: number,
): Promise<PublicRateLimitResult> {
  const normalizedAction = action.trim();
  const normalizedTenantId = tenantId.trim();

  if (
    !normalizedAction ||
    !isValidUuid(normalizedTenantId) ||
    !Number.isInteger(limit) ||
    limit <= 0 ||
    !Number.isInteger(windowSeconds) ||
    windowSeconds <= 0
  ) {
    console.error("[public-rate-limit] Invalid limiter configuration.");

    return {
      allowed: false,
      retryAfter: DEFAULT_RATE_LIMIT_RETRY_SECONDS,
    };
  }

  const fingerprint = requestFingerprint(request, identity);

  try {
    const { getSupabaseAdminClient } = await import(
      "@/app/lib/supabase/admin"
    );

    const { data, error } = await getSupabaseAdminClient().rpc(
      "check_public_rate_limit",
      {
        p_tenant_id: normalizedTenantId,
        p_action: normalizedAction,
        p_fingerprint: fingerprint,
        p_limit: limit,
        p_window_seconds: windowSeconds,
      },
    );

    if (error) {
      throw error;
    }

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("Rate-limit RPC returned an invalid response.");
    }

    const result = data as {
      allowed?: unknown;
      retryAfter?: unknown;
      retry_after?: unknown;
    };

    if (typeof result.allowed !== "boolean") {
      throw new Error(
        "Rate-limit RPC did not return a valid allowed flag.",
      );
    }

    const rawRetryAfter =
      result.retryAfter ?? result.retry_after ?? 0;

    const parsedRetryAfter = Number(rawRetryAfter);

    return {
      allowed: result.allowed,
      retryAfter:
        Number.isFinite(parsedRetryAfter) && parsedRetryAfter > 0
          ? Math.ceil(parsedRetryAfter)
          : result.allowed
            ? 0
            : Math.max(1, windowSeconds),
    };
  } catch (error) {
    console.error(
      "[public-rate-limit] Distributed rate limiter unavailable.",
      error,
    );

    /**
     * Local development can continue without the distributed limiter.
     *
     * Production intentionally fails closed.
     */
    if (process.env.NODE_ENV !== "production") {
      return {
        allowed: true,
        retryAfter: 0,
      };
    }

    return {
      allowed: false,
      retryAfter: Math.max(1, windowSeconds),
    };
  }
}

export function rateLimitResponse(retryAfter: number) {
  const safeRetryAfter =
    Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.ceil(retryAfter)
      : DEFAULT_RATE_LIMIT_RETRY_SECONDS;

  return Response.json(
    {
      error: "Too many requests. Please wait a moment and try again.",
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(safeRetryAfter),
        "Cache-Control": "no-store",
      },
    },
  );
}
