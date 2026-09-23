import { authorizeActiveSuperAdmin } from "@/app/lib/server/admin-authorization";
import {
  isValidUuid,
  readJsonBody,
  requestHasAllowedOrigin,
  safeServerError,
} from "@/app/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = new Set([
  "RECEIVED",
  "IDENTITY_VERIFICATION",
  "IN_PROGRESS",
  "COMPLETED",
  "DENIED",
]);
const IDENTITY_STATUSES = new Set([
  "PENDING",
  "VERIFIED",
  "FAILED",
  "NOT_REQUIRED",
]);

interface UpdateRequest {
  id?: string;
  status?: string;
  identityStatus?: string;
  resolutionNotes?: string;
}

export async function GET() {
  try {
    const authorization = await authorizeActiveSuperAdmin(
      "Only a platform super admin can review privacy requests.",
    );
    if (!authorization.authorized) return authorization.response;

    const { data, error } = await authorization.admin
      .from("privacy_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .range(0, 199);
    if (error) throw error;

    return Response.json(
      { requests: data ?? [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return safeServerError(
      "admin-privacy-request-list",
      error,
      "Unable to load privacy requests.",
    );
  }
}

export async function PATCH(request: Request) {
  try {
    if (!requestHasAllowedOrigin(request)) {
      return Response.json(
        { error: "Invalid request origin." },
        { status: 403 },
      );
    }

    const authorization = await authorizeActiveSuperAdmin(
      "Only a platform super admin can update privacy requests.",
    );
    if (!authorization.authorized) return authorization.response;

    const body = await readJsonBody<UpdateRequest>(request, 8_192);
    const id = body.id?.trim() ?? "";
    const status = body.status?.trim().toUpperCase() ?? "";
    const identityStatus = body.identityStatus?.trim().toUpperCase() ?? "";
    const resolutionNotes = body.resolutionNotes?.trim() || null;

    if (
      !isValidUuid(id) ||
      !STATUSES.has(status) ||
      !IDENTITY_STATUSES.has(identityStatus)
    ) {
      return Response.json(
        { error: "Choose valid request and identity statuses." },
        { status: 400 },
      );
    }
    if (resolutionNotes && resolutionNotes.length > 5_000) {
      return Response.json(
        { error: "Resolution notes must be 5,000 characters or fewer." },
        { status: 400 },
      );
    }
    if (
      status === "COMPLETED" &&
      !["VERIFIED", "NOT_REQUIRED"].includes(identityStatus)
    ) {
      return Response.json(
        { error: "Verify identity before completing this request." },
        { status: 400 },
      );
    }
    if (
      ["COMPLETED", "DENIED"].includes(status) &&
      (!resolutionNotes || resolutionNotes.length < 10)
    ) {
      return Response.json(
        { error: "Add resolution notes before closing this request." },
        { status: 400 },
      );
    }

    const { data: current, error: currentError } = await authorization.admin
      .from("privacy_requests")
      .select("id, identity_status")
      .eq("id", id)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!current) {
      return Response.json(
        { error: "Privacy request not found." },
        { status: 404 },
      );
    }

    const now = new Date().toISOString();
    const terminal = status === "COMPLETED" || status === "DENIED";
    const { data: updated, error: updateError } = await authorization.admin
      .from("privacy_requests")
      .update({
        status,
        identity_status: identityStatus,
        identity_verified_at:
          identityStatus === "VERIFIED"
            ? current.identity_status === "VERIFIED"
              ? undefined
              : now
            : null,
        resolution_notes: resolutionNotes,
        resolved_at: terminal ? now : null,
        assigned_to: authorization.userId,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (updateError) throw updateError;

    return Response.json(
      { request: updated },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "REQUEST_TOO_LARGE") {
      return Response.json(
        { error: "The request is too large." },
        { status: 413 },
      );
    }
    if (error instanceof Error && error.message === "INVALID_JSON") {
      return Response.json({ error: "Invalid request." }, { status: 400 });
    }
    return safeServerError(
      "admin-privacy-request-update",
      error,
      "Unable to update the privacy request.",
    );
  }
}
