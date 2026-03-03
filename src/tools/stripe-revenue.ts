import { Type } from "@sinclair/typebox";
import type { CEOClawState } from "../state/business-state.js";

// Stripe API helper — direct fetch, no SDK dependency
async function stripeRequest(
  secretKey: string,
  method: string,
  endpoint: string,
  body?: Record<string, string>,
): Promise<unknown> {
  const url = `https://api.stripe.com/v1${endpoint}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
  };
  const init: RequestInit = { method, headers };
  if (body && (method === "POST" || method === "PUT")) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    init.body = new URLSearchParams(body).toString();
  }
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stripe API ${method} ${endpoint} failed (${res.status}): ${text}`);
  }
  return res.json();
}

type StripeBalance = {
  available: Array<{ amount: number; currency: string }>;
  pending: Array<{ amount: number; currency: string }>;
};

type StripeCharge = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: number;
  receipt_email?: string;
  description?: string;
};

type StripeProduct = { id: string; name: string };
type StripePrice = { id: string; unit_amount: number; currency: string };
type StripePaymentLink = { id: string; url: string };

export const StripeRevenueSchema = Type.Object({
  action: Type.String({
    description:
      'One of: "balance", "charges", "create_product", "create_payment_link", "summary"',
  }),
  productName: Type.Optional(
    Type.String({ description: "Product name (for create_product)" }),
  ),
  productDescription: Type.Optional(
    Type.String({ description: "Product description (for create_product)" }),
  ),
  priceAmountCents: Type.Optional(
    Type.Number({ description: "Price in cents, e.g. 499 = $4.99 (for create_product)" }),
  ),
  currency: Type.Optional(
    Type.String({ description: 'Currency code, default "usd"' }),
  ),
  priceId: Type.Optional(
    Type.String({ description: "Stripe Price ID (for create_payment_link)" }),
  ),
  limit: Type.Optional(
    Type.Number({ description: "Max results for charges (default 10)" }),
  ),
});

function formatCents(amount: number, currency: string): string {
  return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

export function createStripeRevenueTool(params: {
  secretKey: string;
  stateDir: string;
  readState: () => CEOClawState;
  writeState: (s: CEOClawState) => void;
}) {
  const { secretKey } = params;
  return {
    name: "stripe_revenue",
    label: "Stripe Revenue",
    description: [
      "Manage Stripe payments and revenue.",
      'Actions: "balance" (check available/pending funds),',
      '"charges" (list recent payments),',
      '"create_product" (create product + price),',
      '"create_payment_link" (create hosted checkout link from a priceId),',
      '"summary" (full revenue report).',
    ].join(" "),
    parameters: StripeRevenueSchema,
    execute: async (_toolCallId: string, p: Record<string, unknown>) => {
      const action = String(p.action ?? "summary");

      if (action === "balance") {
        const bal = (await stripeRequest(secretKey, "GET", "/balance")) as StripeBalance;
        const available = bal.available.map((b) => formatCents(b.amount, b.currency)).join(", ");
        const pending = bal.pending.map((b) => formatCents(b.amount, b.currency)).join(", ");
        return jsonResult({ available, pending, raw: bal });
      }

      if (action === "charges") {
        const limit = Number(p.limit ?? 10);
        const data = (await stripeRequest(
          secretKey,
          "GET",
          `/charges?limit=${limit}`,
        )) as { data: StripeCharge[] };
        const charges = data.data.map((c) => ({
          id: c.id,
          amount: formatCents(c.amount, c.currency),
          status: c.status,
          email: c.receipt_email ?? "unknown",
          date: new Date(c.created * 1000).toISOString(),
          description: c.description,
        }));
        return jsonResult({ count: charges.length, charges });
      }

      if (action === "create_product") {
        const name = String(p.productName ?? "CEOClaw Product");
        const desc = String(p.productDescription ?? "");
        const amountCents = Number(p.priceAmountCents ?? 499);
        const currency = String(p.currency ?? "usd");

        const product = (await stripeRequest(secretKey, "POST", "/products", {
          name,
          description: desc,
        })) as StripeProduct;

        const price = (await stripeRequest(secretKey, "POST", "/prices", {
          product: product.id,
          unit_amount: String(amountCents),
          currency,
        })) as StripePrice;

        // Persist to state
        const state = params.readState();
        if (state.product) {
          state.product.stripeProductId = product.id;
          state.product.stripePriceId = price.id;
          params.writeState(state);
        }

        return jsonResult({
          productId: product.id,
          priceId: price.id,
          amount: formatCents(amountCents, currency),
          message: `Created product "${name}" with price ${formatCents(amountCents, currency)}. Use priceId "${price.id}" to create a payment link.`,
        });
      }

      if (action === "create_payment_link") {
        const priceId = String(p.priceId ?? "");
        if (!priceId) {
          return jsonResult({ error: "priceId is required for create_payment_link" });
        }
        const link = (await stripeRequest(secretKey, "POST", "/payment_links", {
          "line_items[0][price]": priceId,
          "line_items[0][quantity]": "1",
        })) as StripePaymentLink;

        const state = params.readState();
        if (state.product) {
          state.product.stripePaymentLink = link.url;
          params.writeState(state);
        }

        return jsonResult({
          paymentLinkId: link.id,
          url: link.url,
          message: `Payment link created: ${link.url}`,
        });
      }

      // summary
      const bal = (await stripeRequest(secretKey, "GET", "/balance")) as StripeBalance;
      const charges = (await stripeRequest(
        secretKey,
        "GET",
        "/charges?limit=100",
      )) as { data: StripeCharge[] };

      const succeeded = charges.data.filter((c) => c.status === "succeeded");
      const totalCents = succeeded.reduce((sum, c) => sum + c.amount, 0);
      const primaryCurrency = succeeded[0]?.currency ?? "usd";

      // Update state metrics
      const state = params.readState();
      state.metrics.totalRevenue = totalCents / 100;
      state.metrics.totalCharges = succeeded.length;
      state.metrics.mrr = totalCents / 100; // Simplified: total as MRR proxy
      state.metrics.lastUpdated = new Date().toISOString();
      params.writeState(state);

      return jsonResult({
        totalRevenue: formatCents(totalCents, primaryCurrency),
        totalCharges: succeeded.length,
        availableBalance: bal.available.map((b) => formatCents(b.amount, b.currency)).join(", "),
        pendingBalance: bal.pending.map((b) => formatCents(b.amount, b.currency)).join(", "),
        recentCharges: succeeded.slice(0, 5).map((c) => ({
          amount: formatCents(c.amount, c.currency),
          date: new Date(c.created * 1000).toISOString(),
          email: c.receipt_email,
        })),
      });
    },
  };
}

function jsonResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}
