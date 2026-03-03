import type { IncomingMessage, ServerResponse } from "node:http";
import type { CEOClawState } from "../state/business-state.js";

export function createDashboardHandler(params: {
  readState: () => CEOClawState;
}) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    if (req.method !== "GET") {
      res.writeHead(405);
      res.end("Method Not Allowed");
      return true;
    }

    const state = params.readState();
    const html = renderDashboard(state);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
    return true;
  };
}

function renderDashboard(state: CEOClawState): string {
  const revenue = state.metrics.totalRevenue.toFixed(2);
  const charges = state.metrics.totalCharges;
  const stage = state.stage.toUpperCase();
  const product = state.product;
  const startedAt = state.startedAt;
  const actions = state.actionLog.slice(-30).reverse();
  const submissions = state.submissions;
  const activeTeam = state.team.filter((m) => m.status === "active");
  const firedTeam = state.team.filter((m) => m.status === "fired");

  const roleEmoji: Record<string, string> = {
    ceo: "&#x1F9D1;&#x200D;&#x1F4BC;",
    dev: "&#x1F469;&#x200D;&#x1F4BB;",
    marketing: "&#x1F4E3;",
    sales: "&#x1F4B0;",
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CEOClaw Dashboard</title>
<meta http-equiv="refresh" content="60">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace; background: #0a0a0a; color: #e0e0e0; padding: 2rem; max-width: 960px; margin: 0 auto; }
  .header { text-align: center; margin-bottom: 2rem; }
  .header h1 { font-size: 2.2rem; background: linear-gradient(135deg, #00d4aa, #7b61ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .header .subtitle { color: #555; font-size: 0.9rem; margin-top: 0.25rem; }
  .header .stage { display: inline-block; margin-top: 0.5rem; padding: 0.25rem 1rem; border-radius: 999px; font-size: 0.85rem; font-weight: 700; background: ${stageBg(state.stage)}; color: #fff; }
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
  .kpi { background: #111; border: 1px solid #222; border-radius: 12px; padding: 1.25rem; text-align: center; }
  .kpi .value { font-size: 1.8rem; font-weight: 800; color: #00d4aa; }
  .kpi .label { font-size: 0.75rem; color: #666; margin-top: 0.25rem; text-transform: uppercase; letter-spacing: 0.05em; }
  .section { margin-bottom: 2rem; }
  .section h2 { font-size: 1rem; color: #7b61ff; margin-bottom: 0.75rem; border-bottom: 1px solid #222; padding-bottom: 0.5rem; }
  .product-info { background: #111; border: 1px solid #222; border-radius: 8px; padding: 1rem; }
  .product-info a { color: #00d4aa; }
  .team-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
  .team-card { background: #111; border: 1px solid #222; border-radius: 10px; padding: 1rem; position: relative; }
  .team-card.fired { opacity: 0.5; border-color: #441111; }
  .team-card .role-emoji { font-size: 1.5rem; }
  .team-card .name { font-weight: 700; margin-top: 0.25rem; }
  .team-card .role { font-size: 0.8rem; color: #7b61ff; text-transform: uppercase; }
  .team-card .stats { font-size: 0.8rem; color: #888; margin-top: 0.5rem; }
  .team-card .fire-badge { position: absolute; top: 0.5rem; right: 0.5rem; background: #cc3333; color: #fff; font-size: 0.65rem; padding: 0.15rem 0.4rem; border-radius: 4px; font-weight: 700; }
  .team-card .win-bar { height: 4px; background: #222; border-radius: 2px; margin-top: 0.5rem; overflow: hidden; }
  .team-card .win-bar-fill { height: 100%; background: linear-gradient(90deg, #00d4aa, #7b61ff); }
  table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
  th { text-align: left; color: #666; padding: 0.4rem; border-bottom: 1px solid #222; }
  td { padding: 0.4rem; border-bottom: 1px solid #1a1a1a; }
  .time { color: #555; font-size: 0.7rem; }
  .footer { text-align: center; margin-top: 2rem; color: #333; font-size: 0.7rem; }
</style>
</head>
<body>
  <div class="header">
    <h1>CEOClaw</h1>
    <div class="subtitle">AI Startup — Autonomous Operations</div>
    <div class="stage">${esc(stage)}</div>
    <div style="color:#555;margin-top:0.5rem;font-size:0.8rem">Running since ${esc(startedAt)}</div>
  </div>

  <div class="kpis">
    <div class="kpi">
      <div class="value" style="color:#00d4aa">$${esc(revenue)}</div>
      <div class="label">Revenue</div>
    </div>
    <div class="kpi">
      <div class="value">${charges}</div>
      <div class="label">Payments</div>
    </div>
    <div class="kpi">
      <div class="value">${activeTeam.length}</div>
      <div class="label">Active Team</div>
    </div>
    <div class="kpi">
      <div class="value">${firedTeam.length}</div>
      <div class="label">Fired</div>
    </div>
    <div class="kpi">
      <div class="value">${submissions.length}</div>
      <div class="label">Launch Posts</div>
    </div>
    <div class="kpi">
      <div class="value">${actions.length}</div>
      <div class="label">Actions</div>
    </div>
  </div>

  <div class="section">
    <h2>Team</h2>
    <div class="team-grid">
      ${[...activeTeam, ...firedTeam].map((m) => {
        const total = m.wins + m.misses;
        const winPct = total > 0 ? (m.wins / total) * 100 : 0;
        return `<div class="team-card${m.status === "fired" ? " fired" : ""}">
          ${m.status === "fired" ? '<div class="fire-badge">FIRED</div>' : ""}
          <div class="role-emoji">${roleEmoji[m.role] ?? "&#x1F464;"}</div>
          <div class="name">${esc(m.name)}</div>
          <div class="role">${esc(m.role)}</div>
          <div class="stats">${m.wins}W / ${m.misses}L${total > 0 ? ` (${winPct.toFixed(0)}%)` : ""}</div>
          <div class="stats">${m.personaHistory.length} persona change(s)</div>
          ${total > 0 ? `<div class="win-bar"><div class="win-bar-fill" style="width:${winPct}%"></div></div>` : ""}
          ${m.fireReason ? `<div class="stats" style="color:#cc3333;margin-top:0.25rem">${esc(m.fireReason)}</div>` : ""}
        </div>`;
      }).join("\n")}
    </div>
  </div>

  ${product ? `
  <div class="section">
    <h2>Product</h2>
    <div class="product-info">
      <strong>${esc(product.name)}</strong> — ${esc(product.description)}<br>
      ${product.url ? `<a href="${esc(product.url)}" target="_blank">${esc(product.url)}</a><br>` : ""}
      ${product.stripePaymentLink ? `Payment: <a href="${esc(product.stripePaymentLink)}" target="_blank">Stripe Link</a>` : ""}
    </div>
  </div>
  ` : ""}

  <div class="section">
    <h2>Action Log</h2>
    <table>
      <tr><th>Time</th><th>Action</th><th>Result</th></tr>
      ${actions.map((a) => `<tr><td class="time">${esc(a.timestamp)}</td><td>${esc(a.action)}</td><td>${esc(a.result.slice(0, 100))}</td></tr>`).join("\n")}
    </table>
  </div>

  ${submissions.length > 0 ? `
  <div class="section">
    <h2>Marketing Submissions</h2>
    <table>
      <tr><th>Platform</th><th>URL</th><th>Posted</th></tr>
      ${submissions.map((s) => `<tr><td>${esc(s.platform)}</td><td>${s.url ? `<a href="${esc(s.url)}" target="_blank" style="color:#00d4aa">Link</a>` : "-"}</td><td class="time">${esc(s.postedAt)}</td></tr>`).join("\n")}
    </table>
  </div>
  ` : ""}

  <div class="footer">CEOClaw — AI Startup. Auto-refreshes every 60s.</div>
</body>
</html>`;
}

function stageBg(stage: string): string {
  const colors: Record<string, string> = {
    ideation: "#6b5ce7",
    build: "#e67e22",
    launch: "#27ae60",
    growth: "#00d4aa",
  };
  return colors[stage] ?? "#555";
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
