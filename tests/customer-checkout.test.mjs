import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
async function load(path, mocks = {}) {
  const code = ts.transpileModule(await readFile(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const testModule = { exports: {} };
  vm.runInNewContext(
    code,
    {
      module: testModule,
      exports: testModule.exports,
      require: (id) => (id === "server-only" ? {} : (mocks[id] ?? require(id))),
      Response,
      Request,
      URL,
      Date,
      TextEncoder,
      process,
      console: { error() {} },
    },
    { filename: path },
  );
  return testModule.exports;
}
const payments = await load("app/lib/business-payments.ts");
const checkout = await load("app/lib/customer-checkout.ts", {
  "./business-payments": payments,
});
const security = await load("app/lib/server/security.ts");
const promotions = await load("app/lib/promotions.ts");
const tenantId = "11111111-1111-4111-8111-111111111111";
const checkoutId = "22222222-2222-4222-8222-222222222222";
const productId = "33333333-3333-4333-8333-333333333333";

const configuration = {
  methods: [
    "bank_transfer",
    "cash_on_delivery",
    "payment_on_pickup",
    "payment_at_appointment",
  ].map((method) => ({
    method,
    enabled: true,
    modules: ["retail"],
    instructions: "Pay the business",
  })),
  fulfillment: {
    ...payments.DEFAULT_FULFILLMENT_CONFIGURATION,
    localDeliveryEnabled: true,
  },
  bankAccounts: [],
};

test("checkout offers only payment methods applicable to fulfillment", () => {
  assert.deepEqual(
    Array.from(
      checkout.checkoutPaymentOptions(configuration, "pickup"),
      (item) => item.method,
    ),
    ["bank_transfer", "payment_on_pickup"],
  );
  assert.deepEqual(
    Array.from(
      checkout.checkoutPaymentOptions(configuration, "delivery"),
      (item) => item.method,
    ),
    ["bank_transfer", "cash_on_delivery"],
  );
  assert.equal(
    checkout.checkoutPaymentOptions(
      { ...configuration, methods: [] },
      "pickup",
    )[0].method,
    "pay_later",
  );
});
test("retail excludes dine-in and respects business fulfillment switches", () => {
  assert.deepEqual(
    Array.from(
      checkout.checkoutOrderTypes(
        ["dine_in", "pickup", "delivery"],
        configuration,
        true,
      ),
    ),
    ["pickup", "delivery"],
  );
  const disabled = {
    ...configuration,
    fulfillment: {
      ...configuration.fulfillment,
      localDeliveryEnabled: false,
      pickupEnabled: false,
    },
  };
  assert.equal(
    checkout.checkoutOrderTypes(["pickup", "delivery"], disabled, true).length,
    0,
  );
});
test("currency rounding preserves two-decimal tax and discount amounts", () => {
  assert.equal(checkout.moneyRound(1.005), 1.01);
  assert.equal(checkout.moneyRound(19.99 * 0.1), 2);
});

async function apiHarness(error = null) {
  const calls = [];
  const client = {
    from() {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({
          data: { business_type: "retail", is_active: true, status: "ACTIVE" },
          error: null,
        }),
      };
      return query;
    },
    async rpc(name, args) {
      calls.push({ name, args });
      return {
        data: error
          ? null
          : [
              {
                order_id: "saved-order",
                order_number: "SHOP-ABC123",
                total: 27.5,
                payment_status: "AWAITING_PAYMENT",
                email_queued: true,
              },
            ],
        error,
      };
    },
  };
  const route = await load("app/api/public/orders/route.ts", {
    "@/app/lib/supabase/admin": { getSupabaseAdminClient: () => client },
    "@/app/lib/business-payments": payments,
    "@/app/lib/promotions": promotions,
    "@/app/lib/server/security": {
      ...security,
      enforcePublicRateLimit: async () => ({ allowed: true }),
    },
  });
  const input = {
    tenantId,
    idempotencyKey: checkoutId,
    customerName: "Test Customer",
    customerEmail: "customer@example.test",
    customerPhone: "5015550101",
    orderType: "delivery",
    deliveryAddress: "Sample Street",
    deliveryArea: "Test Area",
    paymentMethod: "bank_transfer",
    items: [{ productId, quantity: 2, addons: [] }],
  };
  return {
    calls,
    post: (overrides = {}, origin = "https://shop.test") =>
      route.POST(
        new Request("https://shop.test/api/public/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: origin },
          body: JSON.stringify({ ...input, ...overrides }),
        }),
      ),
  };
}
test("checkout preserves fulfillment and payment choice while ignoring client prices", async () => {
  const h = await apiHarness();
  const response = await h.post({
    total: 0,
    tax: 0,
    items: [{ productId, quantity: 2, price: 0.01, addons: [] }],
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.total, 27.5);
  assert.equal(result.emailQueued, true);
  assert.equal(result.paymentStatus, "AWAITING_PAYMENT");
  assert.equal(h.calls[0].name, "create_customer_business_order");
  assert.equal(h.calls[0].args.p_checkout_id, checkoutId);
  assert.equal(h.calls[0].args.p_checkout.p_payment_method, "bank_transfer");
  assert.equal(h.calls[0].args.p_checkout.p_delivery_address, "Sample Street");
  assert.equal("price" in h.calls[0].args.p_checkout.p_items[0], false);
  assert.equal("total" in h.calls[0].args.p_checkout, false);
});
test("mock cards and appointment-only payment methods cannot create storefront orders", async () => {
  const h = await apiHarness();
  for (const paymentMethod of [
    "mock_card",
    "card",
    "digiwallet",
    "payment_at_appointment",
  ])
    assert.equal((await h.post({ paymentMethod })).status, 400);
  assert.equal(h.calls.length, 0);
});
test("invalid retry keys, emails, and cross-origin requests never create orders", async () => {
  const h = await apiHarness();
  assert.equal((await h.post({ idempotencyKey: "not-a-uuid" })).status, 400);
  assert.equal((await h.post({ customerEmail: "invalid" })).status, 400);
  assert.equal((await h.post({}, "https://evil.test")).status, 403);
  assert.equal(h.calls.length, 0);
});
test("missing checkout migration fails without falling back to mock or incomplete orders", async () => {
  const h = await apiHarness({ code: "PGRST202", message: "missing function" });
  assert.equal((await h.post()).status, 503);
  assert.equal(h.calls.length, 1);
});
test("retries pass the same checkout identifier to the atomic order transaction", async () => {
  const h = await apiHarness();
  await h.post();
  await h.post();
  assert.equal(h.calls[0].args.p_checkout_id, h.calls[1].args.p_checkout_id);
});

const { CustomerPaymentCheckout } = await load(
  "app/components/CustomerPaymentCheckout.tsx",
  {
    "@/app/lib/utils": { formatCurrency: (value) => `$${value.toFixed(2)}` },
    "next/image": {
      __esModule: true,
      default: ({ src, alt }) => React.createElement("img", { src, alt }),
    },
    "next/link": {
      __esModule: true,
      default: ({ children, ...props }) =>
        React.createElement("a", props, children),
    },
  },
);
function renderCheckout(overrides = {}) {
  const noop = () => {};
  return renderToStaticMarkup(
    React.createElement(
      CustomerPaymentCheckout,
      {
        businessName: "Test Store",
        stage: "details",
        fulfillmentFields: React.createElement("input", {
          "aria-label": "Pickup time",
        }),
        availableOrderTypes: ["pickup", "delivery"],
        orderType: "pickup",
        onOrderTypeChange: noop,
        paymentOptions: checkout.checkoutPaymentOptions(
          configuration,
          "pickup",
        ),
        paymentMethod: "bank_transfer",
        onPaymentMethodChange: noop,
        configurationLoading: false,
        configurationError: "",
        onReloadConfiguration: noop,
        placingOrder: false,
        unavailable: false,
        confirmation: null,
        onPlaceOrder: noop,
        onTrackOrder: noop,
        items: [
          {
            id: "line",
            name: "Shoes",
            quantity: 2,
            lineTotal: 20,
            image: "/fallback-product.png",
          },
        ],
        subtotal: 20,
        tax: 2,
        deliveryFee: 0,
        discount: 0,
        promotionDiscount: 0,
        total: 22,
        promotionCode: "",
        promotionMaxLength: 32,
        applyingPromotion: false,
        onPromotionCodeChange: noop,
        onApplyPromotion: noop,
        onBack: noop,
        onClose: noop,
        ...overrides,
      },
      React.createElement("input", {
        type: "email",
        "aria-label": "Checkout email",
      }),
    ),
  );
}
test("checkout renders the business payment flow without raw card fields", () => {
  const html = renderCheckout();
  assert.match(html, /Place Order/);
  assert.match(html, /Customer Information/);
  assert.match(html, /Delivery Option/);
  assert.match(html, /Bank transfer/);
  assert.match(html, /Checkout email/);
  assert.doesNotMatch(html, /CVV|Card Number|DigiWallet|Save this card/);
});
test("checkout places the configured order directly from the new flow", () => {
  const html = renderCheckout();
  assert.match(html, /Shoes/);
  assert.match(html, /Place Order/);
  assert.match(html, /aria-current="step"/);
  assert.doesNotMatch(html, /Review Order/);
});
test("completion preserves the server total and reference after the cart is cleared", () => {
  const html = renderCheckout({
    stage: "complete",
    items: [],
    total: 0,
    confirmation: {
      orderNumber: "SHOP-ABC123",
      total: 27.5,
      customerEmail: "customer@example.test",
      emailQueued: true,
      createdAt: "2026-10-27T15:30:00.000Z",
    },
  });
  assert.match(html, /SHOP-ABC123/);
  assert.match(html, /Order Placed Successfully/);
  assert.match(html, /Go to Track Order/);
  assert.match(html, /What&#x27;s Next/);
  assert.doesNotMatch(html, /type="submit"/);
});
test("confirmation email links to tracking with its order reference", async () => {
  const { buildTransactionalEmail } = await load("app/lib/email/templates.ts");
  const result = buildTransactionalEmail({
    eventType: "ORDER_RECEIVED",
    payload: {
      app_url: "https://shop.test",
      storefront_slug: "test-store",
      order_number: "SHOP-ABC123",
      total: 27.5,
    },
  });
  assert.match(result.html, /tab=track-order&amp;order=SHOP-ABC123/);
  assert.match(result.text, /tab=track-order&order=SHOP-ABC123/);
  assert.match(result.text, /Order reference: SHOP-ABC123/);
});
test("payment-confirmed email links the verified customer back to tracking", async () => {
  const { buildTransactionalEmail } = await load("app/lib/email/templates.ts");
  const result = buildTransactionalEmail({
    eventType: "PAYMENT_CONFIRMED",
    recipientName: "John",
    payload: {
      app_url: "https://shop.test",
      storefront_slug: "test-store",
      order_number: "SHOP-ABC123",
      payment_status: "PAID",
      order_type: "delivery",
      delivery_address: "123 Belize Street",
    },
  });
  assert.match(result.html, /Payment confirmed/i);
  assert.match(result.html, /123 Belize Street/);
  assert.match(result.html, /tab=track-order&amp;order=SHOP-ABC123/);
  assert.match(result.text, /Payment status: Paid/);
});
test("checkout SQL keeps idempotency, payment choice, email queue, and inventory in one transaction", async () => {
  const sql = await readFile(
    "supabase/migrations/202610260001_customer_business_checkout.sql",
    "utf8",
  );
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(
    sql,
    /CREATE TABLE IF NOT EXISTS public\.customer_checkout_requests/,
  );
  assert.match(
    sql,
    /CREATE OR REPLACE FUNCTION public\.create_customer_business_order/,
  );
  assert.match(sql, /PRIMARY KEY \(tenant_id, checkout_id\)/);
  assert.match(sql, /payload_hash <> MD5\(p_checkout::TEXT\)/);
  assert.match(sql, /payment_method = v_method/);
  assert.match(sql, /order_email_deliveries/);
  assert.match(sql, /delivery_fee = v_fee/);
  assert.match(sql, /FROM PUBLIC, anon, authenticated/);
  assert.doesNotMatch(
    sql,
    /INSERT INTO public\.(?:payment_transactions|subscription_invoices)|payment_status = 'PAID'/i,
  );
});
test("paid orders queue exactly one Resend payment-confirmation event", async () => {
  const sql = await readFile(
    "supabase/migrations/202610270001_customer_checkout_notifications.sql",
    "utf8",
  );
  assert.match(sql, /'PAYMENT_CONFIRMED'/);
  assert.match(sql, /AFTER UPDATE OF payment_status ON public\.orders/);
  assert.match(sql, /UPPER\(COALESCE\(NEW\.payment_status, ''\)\) <> 'PAID'/);
  assert.match(sql, /ON CONFLICT \(order_id, event_type\) DO NOTHING/);
  assert.match(sql, /storefront_slug/);
});
