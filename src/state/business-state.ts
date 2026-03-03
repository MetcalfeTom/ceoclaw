import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export type BusinessStage = "ideation" | "build" | "launch" | "growth";

export type ProductInfo = {
  name: string;
  description: string;
  url?: string;
  repoUrl?: string;
  stripeProductId?: string;
  stripePriceId?: string;
  stripePaymentLink?: string;
};

export type MetricsSnapshot = {
  traffic: number;
  signups: number;
  mrr: number;
  totalRevenue: number;
  totalCharges: number;
  lastUpdated: string;
};

export type ActionLogEntry = {
  timestamp: string;
  action: string;
  result: string;
  stage: BusinessStage;
};

export type Experiment = {
  id: string;
  type: string;
  description: string;
  status: "active" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  results?: string;
};

export type TeamRole = "ceo" | "dev" | "marketing" | "sales";

export type TeamMember = {
  role: TeamRole;
  agentId: string;
  name: string;
  status: "active" | "fired";
  hiredAt: string;
  firedAt?: string;
  fireReason?: string;
  /** Number of successful task completions */
  wins: number;
  /** Number of failed or poor-quality tasks */
  misses: number;
  /** Custom persona override (written to SOUL.md) */
  currentPersona?: string;
  /** History of persona changes (hire/fire/rehire) */
  personaHistory: Array<{ timestamp: string; event: string; persona: string }>;
};

export type CEOClawState = {
  stage: BusinessStage;
  startedAt: string;
  product?: ProductInfo;
  ideas: Array<{ name: string; description: string; score: number; validated: boolean }>;
  metrics: MetricsSnapshot;
  experiments: Experiment[];
  submissions: Array<{ platform: string; url?: string; postedAt: string }>;
  actionLog: ActionLogEntry[];
  team: TeamMember[];
  /** Telegram group chat ID where the team communicates */
  telegramGroupId?: string;
};

function defaultState(): CEOClawState {
  return {
    stage: "ideation",
    startedAt: new Date().toISOString(),
    ideas: [],
    metrics: {
      traffic: 0,
      signups: 0,
      mrr: 0,
      totalRevenue: 0,
      totalCharges: 0,
      lastUpdated: new Date().toISOString(),
    },
    experiments: [],
    submissions: [],
    actionLog: [],
    team: [],
  };
}

export function resolveStateDir(customDir?: string): string {
  if (customDir) return customDir;
  return path.join(os.homedir(), ".openclaw", "ceoclaw");
}

export function resolveStatePath(stateDir: string): string {
  return path.join(stateDir, "state.json");
}

export function readState(stateDir: string): CEOClawState {
  const filePath = resolveStatePath(stateDir);
  if (!fs.existsSync(filePath)) {
    return defaultState();
  }
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as CEOClawState;
  } catch {
    return defaultState();
  }
}

export function writeState(stateDir: string, state: CEOClawState): void {
  const filePath = resolveStatePath(stateDir);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2), "utf-8");
}

export function appendAction(
  stateDir: string,
  action: string,
  result: string,
): void {
  const state = readState(stateDir);
  state.actionLog.push({
    timestamp: new Date().toISOString(),
    action,
    result,
    stage: state.stage,
  });
  // Keep last 200 entries
  if (state.actionLog.length > 200) {
    state.actionLog = state.actionLog.slice(-200);
  }
  writeState(stateDir, state);
}
