import { timingSafeEqual } from "node:crypto";
import { processTransactionalEmailQueue } from "@/app/lib/email/worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function authorized(request: Request, expectedSecret: string | undefined) {
  if (!expectedSecret || expectedSecret.length < 16) return false;
  const authorization = request.headers.get("authorization") ?? "";
  return safeEqual(authorization, `Bearer ${expectedSecret}`);
}

function response(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request) {
  if (!authorized(request, process.env.CRON_SECRET)) {
    return response({ ok: false, error: "Unauthorized." }, 401);
  }

  try {
    const url = new URL(request.url);
    const requestedLimit = Number(url.searchParams.get("limit") || 30);
    const result = await processTransactionalEmailQueue(requestedLimit);
    return response({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to process transactional emails.";
    console.error("[email-process]", message);
    return response({ ok: false, error: message }, 500);
  }
}

// Supabase Database Webhooks can call the same worker for near-real-time
// delivery. The body is deliberately ignored: queued records are reloaded and
// validated from Supabase instead of trusting webhook-supplied tenant data.
export async function POST(request: Request) {
  if (!authorized(request, process.env.EMAIL_WEBHOOK_SECRET)) {
    return response({ ok: false, error: "Unauthorized." }, 401);
  }

  try {
    await request.json().catch(() => null);
    const result = await processTransactionalEmailQueue(10);
    return response({ ok: true, ...result }, 202);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to process transactional emails.";
    console.error("[email-webhook]", message);
    return response({ ok: false, error: message }, 500);
  }
}
