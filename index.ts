import path from "node:path";
import os from "node:os";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { readState, writeState, resolveStateDir } from "./src/state/business-state.js";
import { createStripeRevenueTool } from "./src/tools/stripe-revenue.js";
import { createProductDeployTool } from "./src/tools/product-deploy.js";
import { createBusinessMetricsTool } from "./src/tools/business-metrics.js";
import { createProspectResearchTool } from "./src/tools/prospect-research.js";
import { createTeamManageTool } from "./src/tools/team-manage.js";
import { buildFounderContext } from "./src/prompt/founder-persona.js";
import { createDashboardHandler } from "./src/dashboard/handler.js";
import { registerCeoCommands } from "./src/cli/commands.js";

const plugin = {
  id: "ceoclaw",
  name: "CEOClaw",
  description: "AI startup with a CEO agent that manages a team of specialist agents via Telegram",

  register(api: OpenClawPluginApi) {
    const pluginConfig = (api.pluginConfig ?? {}) as Record<string, unknown>;
    const stripeSecretKey = String(pluginConfig.stripeSecretKey ?? process.env.STRIPE_SECRET_KEY ?? "");
    const stripePublishableKey = String(pluginConfig.stripePublishableKey ?? process.env.STRIPE_PUBLISHABLE_KEY ?? "");
    const vercelToken = String(pluginConfig.vercelToken ?? process.env.VERCEL_TOKEN ?? "");
    const projectsDir = String(
      pluginConfig.projectsDir ??
        path.join(os.homedir(), ".openclaw", "ceoclaw", "projects"),
    );
    const loopIntervalMinutes = Number(pluginConfig.loopIntervalMinutes ?? 30);
    const openclawStateDir = String(
      pluginConfig.openclawStateDir ??
        path.join(os.homedir(), ".openclaw"),
    );
    const telegramGroupId = String(pluginConfig.telegramGroupId ?? "");

    const stateDir = resolveStateDir();
    const getState = () => readState(stateDir);
    const setState = (s: ReturnType<typeof getState>) => {
      if (telegramGroupId && !s.telegramGroupId) {
        s.telegramGroupId = telegramGroupId;
      }
      writeState(stateDir, s);
    };

    // Initialize telegram group in state if configured
    if (telegramGroupId) {
      const state = getState();
      if (!state.telegramGroupId) {
        state.telegramGroupId = telegramGroupId;
        writeState(stateDir, state);
      }
    }

    // --- Tools ---

    if (stripeSecretKey) {
      api.registerTool(
        createStripeRevenueTool({
          secretKey: stripeSecretKey,
          stateDir,
          readState: getState,
          writeState: setState,
        }) as Parameters<typeof api.registerTool>[0],
        { name: "stripe_revenue", optional: true },
      );
    }

    api.registerTool(
      createProductDeployTool({
        projectsDir,
        vercelToken: vercelToken || undefined,
        stripePublishableKey: stripePublishableKey || undefined,
        stateDir,
        readState: getState,
        writeState: setState,
      }) as Parameters<typeof api.registerTool>[0],
      { name: "product_deploy", optional: true },
    );

    api.registerTool(
      createBusinessMetricsTool({
        stripeSecretKey: stripeSecretKey || undefined,
        vercelToken: vercelToken || undefined,
        stateDir,
        readState: getState,
        writeState: setState,
      }) as Parameters<typeof api.registerTool>[0],
      { name: "business_metrics", optional: true },
    );

    api.registerTool(
      createProspectResearchTool({
        stateDir,
        readState: getState,
        writeState: setState,
      }) as Parameters<typeof api.registerTool>[0],
      { name: "prospect_research", optional: true },
    );

    api.registerTool(
      createTeamManageTool({
        stateDir,
        readState: getState,
        writeState: setState,
        openclawStateDir,
      }) as Parameters<typeof api.registerTool>[0],
      { name: "team_manage", optional: true },
    );

    // --- System Prompt: CEO Persona ---

    api.on("before_prompt_build", () => {
      const state = getState();
      return { prependContext: buildFounderContext(state) };
    });

    // --- HTTP Dashboard ---

    api.registerHttpRoute({
      path: "/plugins/ceoclaw",
      auth: "gateway",
      match: "prefix",
      handler: createDashboardHandler({ readState: getState }),
    });

    // --- CLI Commands ---

    api.registerCli(
      ({ program }) => {
        registerCeoCommands({ program, stateDir, openclawStateDir });
      },
      { commands: ["ceo"] },
    );

    api.logger.info(
      `[ceoclaw] registered (stripe=${stripeSecretKey ? "yes" : "no"}, vercel=${vercelToken ? "yes" : "no"}, team-chat=${telegramGroupId || "not set"}, loop=${loopIntervalMinutes}min)`,
    );
  },
};

export default plugin;
