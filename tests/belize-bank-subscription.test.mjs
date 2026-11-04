import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = (path) => readFile(path, "utf8");
const require = createRequire(import.meta.url);

async function loadGateway(fetchImpl) {
  const source = await read("app/lib/billing/belize-bank.ts");
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const testModule = { exports: {} };
  vm.runInNewContext(
    code,
    {
      module: testModule,
      exports: testModule.exports,
      require: (id) => {
        if (id === "server-only") return {};
        if (id === "@/app/lib/platform") {
          return { publicAppOrigin: () => "https://app.example" };
        }
        return require(id);
      },
      fetch: fetchImpl,
      AbortController,
      URL,
      URLSearchParams,
      Response,
      setTimeout,
      clearTimeout,
      process,
    },
    { filename: "app/lib/billing/belize-bank.ts" },
  );
  return testModule.exports;
}

test("Belize Bank subscription checkout uses the hosted form protocol", async () => {
  const gateway = await read("app/lib/billing/belize-bank.ts");
  assert.match(gateway, /application\/x-www-form-urlencoded/);
  assert.match(gateway, /\/register\.do/);
  assert.match(gateway, /\/getOrderStatusExtended\.do/);
  assert.match(gateway, /dynamicCallbackUrl/);
  assert.match(gateway, /returnUrl/);
  assert.match(gateway, /amount: String\(minorAmount\(input\.amount\)\)/);
  assert.match(gateway, /DEFAULT_HOSTED_PAYMENT_DOMAINS/);
  assert.match(gateway, /radarpayment\.online/);
  assert.doesNotMatch(gateway, /cardNumber|\bcvv\b|\bcvc\b/i);
});

test("only verified exact-amount authorizations activate subscriptions", async () => {
  const reconciliation = await read("app/lib/billing/belize-bank-checkout.ts");
  assert.match(reconciliation, /gateway\.orderStatus === 2/);
  assert.match(reconciliation, /gateway\.amountMinor !== expectedMinor/);
  assert.match(reconciliation, /complete_subscription_checkout_v2/);
  assert.match(reconciliation, /p_provider: "BELIZE_BANK"/);
  assert.match(reconciliation, /idempotencyKey/);
});

test("callbacks are notifications and re-query Belize Bank before writes", async () => {
  const callback = await read("app/api/billing/belize-bank/callback/route.ts");
  const reconciliation = await read("app/lib/billing/belize-bank-checkout.ts");
  assert.match(callback, /URLSearchParams/);
  assert.match(callback, /CALLBACK_OPERATIONS/);
  assert.match(callback, /\["0", "1"\]\.includes\(callbackStatus\)/);
  assert.match(callback, /enforcePublicRateLimit/);
  assert.match(callback, /reconcileBelizeBankSubscriptionCheckout/);
  assert.match(reconciliation, /getBelizeBankOrderStatus/);
});

test("Belize Bank is limited to platform subscription billing", async () => {
  const [provider, checkout, orderRoute, bookingRoute] = await Promise.all([
    read("app/lib/billing/provider.ts"),
    read("app/api/billing/checkout/route.ts"),
    read("app/api/public/orders/route.ts"),
    read("app/api/public/bookings/route.ts"),
  ]);
  assert.match(provider, /id: "BELIZE_BANK"/);
  assert.match(checkout, /provider\.id === "BELIZE_BANK"/);
  assert.doesNotMatch(orderRoute, /BELIZE_BANK/);
  assert.doesNotMatch(bookingRoute, /BELIZE_BANK/);
});

test("checkout sessions remain pending until verified completion", async () => {
  const migration = await read(
    "supabase/migrations/202610150003_belize_bank_subscription_checkout.sql",
  );
  assert.match(migration, /subscription_checkout_sessions/);
  assert.match(migration, /'REGISTERING', 'PENDING', 'SUCCEEDED'/);
  assert.match(migration, /REVOKE ALL[\s\S]+authenticated/);
  assert.doesNotMatch(migration, /subscription_status\s*=\s*'active'/);
});

test("registration sends only server-calculated hosted-checkout fields", async () => {
  const calls = [];
  const oldValues = {
    url: process.env.BELIZE_BANK_PAYMENT_URL,
    username: process.env.BELIZE_BANK_USERNAME,
    password: process.env.BELIZE_BANK_PASSWORD,
  };
  process.env.BELIZE_BANK_PAYMENT_URL =
    "https://sandbox.belizebank.com/payment/rest";
  process.env.BELIZE_BANK_USERNAME = "server-user";
  process.env.BELIZE_BANK_PASSWORD = "server-password";

  try {
    const gateway = await loadGateway(async (url, init) => {
      calls.push({ url, init });
      return Response.json({
        orderId: "bank-order-123",
        formUrl: "https://sandbox.belizebank.com/payment/hosted/123",
      });
    });
    const result = await gateway.registerBelizeBankSubscription({
      tenantId: "11111111-1111-4111-8111-111111111111",
      requestId: "22222222-2222-4222-8222-222222222222",
      ownerEmail: "owner@example.com",
      businessName: "Test Business",
      planName: "Pro",
      amount: 29.9,
    });

    assert.equal(result.orderId, "bank-order-123");
    assert.equal(calls.length, 1);
    assert.equal(
      calls[0].url,
      "https://sandbox.belizebank.com/payment/rest/register.do",
    );
    assert.equal(
      calls[0].init.headers["Content-Type"],
      "application/x-www-form-urlencoded",
    );
    const body = new URLSearchParams(calls[0].init.body);
    assert.equal(body.get("amount"), "2990");
    assert.equal(
      body.get("orderNumber"),
      "22222222-2222-4222-8222-222222222222",
    );
    assert.equal(
      body.get("dynamicCallbackUrl"),
      "https://app.example/api/billing/belize-bank/callback",
    );
    assert.equal(
      body.get("returnUrl"),
      "https://app.example/dashboard/settings?tab=payments&billingRequest=22222222-2222-4222-8222-222222222222&tenant=11111111-1111-4111-8111-111111111111",
    );
    assert.equal(body.has("returnURL"), false);
    assert.equal(body.has("cardNumber"), false);
    assert.equal(body.has("cvv"), false);
  } finally {
    for (const [key, value] of Object.entries({
      BELIZE_BANK_PAYMENT_URL: oldValues.url,
      BELIZE_BANK_USERNAME: oldValues.username,
      BELIZE_BANK_PASSWORD: oldValues.password,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("registration rejects an unrecognized hosted payment domain", async () => {
  const oldValues = {
    url: process.env.BELIZE_BANK_PAYMENT_URL,
    username: process.env.BELIZE_BANK_USERNAME,
    password: process.env.BELIZE_BANK_PASSWORD,
  };
  process.env.BELIZE_BANK_PAYMENT_URL =
    "https://sandbox.belizebank.com/payment/rest";
  process.env.BELIZE_BANK_USERNAME = "server-user";
  process.env.BELIZE_BANK_PASSWORD = "server-password";

  try {
    const gateway = await loadGateway(async () =>
      Response.json({
        orderId: "bank-order-123",
        formURL: "https://payments.example.invalid/collect-card",
      }),
    );
    await assert.rejects(
      gateway.registerBelizeBankSubscription({
        tenantId: "11111111-1111-4111-8111-111111111111",
        requestId: "22222222-2222-4222-8222-222222222222",
        ownerEmail: "owner@example.com",
        businessName: "Test Business",
        planName: "Pro",
        amount: 29.9,
      }),
      /unrecognized hosted payment domain/,
    );
  } finally {
    for (const [key, value] of Object.entries({
      BELIZE_BANK_PAYMENT_URL: oldValues.url,
      BELIZE_BANK_USERNAME: oldValues.username,
      BELIZE_BANK_PASSWORD: oldValues.password,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
