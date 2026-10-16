import "server-only";

import { publicAppOrigin } from "@/app/lib/platform";

const SANDBOX_PAYMENT_URL = "https://sandbox.belizebank.com/payment/rest";
const PRODUCTION_PAYMENT_URL = "https://gateway.belizebank.com/payment/rest";
const REQUEST_TIMEOUT_MS = 20_000;

type GatewayJson = Record<string, unknown>;

export class BelizeBankConfigurationError extends Error {}
export class BelizeBankGatewayError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

export interface BelizeBankRegistration {
  orderId: string;
  formUrl: string;
}

export interface BelizeBankOrderStatus {
  orderId: string;
  orderStatus: number;
  amountMinor?: number;
  bindingId?: string;
  maskedPan?: string;
  approvalCode?: string;
  authorizedAt?: string;
  raw: GatewayJson;
}

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new BelizeBankConfigurationError(
      `${name} is required for Belize Bank subscription payments.`,
    );
  }
  return value;
}

function paymentUrl() {
  const configured = process.env.BELIZE_BANK_PAYMENT_URL?.trim();
  const value =
    configured ||
    (process.env.NODE_ENV === "production"
      ? PRODUCTION_PAYMENT_URL
      : SANDBOX_PAYMENT_URL);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new BelizeBankConfigurationError(
      "BELIZE_BANK_PAYMENT_URL must be a valid HTTPS URL.",
    );
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new BelizeBankConfigurationError(
      "BELIZE_BANK_PAYMENT_URL must be a credential-free HTTPS URL.",
    );
  }
  return url.toString().replace(/\/+$/, "");
}

function callbackOrigin() {
  const origin = publicAppOrigin();
  if (!origin) {
    throw new BelizeBankConfigurationError(
      "NEXT_PUBLIC_APP_URL is required for Belize Bank return and callback URLs.",
    );
  }
  if (process.env.NODE_ENV === "production" && !origin.startsWith("https://")) {
    throw new BelizeBankConfigurationError(
      "NEXT_PUBLIC_APP_URL must use HTTPS in production.",
    );
  }
  return origin;
}

function credentials() {
  return {
    userName: requiredEnvironment("BELIZE_BANK_USERNAME"),
    password: requiredEnvironment("BELIZE_BANK_PASSWORD"),
  };
}

function minorAmount(amount: number) {
  const value = Math.round(amount * 100);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new BelizeBankGatewayError("The subscription amount is invalid.");
  }
  return value;
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numericValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

async function postGateway(path: string, values: URLSearchParams) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${paymentUrl()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: values.toString(),
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new BelizeBankGatewayError(
        `Belize Bank returned HTTP ${response.status}.`,
      );
    }
    const value = (await response.json()) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new BelizeBankGatewayError(
        "Belize Bank returned an invalid response.",
      );
    }
    return value as GatewayJson;
  } catch (error) {
    if (error instanceof BelizeBankGatewayError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new BelizeBankGatewayError("Belize Bank did not respond in time.");
    }
    throw new BelizeBankGatewayError(
      "Unable to connect to Belize Bank. Please try again.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

function gatewayError(value: GatewayJson) {
  const code = textValue(value.errorCode) || String(value.errorCode ?? "");
  const message = textValue(value.errorMessage) || textValue(value.error);
  if (code && code !== "0") {
    throw new BelizeBankGatewayError(
      message || "Belize Bank rejected the payment request.",
      code,
    );
  }
}

function safeHostedUrl(value: unknown) {
  const raw = textValue(value);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BelizeBankGatewayError(
      "Belize Bank did not return a valid hosted payment URL.",
    );
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new BelizeBankGatewayError(
      "Belize Bank returned an unsafe hosted payment URL.",
    );
  }
  return url.toString();
}

export async function registerBelizeBankSubscription(input: {
  tenantId: string;
  requestId: string;
  ownerEmail: string;
  businessName: string;
  planName: string;
  amount: number;
}): Promise<BelizeBankRegistration> {
  const auth = credentials();
  const origin = callbackOrigin();
  const returnUrl = new URL("/dashboard/settings", origin);
  returnUrl.searchParams.set("tab", "payments");
  returnUrl.searchParams.set("billingRequest", input.requestId);
  returnUrl.searchParams.set("tenant", input.tenantId);
  const callbackUrl = new URL("/api/billing/belize-bank/callback", origin);
  const values = new URLSearchParams({
    userName: auth.userName,
    password: auth.password,
    amount: String(minorAmount(input.amount)),
    description:
      `YuhBusiness ${input.planName} monthly subscription - ${input.businessName}`.slice(
        0,
        240,
      ),
    returnURL: returnUrl.toString(),
    orderNumber: input.requestId,
    dynamicCallbackUrl: callbackUrl.toString(),
  });
  if (input.ownerEmail.trim()) values.set("email", input.ownerEmail.trim());

  const response = await postGateway("/register.do", values);
  gatewayError(response);
  const orderId = textValue(response.orderId) || textValue(response.orderID);
  if (!orderId || orderId.length > 200) {
    throw new BelizeBankGatewayError(
      "Belize Bank did not return a valid order reference.",
    );
  }
  return { orderId, formUrl: safeHostedUrl(response.formURL) };
}

export async function getBelizeBankOrderStatus(
  orderId: string,
): Promise<BelizeBankOrderStatus> {
  const auth = credentials();
  const response = await postGateway(
    "/getOrderStatusExtended.do",
    new URLSearchParams({
      userName: auth.userName,
      password: auth.password,
      orderId,
    }),
  );
  gatewayError(response);
  const orderStatus = numericValue(response.orderStatus);
  if (orderStatus === undefined || !Number.isInteger(orderStatus)) {
    throw new BelizeBankGatewayError(
      "Belize Bank returned an invalid payment status.",
    );
  }
  const cardAuthInfo =
    response.cardAuthInfo &&
    typeof response.cardAuthInfo === "object" &&
    !Array.isArray(response.cardAuthInfo)
      ? (response.cardAuthInfo as GatewayJson)
      : {};
  return {
    orderId,
    orderStatus,
    amountMinor: numericValue(response.amount),
    bindingId:
      textValue(response.bindingId) ||
      textValue(response.bindingID) ||
      undefined,
    maskedPan: textValue(cardAuthInfo.maskedPan) || undefined,
    approvalCode: textValue(cardAuthInfo.approvalCode) || undefined,
    authorizedAt: textValue(response.authDateTime) || undefined,
    raw: response,
  };
}

export function expectedBelizeBankAmountMinor(amount: number) {
  return minorAmount(amount);
}
