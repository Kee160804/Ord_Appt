import { timingSafeEqual } from "node:crypto";

import { processTransactionalEmailQueue } from "@/app/lib/email/worker";
import { safeServerError } from "@/app/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Maximum number of jobs that one cron request may ask the worker to process.
 *
 * The worker also performs its own bounds checking, but keeping the HTTP
 * boundary bounded avoids passing unreasonable values farther into the system.
 */
const DEFAULT_CRON_LIMIT = 30;
const MAX_CRON_LIMIT = 100;
const WEBHOOK_BATCH_LIMIT = 10;

/**
 * Compares two secrets using Node's constant-time comparison.
 *
 * timingSafeEqual requires buffers with identical lengths, so a length check
 * must happen before the comparison.
 */
function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

/**
 * Validates a Bearer token against a server-only secret.
 *
 * Secrets shorter than 16 characters are intentionally rejected so an
 * accidentally weak/misconfigured secret cannot enable this endpoint.
 */
function authorized(
  request: Request,
  expectedSecret: string | undefined,
): boolean {
  const secret = expectedSecret?.trim();

  if (!secret || secret.length < 16) {
    return false;
  }

  const authorization = request.headers.get("authorization") ?? "";

  return safeEqual(authorization, `Bearer ${secret}`);
}

/**
 * Creates a JSON response that must never be cached.
 *
 * This endpoint returns operational queue information and should always be
 * evaluated fresh.
 */
function response(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Safely parses the optional cron batch limit.
 *
 * Invalid, negative, fractional, or excessively large values cannot escape
 * the configured 1..MAX_CRON_LIMIT range.
 */
function getRequestedLimit(request: Request): number {
  const url = new URL(request.url);
  const rawLimit = url.searchParams.get("limit");

  if (!rawLimit) {
    return DEFAULT_CRON_LIMIT;
  }

  const parsed = Number(rawLimit);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_CRON_LIMIT;
  }

  return Math.max(1, Math.min(Math.trunc(parsed), MAX_CRON_LIMIT));
}

/**
 * Scheduled email-queue processor.
 *
 * Expected caller:
 *   A trusted cron/scheduler sending:
 *
 *     Authorization: Bearer <CRON_SECRET>
 *
 * Security:
 * - CRON_SECRET is server-only.
 * - Unauthorized requests never reach the queue worker.
 * - Queue jobs are claimed/revalidated by the centralized worker.
 */
export async function GET(request: Request) {
  if (!authorized(request, process.env.CRON_SECRET)) {
    return response({ ok: false, error: "Unauthorized." }, 401);
  }

  try {
    const requestedLimit = getRequestedLimit(request);
    const result = await processTransactionalEmailQueue(requestedLimit);

    return response({
      ok: true,
      ...result,
    });
  } catch (error) {
    return safeServerError(
      "email-process",
      error,
      "Unable to process transactional emails.",
    );
  }
}

/**
 * Near-real-time queue processor for trusted Supabase Database Webhooks.
 *
 * IMPORTANT:
 * The webhook body is deliberately NOT trusted for tenant, recipient, event,
 * or transaction data. Its purpose is only to wake the worker.
 *
 * The centralized worker then claims jobs from Supabase and reloads/revalidates
 * their authoritative source records before sending email.
 *
 * Expected caller:
 *   Supabase Database Webhook sending:
 *
 *     Authorization: Bearer <EMAIL_WEBHOOK_SECRET>
 *
 * This secret should be different from CRON_SECRET.
 */
export async function POST(request: Request) {
  if (!authorized(request, process.env.EMAIL_WEBHOOK_SECRET)) {
    return response({ ok: false, error: "Unauthorized." }, 401);
  }

  try {
    /**
     * Consume the webhook body when present, but intentionally do not use its
     * contents for authorization or email delivery decisions.
     */
    await request.json().catch(() => null);

    const result = await processTransactionalEmailQueue(WEBHOOK_BATCH_LIMIT);

    /**
     * 202 indicates that the webhook trigger was accepted and the queue worker
     * was invoked successfully.
     */
    return response(
      {
        ok: true,
        ...result,
      },
      202,
    );
  } catch (error) {
    return safeServerError(
      "email-webhook",
      error,
      "Unable to process transactional emails.",
    );
  }
}
