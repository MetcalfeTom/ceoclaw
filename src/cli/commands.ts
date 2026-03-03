import type { Command } from "commander";
import { readState, resolveStateDir } from "../state/business-state.js";
import { DEFAULT_SOULS } from "../prompt/default-souls.js";

export function registerCeoCommands(params: {
  program: Command;
  stateDir?: string;
  openclawStateDir?: string;
}) {
  const ceo = params.program
    .command("ceo")
    .description("CEOClaw — AI startup team management");

  ceo
    .command("status")
    .description("Show current business status, team, and KPIs")
    .action(() => {
      const dir = resolveStateDir(params.stateDir);
      const state = readState(dir);
      console.log("");
      console.log(`  Stage:    ${state.stage.toUpperCase()}`);
      console.log(`  Running:  since ${state.startedAt}`);
      if (state.product) {
        console.log(`  Product:  ${state.product.name}`);
        if (state.product.url) console.log(`  URL:      ${state.product.url}`);
        if (state.product.stripePaymentLink)
          console.log(`  Payment:  ${state.product.stripePaymentLink}`);
      }
      console.log(`  Revenue:  $${state.metrics.totalRevenue.toFixed(2)} (${state.metrics.totalCharges} charges)`);
      console.log(`  Posts:    ${state.submissions.length} submissions`);
      if (state.telegramGroupId) {
        console.log(`  Chat:     Telegram group ${state.telegramGroupId}`);
      }
      console.log("");

      const active = state.team.filter((m) => m.status === "active");
      const fired = state.team.filter((m) => m.status === "fired");
      if (active.length > 0) {
        console.log("  Team:");
        for (const m of active) {
          const wr = m.wins + m.misses > 0
            ? ` (${((m.wins / (m.wins + m.misses)) * 100).toFixed(0)}%)`
            : "";
          console.log(`    ${m.name} [${m.role}] — ${m.wins}W/${m.misses}L${wr}`);
        }
        if (fired.length > 0) {
          console.log(`    (${fired.length} fired)`);
        }
        console.log("");
      }

      if (state.actionLog.length > 0) {
        console.log("  Recent actions:");
        for (const entry of state.actionLog.slice(-5)) {
          console.log(`    [${entry.timestamp}] ${entry.action}`);
        }
        console.log("");
      }
    });

  ceo
    .command("team")
    .description("Show detailed team roster with hire/fire history")
    .action(() => {
      const dir = resolveStateDir(params.stateDir);
      const state = readState(dir);
      console.log("");
      for (const m of state.team) {
        const statusIcon = m.status === "active" ? "✅" : "❌";
        console.log(`  ${statusIcon} ${m.name} [${m.role}] — ${m.status}`);
        console.log(`     Agent: ${m.agentId} | W/L: ${m.wins}/${m.misses} | Hired: ${m.hiredAt}`);
        if (m.firedAt) console.log(`     Fired: ${m.firedAt} — ${m.fireReason}`);
        if (m.personaHistory.length > 0) {
          console.log("     History:");
          for (const h of m.personaHistory.slice(-3)) {
            console.log(`       [${h.timestamp}] ${h.event}`);
          }
        }
        console.log("");
      }
    });

  ceo
    .command("report")
    .description("Generate a full mission report")
    .action(() => {
      const dir = resolveStateDir(params.stateDir);
      const state = readState(dir);
      console.log("");
      console.log("═══════════════════════════════════════");
      console.log("       CEOClaw Mission Report          ");
      console.log("═══════════════════════════════════════");
      console.log("");
      console.log(`Started:     ${state.startedAt}`);
      console.log(`Current:     ${new Date().toISOString()}`);
      console.log(`Duration:    ${timeSince(state.startedAt)}`);
      console.log(`Stage:       ${state.stage.toUpperCase()}`);
      console.log("");

      if (state.product) {
        console.log("── Product ──");
        console.log(`  ${state.product.name}: ${state.product.description}`);
        if (state.product.url) console.log(`  Live at: ${state.product.url}`);
        if (state.product.repoUrl) console.log(`  Repo: ${state.product.repoUrl}`);
        console.log("");
      }

      console.log("── Revenue ──");
      console.log(`  Total:   $${state.metrics.totalRevenue.toFixed(2)}`);
      console.log(`  Charges: ${state.metrics.totalCharges}`);
      console.log("");

      console.log("── Team ──");
      const active = state.team.filter((m) => m.status === "active");
      const fired = state.team.filter((m) => m.status === "fired");
      console.log(`  Active: ${active.length} | Fired: ${fired.length}`);
      for (const m of state.team) {
        const icon = m.status === "active" ? "✅" : "❌";
        console.log(`  ${icon} ${m.name} [${m.role}] ${m.wins}W/${m.misses}L — ${m.personaHistory.length} persona changes`);
      }
      console.log("");

      if (state.submissions.length > 0) {
        console.log("── Marketing ──");
        for (const sub of state.submissions) {
          console.log(`  ${sub.platform}${sub.url ? ` → ${sub.url}` : ""} (${sub.postedAt})`);
        }
        console.log("");
      }

      console.log("── Full Action Log ──");
      for (const entry of state.actionLog) {
        console.log(`  [${entry.timestamp}] [${entry.stage}] ${entry.action}: ${entry.result.slice(0, 120)}`);
      }
      console.log("");
      console.log("═══════════════════════════════════════");
    });

  ceo
    .command("setup")
    .description("Print the OpenClaw config needed for the multi-bot team setup")
    .action(() => {
      console.log("");
      console.log("CEOClaw Multi-Bot Setup Guide");
      console.log("═════════════════════════════");
      console.log("");
      console.log("1. Create 4 Telegram bots via @BotFather:");
      console.log("   - @your_ceo_bot    (the CEO)");
      console.log("   - @your_dev_bot    (the Developer)");
      console.log("   - @your_mkt_bot    (Marketing)");
      console.log("   - @your_sales_bot  (Sales)");
      console.log("");
      console.log("2. Create a Telegram group and add all 4 bots");
      console.log("   Note the group chat ID (use @userinfobot or check gateway logs)");
      console.log("");
      console.log("3. Add to your OpenClaw config:");
      console.log("");
      console.log("agents:");
      console.log("  list:");
      for (const [role, info] of Object.entries(DEFAULT_SOULS)) {
        console.log(`    - id: ${role}`);
        console.log(`      name: "${info.name}"`);
        if (role === "ceo") {
          console.log("      default: true");
        }
        console.log(`      workspace: "~/.openclaw/workspace-${role}"`);
        console.log(`      identity:`);
        console.log(`        name: "${info.name}"`);
      }
      console.log("");
      console.log("channels:");
      console.log("  telegram:");
      console.log("    accounts:");
      console.log("      ceo:    { token: BOT_TOKEN_CEO }");
      console.log("      dev:    { token: BOT_TOKEN_DEV }");
      console.log("      mkt:    { token: BOT_TOKEN_MKT }");
      console.log("      sales:  { token: BOT_TOKEN_SALES }");
      console.log("");
      console.log("bindings:");
      console.log("  - { agentId: ceo,       match: { channel: telegram, accountId: ceo } }");
      console.log("  - { agentId: dev,       match: { channel: telegram, accountId: dev } }");
      console.log("  - { agentId: marketing, match: { channel: telegram, accountId: mkt } }");
      console.log("  - { agentId: sales,     match: { channel: telegram, accountId: sales } }");
      console.log("");
      console.log("tools:");
      console.log("  agentToAgent: { enabled: true, allow: ['*'] }");
      console.log("");
      console.log("4. Set the CEOClaw plugin config:");
      console.log("   openclaw config set plugins.entries.ceoclaw.config.telegramGroupId '<GROUP_CHAT_ID>'");
      console.log("");
    });

  ceo
    .command("reset")
    .description("Reset CEOClaw state (start fresh)")
    .action(() => {
      const dir = resolveStateDir(params.stateDir);
      const statePath = `${dir}/state.json`;
      const fs = require("node:fs");
      if (fs.existsSync(statePath)) {
        fs.unlinkSync(statePath);
        console.log("CEOClaw state reset.");
      } else {
        console.log("No state file found. Already clean.");
      }
    });
}

function timeSince(isoDate: string): string {
  const ms = Date.now() - new Date(isoDate).getTime();
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h ${minutes}m`;
  }
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
