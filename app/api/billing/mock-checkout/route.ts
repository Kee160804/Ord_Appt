/**
 * Legacy endpoint retained so older clients fail safely instead of silently
 * activating an indefinite mock subscription. Use /api/billing/checkout,
 * whose provider abstraction blocks mock payments in production and records a
 * bounded billing period.
 */
export async function POST() {
  return Response.json(
    {
      error:
        "This checkout endpoint has been retired. Refresh the application and use subscription checkout.",
    },
    { status: 410 },
  );
}
