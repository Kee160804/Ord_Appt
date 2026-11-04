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
      TextDecoder,
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
  let emailProcessCalls = 0;
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
    "@/app/lib/email/process-best-effort": {
      processEmailQueueBestEffort: async () => {
        emailProcessCalls += 1;
      },
    },
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
    get emailProcessCalls() {
      return emailProcessCalls;
    },
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
  assert.equal(h.emailProcessCalls, 1);
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
test("missing ordering RPC returns an actionable migration error", async () => {
  const h = await apiHarness({
    code: "42883",
    message: "function public.create_public_order_v3(...) does not exist",
  });
  const response = await h.post();
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /latest database migration/i);
});
test("missing ordering columns return an actionable migration error", async () => {
  const h = await apiHarness({
    code: "42703",
    message: 'column "table_number" of relation "orders" does not exist',
  });
  const response = await h.post();
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /latest database migration/i);
});
test("retries pass the same checkout identifier to the atomic order transaction", async () => {
  const h = await apiHarness();
  await h.post();
  await h.post();
  assert.equal(h.calls[0].args.p_checkout_id, h.calls[1].args.p_checkout_id);
});

const { CustomerPaymentCheckout, buildOrderReferenceReceiptHtml } = await load(
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
test("checkout uses the compact storefront modal", async () => {
  const source = await readFile("app/components/OrderingMenu.tsx", "utf8");
  assert.match(source, /maxWidth="max-w-5xl"/);
  assert.doesNotMatch(source, /maxWidth="max-w-6xl"/);
});
test("completion preserves the server total and reference after the cart is cleared", () => {
  const html = renderCheckout({
    stage: "complete",
    items: [],
    total: 0,
    confirmation: {
      orderNumber: "SHOP-ABC123",
      total: 27.5,
      subtotal: 25,
      tax: 2.5,
      deliveryFee: 0,
      discount: 0,
      customerName: "Customer Name",
      customerEmail: "customer@example.test",
      fulfillmentMethod: "Pickup",
      paymentMethodLabel: "Bank transfer",
      paymentStatus: "AWAITING_PAYMENT",
      items: [
        {
          name: "Shoes",
          quantity: 1,
          lineTotal: 25,
          detail: "Size: 10",
        },
      ],
      emailQueued: true,
      createdAt: "2026-10-27T15:30:00.000Z",
    },
  });
  assert.match(html, /SHOP-ABC123/);
  assert.match(html, /Order Placed Successfully/);
  assert.match(html, /Go to Track Order/);
  assert.match(html, /Download Unofficial Order Record/);
  assert.match(html, /not an official receipt or proof of payment/i);
  assert.match(html, /What&#x27;s Next/);
  assert.doesNotMatch(html, /type="submit"/);
});
test("downloadable order record preserves tracking details and warns it is unofficial", () => {
  const html = buildOrderReferenceReceiptHtml("Test <Store>", {
    orderNumber: "SHOP-ABC123",
    total: 27.5,
    subtotal: 25,
    tax: 2.5,
    deliveryFee: 0,
    discount: 0,
    customerName: "Customer Name",
    customerEmail: "customer@example.test",
    fulfillmentMethod: "Pickup",
    paymentMethodLabel: "Bank transfer",
    paymentStatus: "AWAITING_PAYMENT",
    items: [{ name: "Shoes", quantity: 1, lineTotal: 25 }],
    emailQueued: true,
    createdAt: "2026-10-27T15:30:00.000Z",
  });
  assert.match(html, /SHOP-ABC123/);
  assert.match(html, /Customer Name/);
  assert.match(html, /Shoes/);
  assert.match(html, /Unofficial - not proof of payment/);
  assert.match(html, /not an official receipt/i);
  assert.match(html, /Test &lt;Store&gt;/);
  assert.doesNotMatch(html, /Test <Store>/);
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
test("checkout prerequisites are restored without legacy payment RPCs", async () => {
  const sql = await readFile(
    "supabase/migrations/202610290001_restore_checkout_prerequisites.sql",
    "utf8",
  );
  assert.match(sql, /ADD COLUMN IF NOT EXISTS ordering_paused/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS requested_time/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.public_request_limits/);
  assert.match(
    sql,
    /CREATE OR REPLACE FUNCTION public\.check_public_rate_limit/,
  );
  assert.doesNotMatch(sql, /create_public_order_v[23]/i);
  assert.doesNotMatch(sql, /complete_mock_subscription_checkout/i);
});
test("ordering checkout repairs the ambiguous order email conflict target", async () => {
  const sql = await readFile(
    "supabase/migrations/202611020001_ordering_checkout_and_appointment_payment_choice.sql",
    "utf8",
  );
  assert.match(sql, /create_customer_business_order\(uuid,uuid,jsonb\)/);
  assert.match(sql, /#variable_conflict use_column/);
  assert.match(sql, /REGEXP_REPLACE/);
});
test("ordering checkout restores every required order creation RPC", async () => {
  const sql = await readFile(
    "supabase/migrations/202611020002_restore_ordering_checkout_functions.sql",
    "utf8",
  );
  assert.match(
    sql,
    /CREATE OR REPLACE FUNCTION public\.create_public_order_v2/,
  );
  assert.match(
    sql,
    /CREATE OR REPLACE FUNCTION public\.create_public_order_v3/,
  );
  assert.match(sql, /LOWER\(business_type\) = 'ordering'/);
  assert.match(sql, /TO service_role/);
  assert.doesNotMatch(sql, /TO anon, authenticated/);
});
test("ordering checkout restores the complete order fulfillment schema", async () => {
  const sql = await readFile(
    "supabase/migrations/202611020003_restore_ordering_order_columns.sql",
    "utf8",
  );
  for (const column of [
    "order_type",
    "requested_time",
    "delivery_address",
    "delivery_area",
    "delivery_instructions",
    "table_number",
    "subtotal",
    "tax_amount",
    "discount_amount",
    "delivery_fee",
    "cancellation_reason",
    "cancelled_at",
  ]) {
    assert.match(sql, new RegExp(`ADD COLUMN IF NOT EXISTS ${column}`));
  }
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

test("ordering, retail, and appointment customer emails follow the three-message policy", async () => {
  const [policy, orderRoute, orderDashboard, paymentDashboard, worker] =
    await Promise.all([
      readFile(
        "supabase/migrations/202611030001_customer_email_policy.sql",
        "utf8",
      ),
      readFile("app/api/orders/status/route.ts", "utf8"),
      readFile("app/components/OrdersView.tsx", "utf8"),
      readFile("app/components/PaymentFulfillmentView.tsx", "utf8"),
      readFile("app/lib/email/worker.ts", "utf8"),
    ]);

  assert.match(policy, /WHEN 'READY' THEN 'ORDER_READY'/);
  assert.match(policy, /WHEN 'CANCELLED' THEN 'ORDER_CANCELLED'/);
  assert.match(policy, /business_type, ''\)\) <> 'ordering'/);
  assert.match(policy, /v_business_type, ''\)\) <> 'retail'/);
  assert.match(policy, /'ORDER_ACCEPTED'/);
  assert.match(policy, /'ORDER_PREPARING'/);
  assert.match(policy, /'ORDER_OUT_FOR_DELIVERY'/);
  assert.match(policy, /'APPOINTMENT_PAYMENT_CONFIRMED'/);
  assert.match(orderRoute, /requestHasAllowedOrigin/);
  assert.match(orderRoute, /requireTenantRole/);
  assert.match(orderRoute, /status === "READY" \|\| status === "CANCELLED"/);
  assert.match(orderDashboard, /Ready & notify customer/);
  assert.match(orderDashboard, /tracker only/);
  assert.match(paymentDashboard, /Confirm payment & email customer/);
  assert.match(paymentDashboard, /Accept receipt \(tracker only\)/);
  assert.match(worker, /new Set\(\["ORDER_RECEIVED", "PAYMENT_CONFIRMED"\]\)/);
  assert.match(
    worker,
    /new Set\(\["ORDER_RECEIVED", "ORDER_READY", "ORDER_CANCELLED"\]\)/,
  );
});
