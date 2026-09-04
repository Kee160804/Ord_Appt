import "server-only";

import { Resend } from "resend";
import {
  buildTransactionalEmail,
  type TransactionalEmailInput,
} from "./templates";

export interface SendTransactionalEmailInput extends TransactionalEmailInput {
  to: string;
  idempotencyKey: string;
  replyTo?: string | null;
}

let resendClient: Resend | null = null;

function requiredServerEnv(name: "RESEND_API_KEY" | "RESEND_FROM_EMAIL") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured on the server.`);
  return value;
}

export function isValidEmailAddress(value: string) {
  return (
    value.length <= 254 &&
    /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value)
  );
}

function client() {
  if (!resendClient)
    resendClient = new Resend(requiredServerEnv("RESEND_API_KEY"));
  return resendClient;
}

export async function sendTransactionalEmail(
  input: SendTransactionalEmailInput,
) {
  const recipient = input.to.trim().toLowerCase();
  if (!isValidEmailAddress(recipient))
    throw new Error("The recipient email address is invalid.");

  const replyTo = input.replyTo?.trim().toLowerCase();
  if (replyTo && !isValidEmailAddress(replyTo))
    throw new Error("The reply-to email address is invalid.");

  const rendered = buildTransactionalEmail(input);
  const { data, error } = await client().emails.send(
    {
      from: requiredServerEnv("RESEND_FROM_EMAIL"),
      to: [recipient],
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      replyTo: replyTo || undefined,
      tags: [
        {
          name: "event",
          value: input.eventType
            .toLowerCase()
            .replaceAll("_", "-")
            .slice(0, 256),
        },
      ],
    },
    { idempotencyKey: input.idempotencyKey.slice(0, 256) },
  );

  if (error || !data?.id) {
    throw new Error(error?.message || "Resend did not return a message ID.");
  }
  return { providerMessageId: data.id };
}
