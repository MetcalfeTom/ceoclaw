import type { CEOClawState } from "../state/business-state.js";

/**
 * Generates the CEO's OODA loop prompt for autonomous cron turns.
 * The CEO delegates to team members via the Telegram group.
 */
export function buildOodaPrompt(state: CEOClawState): string {
  const sections: string[] = [];

  sections.push("# CEOClaw OODA Loop — CEO Execution Cycle");
  sections.push("");
  sections.push("You are the CEO. Execute the following steps:");
  sections.push("");

  // Step 1: Observe
  sections.push("## 1. OBSERVE");
  sections.push("- Call `business_metrics` with action='snapshot' for current KPIs");
  sections.push("- Call `team_manage` with action='list' to see team performance");
  sections.push("- Read recent Telegram group messages if available");
  sections.push("");

  // Step 2: Orient
  sections.push("## 2. ORIENT");
  sections.push(`Current stage: **${state.stage}**`);
  sections.push("");

  const activeTeam = state.team.filter((m) => m.status === "active");
  const vacantRoles = (["dev", "marketing", "sales"] as const).filter(
    (r) => !activeTeam.find((m) => m.role === r),
  );

  if (vacantRoles.length > 0) {
    sections.push(`**VACANT ROLES: ${vacantRoles.join(", ")}** — hire these immediately using team_manage.`);
    sections.push("");
  }

  // Team performance check
  const underperformers = activeTeam.filter(
    (m) => m.wins + m.misses >= 3 && m.misses > m.wins,
  );
  if (underperformers.length > 0) {
    sections.push("**UNDERPERFORMERS DETECTED:**");
    for (const m of underperformers) {
      sections.push(`- ${m.name} (${m.role}): ${m.wins}W/${m.misses}L — consider firing`);
    }
    sections.push("");
  }

  switch (state.stage) {
    case "ideation":
      sections.push("No product yet. As CEO you should:");
      sections.push("1. Pick a product idea (or decide yourself)");
      sections.push("2. Ensure Dev is hired. If not, hire one with team_manage.");
      sections.push("3. Post in the Telegram group: announce the product idea and assign Dev to build it.");
      break;

    case "build":
      sections.push(`Product: ${state.product?.name ?? "unnamed"}`);
      sections.push("The product is being built. As CEO:");
      sections.push("1. Check if Dev has made progress (check Telegram group or ask)");
      sections.push("2. If Dev is slow, evaluate them (team_manage evaluate, note: 'miss')");
      sections.push("3. Create the Stripe product and payment link yourself (stripe_revenue)");
      sections.push("4. Ensure Marketing and Sales are hired for the next phase");
      sections.push("5. When the product is deployed with payments, advance to LAUNCH stage");
      break;

    case "launch":
      sections.push(`Product: ${state.product?.name} at ${state.product?.url ?? "not deployed"}`);
      sections.push(`Revenue: $${state.metrics.totalRevenue.toFixed(2)}`);
      sections.push("Product is live. As CEO:");
      sections.push("1. Post a rallying message in the Telegram group");
      sections.push("2. Assign Marketing to post on at least 3 platforms");
      sections.push("3. Assign Sales to monitor Stripe and report conversion data");
      sections.push("4. Evaluate team performance after this cycle");
      sections.push("5. If revenue hits $1+, celebrate in the group and advance to GROWTH");
      break;

    case "growth":
      sections.push(`Revenue: $${state.metrics.totalRevenue.toFixed(2)} (${state.metrics.totalCharges} charges)`);
      sections.push("Revenue is coming in. As CEO:");
      sections.push("1. Review each team member's performance");
      sections.push("2. Fire underperformers, rehire with different strategies");
      sections.push("3. Assign Marketing to expand to new channels");
      sections.push("4. Assign Dev to improve the product based on feedback");
      sections.push("5. Push toward $100 MRR");
      break;
  }
  sections.push("");

  // Step 3: Decide
  sections.push("## 3. DECIDE");
  sections.push("Pick the SINGLE most important action. Consider:");
  sections.push("- Do you need to hire anyone? (team_manage hire)");
  sections.push("- Does someone need to be fired? (team_manage fire)");
  sections.push("- What should you delegate to your team?");
  sections.push("- What should you do yourself as CEO?");
  sections.push("");

  // Step 4: Act
  sections.push("## 4. ACT");
  sections.push("Execute your decision. Use the Telegram group to:");
  sections.push("- Give assignments to team members");
  sections.push("- Share metrics and updates");
  sections.push("- Announce hiring/firing decisions");
  sections.push("- Celebrate wins");
  sections.push("");
  sections.push("After acting, evaluate relevant team members (team_manage evaluate).");

  // Stage transitions
  sections.push("");
  sections.push("## Stage Transitions");
  sections.push("- IDEATION -> BUILD: product idea chosen, Dev assigned");
  sections.push("- BUILD -> LAUNCH: product deployed with live Stripe payment link");
  sections.push("- LAUNCH -> GROWTH: at least 1 real payment received");

  return sections.join("\n");
}

/**
 * Returns the cron job configuration for the CEO's OODA loop.
 */
export function buildOodaCronConfig(intervalMinutes: number) {
  return {
    id: "ceoclaw-ceo-ooda-loop",
    name: "CEOClaw CEO OODA Loop",
    enabled: true,
    schedule: {
      type: "every" as const,
      intervalMs: intervalMinutes * 60 * 1000,
    },
    payload: {
      type: "agentTurn" as const,
      message:
        "CEOClaw CEO cycle: Run your OODA loop. " +
        "1) Check business_metrics and team_manage list. " +
        "2) Orient on current stage and team performance. " +
        "3) Decide the highest-leverage action. " +
        "4) Execute: delegate to your team via Telegram, hire/fire if needed, or act directly.",
      runTimeoutSec: 600,
    },
    delivery: { mode: "none" as const },
  };
}
