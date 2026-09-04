export interface StorefrontContactInput {
  tenantId: string;
  name: string;
  email: string;
  subject?: string;
  message: string;
}

export async function submitStorefrontContactMessage(
  input: StorefrontContactInput,
) {
  const response = await fetch("/api/public/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const result = (await response.json()) as {
    messageId?: string;
    error?: string;
  };
  if (!response.ok || !result.messageId)
    throw new Error(result.error || "Unable to send your message.");
  return result.messageId;
}
