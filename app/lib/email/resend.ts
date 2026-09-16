import "server-only";

import { Resend } from "resend";

import {
  buildTransactionalEmail,
  type TransactionalEmailInput,
} from "./templates";

/**
 * Input used by the centralized transactional email transport.
 *
 * SECURITY / RELIABILITY:
 * - `to` is validated before delivery.
 * - `replyTo` is optional and validated when supplied.
 * - `idempotencyKey` prevents duplicate provider submissions.
 */
export interface SendTransactionalEmailInput extends TransactionalEmailInput {
  to: string;
  idempotencyKey: string;
  replyTo?: string | null;
}

/**
 * Result returned after Resend accepts the message.
 *
 * `providerMessageId` should be stored by the email worker so later
 * delivery webhooks can correlate Resend events with the queued message.
 */
export interface SendTransactionalEmailResult {
  providerMessageId: string;
  recipient: string;
  eventType: string;
}

/**
 * Lazily-created Resend client.
 *
 * Keeping this module server-only ensures the API key is never bundled
 * into browser code.
 */
let resendClient: Resend | null = null;

/**
 * Reads a required server-side environment variable.
 *
 * Never return or log the actual secret value.
 */
function requiredServerEnv(
  name: "RESEND_API_KEY" | "RESEND_FROM_EMAIL",
): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is not configured on the server.`);
  }

  return value;
}

/**
 * Lightweight email validation used for transactional delivery.
 *
 * This intentionally does not attempt full RFC mailbox validation.
 * It rejects clearly invalid addresses before calling Resend.
 */
export function isValidEmailAddress(value: string): boolean {
  const normalized = value.trim();

  return (
    normalized.length > 0 &&
    normalized.length <= 254 &&
    /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(normalized)
  );
}

/**
 * Validates the configured sender.
 *
 * RESEND_FROM_EMAIL may be configured either as:
 *
 *   notifications@yuhbusiness.com
 *
 * or:
 *
 *   YuhBusiness <notifications@yuhbusiness.com>
 *
 * Extract only the mailbox portion for validation.
 */
function getConfiguredSender(): string {
  const configured = requiredServerEnv("RESEND_FROM_EMAIL");

  const angleBracketMatch = configured.match(/<([^<>]+)>/);
  const mailbox = (angleBracketMatch?.[1] ?? configured).trim();

  if (!isValidEmailAddress(mailbox)) {
    throw new Error(
      "RESEND_FROM_EMAIL does not contain a valid sender email address.",
    );
  }

  return configured;
}

/**
 * Returns the singleton Resend client.
 */
function client(): Resend {
  if (!resendClient) {
    resendClient = new Resend(requiredServerEnv("RESEND_API_KEY"));
  }

  return resendClient;
}

/**
 * Normalizes the idempotency key before it is sent to Resend.
 *
 * The worker should generate a stable key for one logical email event.
 * Reusing the same key prevents accidental duplicate provider submissions.
 */
function normalizeIdempotencyKey(value: string): string {
  const normalized = value.trim().slice(0, 256);

  if (!normalized) {
    throw new Error("A valid email idempotency key is required.");
  }

  return normalized;
}

/**
 * Normalizes the event tag sent to Resend.
 *
 * Tags are useful for provider-side filtering and debugging.
 */
function normalizeEventTag(eventType: string): string {
  const normalized = eventType
    .trim()
    .toLowerCase()
    .replaceAll("_", "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 256);

  return normalized || "transactional-email";
}

/**
 * Sends one transactional email through Resend.
 *
 * IMPORTANT:
 * This function only confirms that Resend accepted the message.
 * It does NOT prove that the email was delivered to the recipient.
 *
 * Final delivery state should later be updated from signed Resend
 * delivery webhooks such as:
 *
 * - email.delivered
 * - email.bounced
 * - email.complained
 * - email.delivery_delayed
 */
export async function sendTransactionalEmail(
  input: SendTransactionalEmailInput,
): Promise<SendTransactionalEmailResult> {
  /* ----------------------------------------------------------------
     1. Normalize recipient
     ---------------------------------------------------------------- */

  const recipient = input.to.trim().toLowerCase();

  if (!isValidEmailAddress(recipient)) {
    throw new Error("The recipient email address is invalid.");
  }

  /* ----------------------------------------------------------------
     2. Normalize optional reply-to address
     ---------------------------------------------------------------- */

  const replyTo = input.replyTo?.trim().toLowerCase();

  if (replyTo && !isValidEmailAddress(replyTo)) {
    throw new Error("The reply-to email address is invalid.");
  }

  /* ----------------------------------------------------------------
     3. Validate transport metadata
     ---------------------------------------------------------------- */

  const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);
  const sender = getConfiguredSender();
  const eventTag = normalizeEventTag(input.eventType);

  /* ----------------------------------------------------------------
     4. Render transactional template
     ---------------------------------------------------------------- */

  const rendered = buildTransactionalEmail(input);

  /* ----------------------------------------------------------------
     5. Submit to Resend
     ---------------------------------------------------------------- */

  const { data, error } = await client().emails.send(
    {
      from: sender,
      to: [recipient],
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      replyTo: replyTo || undefined,

      /**
       * Resend tags provide lightweight provider-side observability.
       */
      tags: [
        {
          name: "event",
          value: eventTag,
        },
      ],
    },
    {
      idempotencyKey,
    },
  );

  /* ----------------------------------------------------------------
     6. Handle provider rejection
     ---------------------------------------------------------------- */

  if (error || !data?.id) {
    /**
     * Log only provider-safe metadata.
     *
     * Do NOT log:
     * - API keys
     * - full rendered HTML
     * - password reset tokens
     * - invitation tokens
     */
    console.error("Transactional email provider rejected message.", {
      eventType: input.eventType,
      recipient,
      providerError: error?.message ?? "Missing provider message ID",
    });

    throw new Error(error?.message || "Resend did not return a message ID.");
  }

  /* ----------------------------------------------------------------
     7. Return provider acceptance information
     ---------------------------------------------------------------- */

  return {
    providerMessageId: data.id,
    recipient,
    eventType: input.eventType,
  };
}
