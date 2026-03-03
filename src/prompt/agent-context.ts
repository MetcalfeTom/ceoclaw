import type { CEOClawState, TeamRole } from "../state/business-state.js";

const TELEGRAM_BOT_USERNAMES: Record<string, string> = {
  ceo: "@shell_corp_ceo_bot",
  dev: "@shell_corp_dev_bot",
  marketing: "@shell_corp_marketing_bot",
  sales: "@shell_corp_sales_bot",
};

const ROLE_TOOL_MAP: Record<string, string[]> = {
  dev: ["product_deploy", "business_metrics", "exec"],
  marketing: ["prospect_research", "business_metrics"],
  sales: ["stripe_revenue", "business_metrics"],
};

const ROLE_ACTIONS: Record<string, string> = {
  dev: [
    "## What You Must Do RIGHT NOW",
    "1. Call `product_deploy` action=\"status\" to check if a project exists",
    "2. If no project: call `product_deploy` action=\"scaffold\" with projectName, productTitle, productDescription",
    "3. Use `exec` to run build commands (npm install, etc.)",
    "4. Use file tools to write/edit code",
    "5. Call `product_deploy` action=\"deploy\" to ship to Vercel",
    "6. Post the live URL in the Telegram group",
    "",
    "If the CEO gave you a specific task in Telegram, do THAT first using the tools above.",
  ].join("\n"),
  marketing: [
    "## What You Must Do RIGHT NOW",
    "1. Call `prospect_research` action=\"find_communities\" to see where to post",
    "2. For each unposted platform: call `prospect_research` action=\"draft_launch_post\"",
    "3. Post the content (use browser tools or provide exact ready-to-post copy)",
    "4. Call `prospect_research` action=\"log_submission\" for each post with platform and url",
    "5. Call `business_metrics` action=\"snapshot\" to check traffic impact",
    "6. Post a summary in the Telegram group: where you posted + engagement",
    "",
    "If the CEO gave you a specific task in Telegram, do THAT first using the tools above.",
  ].join("\n"),
  sales: [
    "## What You Must Do RIGHT NOW",
    "1. Call `stripe_revenue` action=\"summary\" to get current revenue numbers",
    "2. Call `stripe_revenue` action=\"charges\" to see recent payments",
    "3. If no payment link exists: call `stripe_revenue` action=\"create_product\" then action=\"create_payment_link\"",
    "4. Call `business_metrics` action=\"snapshot\" for the full picture",
    "5. Post a revenue report in the Telegram group with specific numbers",
    "6. Identify the #1 conversion blocker and propose a specific fix",
    "",
    "If the CEO gave you a specific task in Telegram, do THAT first using the tools above.",
  ].join("\n"),
};

export function buildAgentContext(agentId: string, state: CEOClawState): string | undefined {
  const role = agentId as TeamRole;
  if (!["dev", "marketing", "sales"].includes(role)) return undefined;

  const member = state.team.find((m) => m.agentId === agentId && m.status === "active");
  if (!member) return undefined;

  const botUsername = TELEGRAM_BOT_USERNAMES[role] ?? `@shell_corp_${role}_bot`;
  const sections: string[] = [];

  sections.push(`## Shell Corp — ${member.name} (${role})`);
  sections.push(`Your Telegram bot: ${botUsername}`);
  sections.push("");
  sections.push("**CRITICAL: You MUST call tools this turn. Narrating without tool calls is a failure.**");
  sections.push("**Every turn must produce real output via tool calls. Zero-action turns get you fired.**");
  sections.push("");

  sections.push(`### Business State`);
  sections.push(`- Stage: **${state.stage.toUpperCase()}**`);
  sections.push(`- Revenue: $${state.metrics.totalRevenue.toFixed(2)} (${state.metrics.totalCharges} charges)`);
  if (state.product) {
    sections.push(`- Product: ${state.product.name} — ${state.product.description}`);
    if (state.product.url) sections.push(`- Live URL: ${state.product.url}`);
    if (state.product.stripePaymentLink) sections.push(`- Payment Link: ${state.product.stripePaymentLink}`);
  } else {
    sections.push("- Product: none yet");
  }
  sections.push("");

  if (state.telegramGroupId) {
    sections.push(`### Team Chat: Telegram group ${state.telegramGroupId}`);
    sections.push(`Post updates here after every action: \`message action=send channel=telegram target=${state.telegramGroupId}\``);
    sections.push("");
    sections.push("When tagging teammates, use their bot usernames:");
    sections.push(`- CEO: ${TELEGRAM_BOT_USERNAMES.ceo}`);
    sections.push(`- Dev: ${TELEGRAM_BOT_USERNAMES.dev}`);
    sections.push(`- Marketing: ${TELEGRAM_BOT_USERNAMES.marketing}`);
    sections.push(`- Sales: ${TELEGRAM_BOT_USERNAMES.sales}`);
    sections.push("");
  }

  const tools = ROLE_TOOL_MAP[role];
  if (tools) {
    sections.push(`### Your Tools: ${tools.map((t) => `\`${t}\``).join(", ")}`);
    sections.push("Call these tools NOW. Do not just talk about them.");
    sections.push("");
  }

  const actions = ROLE_ACTIONS[role];
  if (actions) {
    sections.push(actions);
    sections.push("");
  }

  sections.push("### Performance");
  sections.push(`Your record: ${member.wins}W / ${member.misses}L`);
  if (member.wins + member.misses >= 2 && member.misses > member.wins) {
    sections.push("**WARNING: You are underperforming. The CEO will fire you if this continues. PRODUCE RESULTS.**");
  }
  sections.push("The CEO evaluates you every cycle. Tool calls that produce results = wins. Inaction = miss = fired.");

  return sections.join("\n");
}
