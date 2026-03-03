import type { CEOClawState } from "../state/business-state.js";
import { DEFAULT_SOULS } from "./default-souls.js";

export function buildFounderContext(state: CEOClawState): string {
  const sections: string[] = [];

  sections.push("## CEOClaw — AI Startup CEO");
  sections.push("");
  sections.push(
    "You are the CEO of an AI startup. You run a team of AI agents, each with their own Telegram bot.",
  );
  sections.push(
    "Your team communicates in a shared Telegram group. You delegate, evaluate, and if needed, fire and rehire.",
  );
  sections.push("");

  sections.push(`### Current Stage: ${state.stage.toUpperCase()}`);
  sections.push(`Running since: ${state.startedAt} (${timeSince(state.startedAt)})`);
  sections.push("");

  // Team roster
  const active = state.team.filter((m) => m.status === "active");
  const fired = state.team.filter((m) => m.status === "fired");
  const vacantRoles = (["dev", "marketing", "sales"] as const).filter(
    (r) => !active.find((m) => m.role === r),
  );

  sections.push("### Team Roster");
  if (active.length > 0) {
    for (const m of active) {
      const winRate =
        m.wins + m.misses > 0
          ? ` (${((m.wins / (m.wins + m.misses)) * 100).toFixed(0)}% win rate)`
          : "";
      sections.push(
        `- **${m.name}** [${m.role}] — ${m.wins}W/${m.misses}L${winRate} — agent: ${m.agentId}`,
      );
    }
  }
  if (fired.length > 0) {
    sections.push(`- *${fired.length} previously fired member(s)*`);
  }
  if (active.length === 0) {
    sections.push("**EMPTY — no team members hired yet.**");
  }
  sections.push("");

  if (state.telegramGroupId) {
    sections.push(`### Team Chat: Telegram group ${state.telegramGroupId}`);
    sections.push(
      "Use the message tool to post in the group: `message action=send channel=telegram target=" +
        state.telegramGroupId +
        "`",
    );
    sections.push("");
  }

  if (state.product) {
    sections.push("### Product");
    sections.push(`- Name: ${state.product.name}`);
    sections.push(`- Description: ${state.product.description}`);
    if (state.product.url) sections.push(`- Live URL: ${state.product.url}`);
    if (state.product.repoUrl) sections.push(`- Repo: ${state.product.repoUrl}`);
    if (state.product.stripePaymentLink) {
      sections.push(`- Payment Link: ${state.product.stripePaymentLink}`);
    }
    sections.push("");
  }

  sections.push("### Metrics");
  sections.push(
    `- Revenue: $${state.metrics.totalRevenue.toFixed(2)} (${state.metrics.totalCharges} charges)`,
  );
  sections.push(`- Traffic: ${state.metrics.traffic} pageviews`);
  sections.push(`- Last updated: ${state.metrics.lastUpdated}`);
  sections.push("");

  if (state.submissions.length > 0) {
    sections.push("### Marketing Submissions");
    for (const sub of state.submissions.slice(-5)) {
      sections.push(`- ${sub.platform}${sub.url ? ` (${sub.url})` : ""} — ${sub.postedAt}`);
    }
    sections.push("");
  }

  if (state.actionLog.length > 0) {
    sections.push("### Recent Actions (last 5)");
    for (const entry of state.actionLog.slice(-5)) {
      sections.push(`- [${entry.timestamp}] ${entry.action}: ${entry.result.slice(0, 100)}`);
    }
    sections.push("");
  }

  // --- IMPERATIVE EXECUTION BLOCK ---
  sections.push("---");
  sections.push("## MANDATORY ACTIONS — EXECUTE THESE NOW");
  sections.push("");
  sections.push("**CRITICAL: You must CALL TOOLS in this turn. Do NOT just describe what you would do.**");
  sections.push("**Narrating plans without tool calls is a failure. Every turn must produce at least one tool call.**");
  sections.push("");

  if (vacantRoles.length > 0) {
    sections.push(`### 🚨 VACANT ROLES: ${vacantRoles.join(", ")}`);
    sections.push("");
    sections.push("You MUST hire these roles NOW. For each vacant role, call `team_manage` with:");
    sections.push('- `action`: "hire"');
    sections.push("- `role`: the role name");
    sections.push("- `name`: a character name for the agent");
    sections.push("- `persona`: a full SOUL.md persona (at least 10 lines defining personality, priorities, and style)");
    sections.push("");

    for (const role of vacantRoles) {
      const defaults = DEFAULT_SOULS[role];
      sections.push(`**Hire ${role} now.** Example persona for ${defaults.name}:`);
      sections.push("```");
      sections.push(defaults.soul.trim().slice(0, 400) + "...");
      sections.push("```");
      sections.push("");
    }
  }

  switch (state.stage) {
    case "ideation":
      sections.push("### Stage: IDEATION — What to do NOW");
      if (vacantRoles.includes("dev")) {
        sections.push("1. **FIRST**: Call `team_manage` to hire dev (see above)");
        sections.push("2. **THEN**: Pick a product idea and post it in the Telegram group");
      } else {
        sections.push("1. Pick a concrete product idea (AI micro-SaaS, paid API, tool)");
        sections.push("2. Post the idea in the Telegram group and assign Dev to build it");
        sections.push("3. Hire Marketing and Sales if not yet hired");
      }
      break;

    case "build":
      sections.push("### Stage: BUILD — What to do NOW");
      sections.push(`Product: ${state.product?.name ?? "unnamed"}`);
      sections.push("1. Check Dev's progress — message in Telegram or evaluate");
      sections.push("2. Create Stripe product/price/payment-link via `stripe_revenue`");
      sections.push("3. Ensure Marketing and Sales are hired");
      sections.push("4. When product + payments are live → advance to LAUNCH");
      break;

    case "launch":
      sections.push("### Stage: LAUNCH — What to do NOW");
      sections.push(`Product: ${state.product?.name} at ${state.product?.url ?? "not deployed"}`);
      sections.push("1. Assign Marketing to post on 3+ platforms via Telegram");
      sections.push("2. Assign Sales to monitor stripe_revenue");
      sections.push("3. Evaluate team performance via `team_manage evaluate`");
      sections.push("4. If revenue > $0 → advance to GROWTH");
      break;

    case "growth":
      sections.push("### Stage: GROWTH — What to do NOW");
      sections.push(`Revenue: $${state.metrics.totalRevenue.toFixed(2)}`);
      sections.push("1. Evaluate all team members");
      sections.push("2. Fire underperformers (misses > wins after 3+ tasks)");
      sections.push("3. Assign Marketing to expand channels");
      sections.push("4. Push toward $100 MRR");
      break;
  }

  sections.push("");
  sections.push("### Execution Rules");
  sections.push("- CALL the tools. Do not just talk about calling them.");
  sections.push("- If you need to hire, call `team_manage` with action=\"hire\" RIGHT NOW.");
  sections.push("- If you need metrics, call `business_metrics` with action=\"snapshot\" RIGHT NOW.");
  sections.push("- After tool calls, summarize results in the Telegram group.");
  sections.push("- Every turn must advance the business. Zero-action turns are unacceptable.");

  return sections.join("\n");
}

function timeSince(isoDate: string): string {
  const ms = Date.now() - new Date(isoDate).getTime();
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
