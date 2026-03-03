import { Type } from "@sinclair/typebox";
import type { CEOClawState } from "../state/business-state.js";

export const BusinessMetricsSchema = Type.Object({
  action: Type.Optional(
    Type.String({
      description:
        '"snapshot" (default) — pull all metrics and update state. ' +
        '"history" — return recent metric snapshots from the action log. ' +
        '"set_idea" — record the chosen product idea in persistent state (requires productName + productDescription). ' +
        '"set_stage" — advance the business stage (requires stage: "ideation"|"build"|"launch"|"growth").',
    }),
  ),
  productName: Type.Optional(Type.String({ description: "Product name (for set_idea)" })),
  productDescription: Type.Optional(Type.String({ description: "One-line product description (for set_idea)" })),
  stage: Type.Optional(Type.String({ description: 'Target stage for set_stage: "ideation", "build", "launch", "growth"' })),
});

export function createBusinessMetricsTool(params: {
  stripeSecretKey?: string;
  vercelToken?: string;
  stateDir: string;
  readState: () => CEOClawState;
  writeState: (s: CEOClawState) => void;
}) {
  return {
    name: "business_metrics",
    label: "Business Metrics",
    description: [
      "Aggregate business KPIs: Stripe revenue, site uptime, deployment status, and action history.",
      "Use this before making decisions in the OODA loop.",
      "Returns a structured summary of traffic, revenue, and recent actions.",
    ].join(" "),
    parameters: BusinessMetricsSchema,
    execute: async (_toolCallId: string, p: Record<string, unknown>) => {
      const action = String(p.action ?? "snapshot");
      const state = params.readState();

      if (action === "history") {
        const metricActions = state.actionLog
          .filter((a) => a.action.startsWith("metrics:"))
          .slice(-20);
        return jsonResult({ history: metricActions });
      }

      if (action === "set_idea") {
        const name = String(p.productName ?? "");
        const description = String(p.productDescription ?? "");
        if (!name || !description) {
          return jsonResult({ error: "productName and productDescription are required for set_idea" });
        }
        state.product = {
          ...state.product,
          name,
          description,
        };
        if (state.stage === "ideation") {
          state.stage = "build";
        }
        params.writeState(state);
        return jsonResult({
          action: "set_idea",
          product: state.product,
          stage: state.stage,
          message: `Product idea "${name}" recorded. Stage advanced to ${state.stage.toUpperCase()}. Now scaffold and build it.`,
        });
      }

      if (action === "set_stage") {
        const target = String(p.stage ?? "");
        const validStages = ["ideation", "build", "launch", "growth"];
        if (!validStages.includes(target)) {
          return jsonResult({ error: `stage must be one of: ${validStages.join(", ")}` });
        }
        state.stage = target as typeof state.stage;
        params.writeState(state);
        return jsonResult({
          action: "set_stage",
          stage: state.stage,
          message: `Stage set to ${state.stage.toUpperCase()}.`,
        });
      }

      // snapshot: aggregate from all sources
      const results: Record<string, unknown> = {
        stage: state.stage,
        product: state.product ?? null,
        startedAt: state.startedAt,
        runningFor: timeSince(state.startedAt),
      };

      // Stripe revenue
      if (params.stripeSecretKey) {
        try {
          const bal = await stripeGet(params.stripeSecretKey, "/balance");
          const charges = await stripeGet(
            params.stripeSecretKey,
            "/charges?limit=100&status=succeeded",
          );
          const chargeList = (charges as { data: Array<{ amount: number; currency: string }> }).data;
          const totalCents = chargeList.reduce((sum, c) => sum + c.amount, 0);
          const currency = chargeList[0]?.currency ?? "usd";

          state.metrics.totalRevenue = totalCents / 100;
          state.metrics.totalCharges = chargeList.length;
          state.metrics.mrr = totalCents / 100;

          results.revenue = {
            total: `${(totalCents / 100).toFixed(2)} ${currency.toUpperCase()}`,
            charges: chargeList.length,
            balance: bal,
          };
        } catch (err) {
          results.revenue = { error: String(err) };
        }
      } else {
        results.revenue = { status: "not_configured", hint: "Set stripeSecretKey in plugin config" };
      }

      // Site uptime check
      if (state.product?.url) {
        try {
          const start = Date.now();
          const res = await fetch(state.product.url, {
            method: "HEAD",
            signal: AbortSignal.timeout(10_000),
          });
          const latencyMs = Date.now() - start;
          results.uptime = {
            url: state.product.url,
            status: res.status,
            ok: res.ok,
            latencyMs,
          };
        } catch (err) {
          results.uptime = { url: state.product.url, ok: false, error: String(err) };
        }
      }

      // Submissions/marketing
      results.submissions = state.submissions.length;
      results.experiments = state.experiments.filter((e) => e.status === "active").length;

      // Recent actions
      results.recentActions = state.actionLog.slice(-10).map((a) => ({
        time: a.timestamp,
        action: a.action,
        result: a.result.slice(0, 120),
      }));

      // Update state
      state.metrics.lastUpdated = new Date().toISOString();
      params.writeState(state);

      return jsonResult(results);
    },
  };
}

async function stripeGet(secretKey: string, endpoint: string): Promise<unknown> {
  const res = await fetch(`https://api.stripe.com/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  if (!res.ok) {
    throw new Error(`Stripe GET ${endpoint}: ${res.status}`);
  }
  return res.json();
}

function timeSince(isoDate: string): string {
  const ms = Date.now() - new Date(isoDate).getTime();
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function jsonResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}
