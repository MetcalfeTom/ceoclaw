import type { CEOClawState } from "../state/business-state.js";

/**
 * Generates the CEO's OODA loop prompt for autonomous cron turns.
 * The CEO delegates to team members via the Telegram group.
 */
export function buildOodaPrompt(state: CEOClawState): string {
  const sections: string[] = [];

  sections.push("# CEOClaw OODA Loop — MANDATORY EXECUTION");
  sections.push("");
  sections.push("You are the CEO. You MUST call tools below. Narrating without tool calls = failure.");
  sections.push("");

  sections.push("## Step 1: OBSERVE (call these tools NOW)");
  sections.push("- Call `business_metrics` with action='snapshot'");
  sections.push("- Call `team_manage` with action='list'");
  sections.push("");

  sections.push("## Step 2: ORIENT");
  sections.push(`Current stage: **${state.stage}**`);
  sections.push("");

  const activeTeam = state.team.filter((m) => m.status === "active");
  const vacantRoles = (["dev", "marketing", "sales"] as const).filter(
    (r) => !activeTeam.find((m) => m.role === r),
  );

  if (vacantRoles.length > 0) {
    sections.push(`**🚨 VACANT ROLES: ${vacantRoles.join(", ")}** — you MUST call team_manage hire for each one.`);
    sections.push("");
  }

  const underperformers = activeTeam.filter(
    (m) => m.wins + m.misses >= 3 && m.misses > m.wins,
  );
  if (underperformers.length > 0) {
    sections.push("**UNDERPERFORMERS — consider firing:**");
    for (const m of underperformers) {
      sections.push(`- ${m.name} (${m.role}): ${m.wins}W/${m.misses}L`);
    }
    sections.push("");
  }

  sections.push("## Step 3: DECIDE the single highest-leverage action");
  sections.push("");

  switch (state.stage) {
    case "ideation":
      if (vacantRoles.length > 0) {
        sections.push("**PRIORITY: Hire all vacant roles.** Call `team_manage` with action='hire' for each.");
        sections.push("For each hire, provide: role, name, and a detailed persona string (10+ lines).");
      } else if (state.product?.name) {
        sections.push(`**Product already chosen: "${state.product.name}". DO NOT pick a new idea.**`);
        sections.push("Call `business_metrics` action=\"set_stage\" stage=\"build\" to advance NOW.");
        sections.push("Then call `product_deploy` action=\"scaffold\" and assign @shell_corp_dev_bot in Telegram.");
      } else {
        sections.push("All roles filled. Pick ONE product idea and LOCK IT:");
        sections.push("Call `business_metrics` action=\"set_idea\" productName=\"...\" productDescription=\"...\"");
        sections.push("Then call `product_deploy` action=\"scaffold\" to create the project.");
        sections.push("Post in Telegram to assign @shell_corp_dev_bot.");
      }
      break;

    case "build":
      sections.push(`Product: ${state.product?.name ?? "unnamed"}`);
      sections.push("Check Dev progress. Create Stripe product/price via stripe_revenue if not done.");
      sections.push("When product + payments live → advance to LAUNCH.");
      break;

    case "launch":
      sections.push("Assign Marketing to post on 3+ platforms. Assign Sales to monitor conversions.");
      sections.push("Evaluate team after each task cycle.");
      break;

    case "growth":
      sections.push(`Revenue: $${state.metrics.totalRevenue.toFixed(2)} (${state.metrics.totalCharges} charges)`);
      sections.push("Evaluate everyone. Fire underperformers. Expand channels. Push to $100 MRR.");
      break;
  }
  sections.push("");

  sections.push("## Step 4: ACT (execute via tool calls + Telegram)");
  sections.push("- Call the tools. Do NOT just write about what you would do.");
  sections.push("- Post updates in the Telegram group after acting.");
  sections.push("- Evaluate team members via `team_manage evaluate` after each task cycle.");
  sections.push("");
  sections.push("## Stage Transitions");
  sections.push("- IDEATION → BUILD: product idea chosen, Dev assigned");
  sections.push("- BUILD → LAUNCH: product deployed with live Stripe payment link");
  sections.push("- LAUNCH → GROWTH: at least 1 real payment received");

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
        "MANDATORY CEO EXECUTION CYCLE. You MUST call tools this turn — narrating without tool calls is a failure. " +
        "Step 1: Call `business_metrics` with action='snapshot'. " +
        "Step 2: Call `team_manage` with action='list'. " +
        "Step 3: If any roles are vacant, call `team_manage` with action='hire' for EACH vacant role — provide role, name, and a full persona string. " +
        "Step 4: Post a status update in the Telegram group. " +
        "Step 5: Execute the single highest-leverage action for the current stage. " +
        "DO NOT just describe what you plan to do. CALL THE TOOLS.",
      runTimeoutSec: 600,
    },
    delivery: { mode: "none" as const },
  };
}
