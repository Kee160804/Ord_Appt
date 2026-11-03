import "server-only";

import { processTransactionalEmailQueue } from "./worker";

/**
 * Attempts to deliver newly queued transactional email without making the
 * business action depend on Resend being available. The database queue remains
 * the source of truth, so a failed attempt can still be retried later.
 */
export async function processEmailQueueBestEffort(context: string) {
  try {
    return await processTransactionalEmailQueue(10);
  } catch (error) {
    console.error(`[email] Queue processing failed after ${context}.`, error);
    return null;
  }
}
