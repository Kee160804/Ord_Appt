import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
async function load(path, mocks = {}) {
  const source = await readFile(path, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const testModule = { exports: {} };
  vm.runInNewContext(
    compiled,
    {
      module: testModule,
      exports: testModule.exports,
      require: (id) => (id === "server-only" ? {} : (mocks[id] ?? require(id))),
      Response,
      Request,
      TextEncoder,
      URL,
      Date,
      FormData,
      File,
      crypto,
      process,
      console: { error() {} },
    },
    { filename: path },
  );
  return testModule.exports;
}
const tenantId = "11111111-1111-4111-8111-111111111111";
const orderId = "22222222-2222-4222-8222-222222222222";
const token = "a".repeat(43);
const guest = await load("app/lib/server/guest-access.ts");
const realSecurity = await load("app/lib/server/security.ts");

function fakeClient(rows, calls) {
  return {
    from(table) {
      const filters = [];
      const query = { table, filters };
      let single = false;
      const methods = {
        select(fields) {
          query.fields = fields;
          return methods;
        },
        eq(key, value) {
          filters.push(["eq", key, value]);
          return methods;
        },
        gt(key, value) {
          filters.push(["gt", key, value]);
          return methods;
        },
        not(key, op, value) {
          filters.push(["not", key, value]);
          return methods;
        },
        contains() {
          return methods;
        },
        in(key, values) {
          filters.push(["in", key, values]);
          return methods;
        },
        order() {
          return methods;
        },
        limit() {
          return methods;
        },
        update(values) {
          query.update = values;
          return methods;
        },
        maybeSingle() {
          single = true;
          return methods;
        },
        then(resolve) {
          calls.push(query);
          const matching = (rows[table] ?? []).filter((row) =>
            filters.every(([op, key, value]) =>
              op === "eq"
                ? row[key] === value
                : op === "in"
                  ? value.includes(row[key])
                  : op === "gt"
                    ? row[key] > value
                    : row[key] !== value,
            ),
          );
          return Promise.resolve({
            data: single ? (matching[0] ?? null) : matching,
            error: null,
          }).then(resolve);
        },
      };
      return methods;
    },
    storage: {
      from: () => ({
        upload: async (path) => {
          calls.push({ uploadedPath: path });
          return { error: null };
        },
        remove: async (paths) => {
          calls.push({ removedPaths: paths });
          return { error: null };
        },
        createSignedUrl: async (path) => {
          calls.push({ signedPath: path });
          return {
            data: { signedUrl: "https://example.test/private-receipt" },
            error: null,
          };
        },
      }),
    },
  };
}

async function harness({
  known = true,
  verified = false,
  codeAccepted = true,
  paid = false,
  limited = false,
} = {}) {
  const calls = [],
    sent = [],
    rpcCalls = [];
  const rows = {
    tenants: [
      {
        id: tenantId,
        is_active: true,
        status: "ACTIVE",
        business_type: "retail",
        business_name: "Test shop",
        phone: "555-1234",
      },
    ],
    orders: known
      ? [
          {
            id: orderId,
            tenant_id: tenantId,
            order_number: "TEST-123456",
            customer_email: "customer@example.test",
            customer_name: "Customer",
            status: "PREPARING",
            payment_status: paid ? "PAID" : "UNPAID",
            payment_method: "bank_transfer",
            order_type: "delivery",
            total: 22.6,
            subtotal: 19,
            delivery_fee: 3,
            tax_amount: 0.6,
            tracking_token_hash: "NEVER-RETURN",
            customer_verification_code_hash: "NEVER-RETURN",
            inventory_reservation_status: paid ? "PURCHASED" : "NONE",
            created_at: "2026-10-25T12:00:00Z",
          },
        ]
      : [],
    order_items: [
      {
        id: "item",
        tenant_id: tenantId,
        order_id: orderId,
        product_name: "Snack",
        quantity: 2,
        unit_price: 9.5,
        subtotal: 19,
        products: { image_url: "/fallback-product.png" },
        addons: [],
      },
    ],
    order_status_history: [
      {
        tenant_id: tenantId,
        order_id: orderId,
        new_status: "PREPARING",
        created_at: "2026-10-25T12:05:00Z",
      },
    ],
    customer_payment_submissions: paid
      ? [
          {
            id: "receipt",
            tenant_id: tenantId,
            order_id: orderId,
            status: "VERIFIED",
            submitted_amount: 22.6,
            receipt_path: `${tenantId}/order/${orderId}/receipt.pdf`,
            receipt_mime_type: "application/pdf",
          },
        ]
      : [],
    business_payment_methods: [
      { tenant_id: tenantId, method: "bank_transfer", enabled: true },
    ],
  };
  const client = fakeClient(rows, calls);
  client.rpc = async (name, args) => {
    rpcCalls.push({ name, args });
    return {
      data:
        name === "verify_order_tracking_code" ? codeAccepted : "challenge-id",
      error: null,
    };
  };
  const route = await load("app/api/public/order-tracking/route.ts", {
    "@/app/lib/supabase/admin": { getSupabaseAdminClient: () => client },
    "@/app/lib/server/guest-access": guest,
    "@/app/lib/server/order-tracking": {
      getVerifiedTrackingSession: async (tenant, accessToken) =>
        verified && tenant === tenantId && accessToken === token
          ? {
              order_id: orderId,
              customer_email: "customer@example.test",
              expires_at: "2099-01-01",
            }
          : null,
    },
    "@/app/lib/server/security": {
      ...realSecurity,
      enforcePublicRateLimit: async () => ({
        allowed: !limited,
        retryAfter: 60,
      }),
    },
    "@/app/lib/email/resend": {
      sendTransactionalEmail: async (email) => {
        sent.push(email);
      },
    },
  });
  return {
    client,
    rows,
    calls,
    sent,
    rpcCalls,
    post: (body, origin = "https://shop.test") =>
      route.POST(
        new Request("https://shop.test/api/public/order-tracking", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: origin },
          body: JSON.stringify({ tenantId, ...body }),
        }),
      ),
  };
}

test("lookup sends code only to the stored checkout email and exposes no order data", async () => {
  const h = await harness();
  const response = await h.post({
    action: "request",
    orderNumber: "test-123456",
    customerEmail: "attacker@example.test",
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(Object.keys(body).sort(), [
    "accessToken",
    "expiresAt",
    "resendAfter",
  ]);
  assert.equal(h.sent[0].to, "customer@example.test");
  assert.match(h.sent[0].payload.verification_code, /^\d{6}$/);
  assert.notEqual(
    h.rpcCalls[0].args.p_code_hash,
    h.sent[0].payload.verification_code,
  );
  assert.equal(
    h.calls.some((call) => call.table === "order_items"),
    false,
  );
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("unknown references return the same response shape without email or order disclosure", async () => {
  const h = await harness({ known: false });
  const result = await h.post({
    action: "request",
    orderNumber: "UNKNOWN-1234",
  });
  assert.equal(result.status, 200);
  assert.deepEqual(Object.keys(await result.json()).sort(), [
    "accessToken",
    "expiresAt",
    "resendAfter",
  ]);
  assert.equal(h.sent.length, 0);
});

test("wrong codes and unverified tokens cannot load order items", async () => {
  const h = await harness({ codeAccepted: false });
  assert.equal(
    (await h.post({ action: "verify", accessToken: token, code: "000000" }))
      .status,
    403,
  );
  assert.equal(
    (await h.post({ action: "details", accessToken: token })).status,
    401,
  );
  assert.equal(
    h.calls.some((call) => call.table === "order_items"),
    false,
  );
});

test("verified customers see all line items and totals without private hashes", async () => {
  const h = await harness({ verified: true });
  const response = await h.post({
    action: "verify",
    accessToken: token,
    code: "123456",
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.order.items[0].quantity, 2);
  assert.equal(payload.order.total, 22.6);
  assert.equal(payload.order.canUploadReceipt, true);
  assert.doesNotMatch(
    JSON.stringify(payload),
    /NEVER-RETURN|code_hash|token_hash/,
  );
});

test("paid orders remain trackable and receipts are signed only after verification", async () => {
  const h = await harness({ verified: true, paid: true });
  const response = await h.post({ action: "details", accessToken: token });
  const payload = await response.json();
  assert.equal(payload.order.paymentStatus, "PAID");
  assert.equal(payload.order.canUploadReceipt, false);
  assert.equal(
    payload.order.receipt.url,
    "https://example.test/private-receipt",
  );
  assert.ok(h.calls.some((call) => call.signedPath));
  assert.equal(
    h.calls.some((call) => call.update),
    false,
  );
});

test("cross-order receipt paths are never signed", async () => {
  const h = await harness({ verified: true, paid: true });
  h.rows.customer_payment_submissions[0].receipt_path =
    "another-tenant/order/private.pdf";
  const result = await (
    await h.post({ action: "details", accessToken: token })
  ).json();
  assert.equal(result.order.receipt.url, null);
  assert.equal(
    h.calls.some((call) => call.signedPath),
    false,
  );
});

test("cross-origin and rate-limited attempts do not send codes", async () => {
  const h = await harness({ limited: true });
  assert.equal(
    (
      await h.post(
        { action: "request", orderNumber: "TEST-123456" },
        "https://evil.test",
      )
    ).status,
    403,
  );
  assert.equal(
    (await h.post({ action: "request", orderNumber: "TEST-123456" })).status,
    429,
  );
  assert.equal(h.sent.length, 0);
});

test("session authorization rejects pending, expired, and cross-tenant tokens", async () => {
  const rows = {
    order_tracking_sessions: [
      {
        tenant_id: tenantId,
        token_hash: guest.hashGuestAccessToken(token),
        verified_at: null,
        expires_at: "2099-01-01",
        order_id: orderId,
        customer_email: "customer@example.test",
      },
    ],
  };
  const helper = await load("app/lib/server/order-tracking.ts", {
    "@/app/lib/supabase/admin": {
      getSupabaseAdminClient: () => fakeClient(rows, []),
    },
    "@/app/lib/server/guest-access": guest,
  });
  assert.equal(await helper.getVerifiedTrackingSession(tenantId, token), null);
  rows.order_tracking_sessions[0].verified_at = "2026-10-25";
  assert.ok(await helper.getVerifiedTrackingSession(tenantId, token));
  assert.equal(await helper.getVerifiedTrackingSession(orderId, token), null);
  rows.order_tracking_sessions[0].expires_at = "2000-01-01";
  assert.equal(await helper.getVerifiedTrackingSession(tenantId, token), null);
});

test("tracking email includes the OTP in both HTML and plain text and escapes content", async () => {
  const { buildTransactionalEmail } = await load("app/lib/email/templates.ts");
  const email = buildTransactionalEmail({
    eventType: "ORDER_TRACKING_CODE",
    payload: {
      business_name: "<script>bad</script>",
      order_number: "TEST-123",
      verification_code: "012345",
    },
  });
  assert.match(email.html, /012345/);
  assert.match(email.text, /012345/);
  assert.match(email.text, /10 minutes/);
  assert.doesNotMatch(email.html, /<script>/);
});

async function submitReceipt({
  verified = false,
  paid = false,
  email = "customer@example.test",
} = {}) {
  const h = await harness({ verified, paid });
  const route = await load("app/api/public/payment-receipts/route.ts", {
    "@/app/lib/supabase/admin": { getSupabaseAdminClient: () => h.client },
    "@/app/lib/server/guest-access": guest,
    "@/app/lib/server/order-tracking": {
      getVerifiedTrackingSession: async () =>
        verified
          ? { order_id: orderId, customer_email: "customer@example.test" }
          : null,
    },
    "@/app/lib/server/security": {
      ...realSecurity,
      enforcePublicRateLimit: async () => ({ allowed: true }),
    },
  });
  const form = new FormData();
  for (const [key, value] of Object.entries({
    tenantId,
    targetType: "order",
    targetId: orderId,
    accessToken: token,
    customerEmail: email,
    amount: "22.60",
    paymentDate: "2026-10-25",
  }))
    form.set(key, value);
  form.set(
    "receipt",
    new File(["%PDF-1.4 test fixture"], "receipt.pdf", {
      type: "application/pdf",
    }),
  );
  const response = await route.POST(
    new Request("https://shop.test/api/public/payment-receipts", {
      method: "POST",
      headers: { Origin: "https://shop.test" },
      body: form,
    }),
  );
  return { ...h, response };
}

test("receipt upload rejects unverified sessions and mismatched email before storage writes", async () => {
  for (const options of [
    {},
    { verified: true, email: "attacker@example.test" },
  ]) {
    const h = await submitReceipt(options);
    assert.equal(h.response.status, 403);
    assert.equal(
      h.calls.some((call) => call.uploadedPath),
      false,
    );
  }
});

test("verified receipt upload uses the atomic transaction and returns awaiting verification", async () => {
  const h = await submitReceipt({ verified: true });
  assert.equal(h.response.status, 201);
  assert.equal((await h.response.json()).status, "AWAITING_VERIFICATION");
  assert.ok(
    h.rpcCalls.some((call) => call.name === "submit_tracked_order_receipt"),
  );
  assert.ok(h.calls.some((call) => call.uploadedPath));
});

test("paid orders reject further receipts before storage writes", async () => {
  const h = await submitReceipt({ verified: true, paid: true });
  assert.equal(h.response.status, 409);
  assert.equal(
    h.calls.some((call) => call.uploadedPath),
    false,
  );
});

test("database codes expire, attempts are atomic, and tracking cannot reopen an expired reservation", async () => {
  const sql = await readFile(
    "supabase/migrations/202610250001_customer_order_tracking.sql",
    "utf8",
  );
  assert.match(
    sql,
    /CREATE TABLE IF NOT EXISTS public\.order_tracking_sessions/,
  );
  assert.match(
    sql,
    /CREATE OR REPLACE FUNCTION public\.request_order_tracking_code/,
  );
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /FOR UPDATE/);
  assert.match(sql, /attempts >= 5/);
  assert.match(sql, /code_expires_at <= NOW\(\)/);
  assert.match(sql, /inventory_reservation_expires_at > NOW\(\)/);
  assert.match(sql, /verified_at = NOW\(\), code_hash = NULL/);
  assert.doesNotMatch(
    sql.split(
      "CREATE OR REPLACE FUNCTION public.submit_tracked_order_receipt",
    )[0],
    /payment_status\s*=/i,
  );
  assert.match(sql, /payment_status = 'AWAITING_VERIFICATION'/);
  assert.doesNotMatch(sql, /payment_status = 'PAID'/);
});
