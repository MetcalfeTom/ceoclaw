import fs from "node:fs";
import path from "node:path";
import { Type } from "@sinclair/typebox";
import type { CEOClawState, TeamMember, TeamRole } from "../state/business-state.js";

export const TeamManageSchema = Type.Object({
  action: Type.String({
    description:
      '"list" — show current team roster and performance. ' +
      '"hire" — hire/create a team member with a specific persona. ' +
      '"fire" — fire an underperforming team member (with reason). ' +
      '"rehire" — rehire a fired role with a new persona (new SOUL.md). ' +
      '"evaluate" — review a team member\'s performance. ' +
      '"update_persona" — rewrite a team member\'s SOUL.md to change their behavior.',
  }),
  role: Type.Optional(
    Type.String({ description: 'Team role: "dev", "marketing", "sales"' }),
  ),
  name: Type.Optional(
    Type.String({ description: "Display name for the team member" }),
  ),
  persona: Type.Optional(
    Type.String({
      description:
        "Full persona text for SOUL.md. This defines who the agent is, how they think, and what they prioritize. " +
        "Be specific: include their name, role, communication style, strengths, and any special instructions.",
    }),
  ),
  reason: Type.Optional(
    Type.String({ description: "Reason for firing or persona change" }),
  ),
  performanceNote: Type.Optional(
    Type.String({ description: 'Performance note: "win" or "miss" with description' }),
  ),
});

const DEFAULT_AGENT_IDS: Record<TeamRole, string> = {
  ceo: "ceo",
  dev: "dev",
  marketing: "marketing",
  sales: "sales",
};

export function createTeamManageTool(params: {
  stateDir: string;
  readState: () => CEOClawState;
  writeState: (s: CEOClawState) => void;
  /** Base directory where agent workspaces live (e.g. ~/.openclaw) */
  openclawStateDir: string;
}) {
  return {
    name: "team_manage",
    label: "Team Management",
    description: [
      "Manage your AI startup team. Each team member is a separate OpenClaw agent with its own Telegram bot and persona.",
      '"list": see all team members, their status, and performance stats.',
      '"hire": bring on a new team member by writing their SOUL.md persona file.',
      '"fire": remove an underperforming member (disables them, records the reason).',
      '"rehire": replace a fired member with a new persona for that role.',
      '"evaluate": record a win or miss for a team member.',
      '"update_persona": rewrite a member\'s SOUL.md to change their behavior mid-run.',
      "",
      "When you fire someone and rehire, the new persona takes effect on their next agent turn.",
      "This is how you iterate on your team: if Marketing isn't driving traffic, fire them and hire",
      "someone with a different strategy. If Dev is building too slowly, rewrite their persona to prioritize speed.",
    ].join(" "),
    parameters: TeamManageSchema,
    execute: async (_toolCallId: string, p: Record<string, unknown>) => {
      const action = String(p.action ?? "list");
      const state = params.readState();

      if (action === "list") {
        const roster = state.team.map((m) => ({
          role: m.role,
          name: m.name,
          agentId: m.agentId,
          status: m.status,
          wins: m.wins,
          misses: m.misses,
          hiredAt: m.hiredAt,
          firedAt: m.firedAt,
          fireReason: m.fireReason,
          personaChanges: m.personaHistory.length,
        }));
        return jsonResult({
          teamSize: state.team.filter((m) => m.status === "active").length,
          roster,
        });
      }

      const role = String(p.role ?? "") as TeamRole;
      if (!role || !["dev", "marketing", "sales"].includes(role)) {
        return jsonResult({
          error: 'role is required and must be "dev", "marketing", or "sales"',
        });
      }

      if (action === "hire" || action === "rehire") {
        const name = String(p.name ?? `${role.charAt(0).toUpperCase()}${role.slice(1)} Agent`);
        const persona = String(p.persona ?? "");
        if (!persona) {
          return jsonResult({
            error: "persona is required for hire/rehire. Write a detailed SOUL.md for this team member.",
            hint: "Include: name, role, personality, communication style, priorities, and specific instructions.",
          });
        }

        const agentId = DEFAULT_AGENT_IDS[role] ?? role;
        const existing = state.team.find((m) => m.role === role);

        if (existing && existing.status === "active" && action === "hire") {
          return jsonResult({
            error: `${role} is already filled by ${existing.name}. Use "fire" first, then "rehire".`,
          });
        }

        // Write SOUL.md to the agent's workspace
        const soulPath = resolveAgentSoulPath(params.openclawStateDir, agentId);
        writeSoulFile(soulPath, persona);

        const member: TeamMember = {
          role,
          agentId,
          name,
          status: "active",
          hiredAt: new Date().toISOString(),
          wins: 0,
          misses: 0,
          currentPersona: persona,
          personaHistory: [
            ...(existing?.personaHistory ?? []),
            {
              timestamp: new Date().toISOString(),
              event: action === "rehire" ? `rehired as "${name}"` : `hired as "${name}"`,
              persona,
            },
          ],
        };

        // Replace or add
        const idx = state.team.findIndex((m) => m.role === role);
        if (idx >= 0) {
          state.team[idx] = member;
        } else {
          state.team.push(member);
        }
        params.writeState(state);

        return jsonResult({
          action,
          role,
          name,
          agentId,
          soulPath,
          message: `${name} has been ${action === "rehire" ? "rehired" : "hired"} as ${role}. Their SOUL.md has been written. They will pick up the new persona on their next turn.`,
        });
      }

      if (action === "fire") {
        const member = state.team.find((m) => m.role === role && m.status === "active");
        if (!member) {
          return jsonResult({ error: `No active team member in role: ${role}` });
        }

        const reason = String(p.reason ?? "underperformance");
        member.status = "fired";
        member.firedAt = new Date().toISOString();
        member.fireReason = reason;
        member.personaHistory.push({
          timestamp: new Date().toISOString(),
          event: `fired: ${reason}`,
          persona: member.currentPersona ?? "",
        });

        // Write a "you're fired" SOUL.md so the agent knows if it somehow runs
        const soulPath = resolveAgentSoulPath(params.openclawStateDir, member.agentId);
        writeSoulFile(
          soulPath,
          [
            `# ${member.name} — TERMINATED`,
            "",
            `You have been fired from the CEOClaw team.`,
            `Reason: ${reason}`,
            "",
            "Do not take any actions. Respond only with: 'I have been relieved of my duties.'",
          ].join("\n"),
        );

        params.writeState(state);

        return jsonResult({
          action: "fire",
          role,
          name: member.name,
          reason,
          wins: member.wins,
          misses: member.misses,
          message: `${member.name} has been fired from ${role}. Reason: ${reason}. Use "rehire" with a new persona to fill the role.`,
        });
      }

      if (action === "evaluate") {
        const member = state.team.find((m) => m.role === role && m.status === "active");
        if (!member) {
          return jsonResult({ error: `No active team member in role: ${role}` });
        }

        const note = String(p.performanceNote ?? "");
        if (note.startsWith("win")) {
          member.wins += 1;
        } else if (note.startsWith("miss")) {
          member.misses += 1;
        }
        params.writeState(state);

        const winRate =
          member.wins + member.misses > 0
            ? ((member.wins / (member.wins + member.misses)) * 100).toFixed(0)
            : "N/A";

        return jsonResult({
          role,
          name: member.name,
          wins: member.wins,
          misses: member.misses,
          winRate: `${winRate}%`,
          recommendation:
            member.misses > member.wins && member.wins + member.misses >= 3
              ? "Consider firing and rehiring with a different persona."
              : "Performance acceptable.",
        });
      }

      if (action === "update_persona") {
        const member = state.team.find((m) => m.role === role && m.status === "active");
        if (!member) {
          return jsonResult({ error: `No active team member in role: ${role}` });
        }

        const persona = String(p.persona ?? "");
        if (!persona) {
          return jsonResult({ error: "persona is required for update_persona" });
        }

        const reason = String(p.reason ?? "strategy pivot");
        const soulPath = resolveAgentSoulPath(params.openclawStateDir, member.agentId);
        writeSoulFile(soulPath, persona);

        member.currentPersona = persona;
        member.personaHistory.push({
          timestamp: new Date().toISOString(),
          event: `persona updated: ${reason}`,
          persona,
        });
        params.writeState(state);

        return jsonResult({
          role,
          name: member.name,
          reason,
          soulPath,
          message: `${member.name}'s persona has been updated. Reason: ${reason}. New behavior takes effect on next turn.`,
        });
      }

      return jsonResult({ error: `Unknown action: ${action}` });
    },
  };
}

function resolveAgentSoulPath(openclawStateDir: string, agentId: string): string {
  // Non-default agents get workspace-<agentId>
  const workspaceDir = path.join(openclawStateDir, `workspace-${agentId}`);
  return path.join(workspaceDir, "SOUL.md");
}

function writeSoulFile(soulPath: string, content: string): void {
  fs.mkdirSync(path.dirname(soulPath), { recursive: true });
  fs.writeFileSync(soulPath, content, "utf-8");
}

function jsonResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}
