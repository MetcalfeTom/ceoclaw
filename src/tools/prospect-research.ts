import { Type } from "@sinclair/typebox";
import type { CEOClawState } from "../state/business-state.js";

export const ProspectResearchSchema = Type.Object({
  action: Type.String({
    description:
      '"find_communities" — search for places to launch/promote the product. ' +
      '"draft_launch_post" — generate a launch post for a specific platform. ' +
      '"log_submission" — record that we posted somewhere.',
  }),
  productName: Type.Optional(Type.String({ description: "Product name" })),
  productDescription: Type.Optional(Type.String({ description: "What the product does" })),
  targetAudience: Type.Optional(Type.String({ description: "Who this is for" })),
  platform: Type.Optional(
    Type.String({ description: 'Platform name for draft_launch_post/log_submission, e.g. "reddit", "hackernews", "producthunt"' }),
  ),
  subreddit: Type.Optional(Type.String({ description: "Specific subreddit for reddit posts" })),
  url: Type.Optional(Type.String({ description: "URL of the submission (for log_submission)" })),
  tone: Type.Optional(
    Type.String({ description: 'Tone for the post: "casual", "professional", "excited" (default: casual)' }),
  ),
});

export function createProspectResearchTool(params: {
  stateDir: string;
  readState: () => CEOClawState;
  writeState: (s: CEOClawState) => void;
}) {
  return {
    name: "prospect_research",
    label: "Prospect Research",
    description: [
      "Research launch venues and draft promotional content.",
      '"find_communities": suggests platforms, subreddits, forums, and directories to post on.',
      '"draft_launch_post": generates a post tailored to a specific platform.',
      '"log_submission": records a submission to avoid double-posting.',
      "After using this tool, use the browser tool or exec tool to actually post.",
    ].join(" "),
    parameters: ProspectResearchSchema,
    execute: async (_toolCallId: string, p: Record<string, unknown>) => {
      const action = String(p.action ?? "find_communities");
      const state = params.readState();
      const product = state.product;

      if (action === "find_communities") {
        const name = String(p.productName ?? product?.name ?? "the product");
        const desc = String(p.productDescription ?? product?.description ?? "");
        const audience = String(p.targetAudience ?? "developers and indie hackers");
        const alreadyPosted = new Set(state.submissions.map((s) => s.platform));

        const communities = [
          { platform: "reddit", venue: "r/SideProject", why: "Active community for launching side projects", effort: "low" },
          { platform: "reddit", venue: "r/indiehackers", why: "Indie makers sharing launches", effort: "low" },
          { platform: "reddit", venue: "r/InternetIsBeautiful", why: "Cool web tools get traction here", effort: "medium" },
          { platform: "hackernews", venue: "Show HN", why: "High-quality tech audience, can drive significant traffic", effort: "medium" },
          { platform: "producthunt", venue: "Product Hunt", why: "Purpose-built launch platform with voting", effort: "high" },
          { platform: "twitter", venue: "Twitter/X", why: "Build in public audience, hashtags like #buildinpublic", effort: "low" },
          { platform: "indiehackers", venue: "Indie Hackers", why: "Community of bootstrapped founders", effort: "medium" },
          { platform: "betalist", venue: "BetaList", why: "Directory of new startups/products", effort: "low" },
          { platform: "devto", venue: "Dev.to", why: "Developer blog platform, good for technical write-ups", effort: "medium" },
          { platform: "linkedin", venue: "LinkedIn", why: "Professional network, good for B2B tools", effort: "low" },
        ];

        const suggestions = communities.map((c) => ({
          ...c,
          alreadyPosted: alreadyPosted.has(c.platform),
        }));

        return jsonResult({
          product: name,
          description: desc,
          targetAudience: audience,
          suggestions,
          alreadyPostedOn: [...alreadyPosted],
          tip: "Start with low-effort, high-traffic venues. Use web_search to find niche-specific communities too.",
        });
      }

      if (action === "draft_launch_post") {
        const platform = String(p.platform ?? "reddit");
        const name = String(p.productName ?? product?.name ?? "Product");
        const desc = String(p.productDescription ?? product?.description ?? "");
        const url = product?.url ?? product?.stripePaymentLink ?? "[YOUR_URL]";
        const tone = String(p.tone ?? "casual");

        const templates: Record<string, { title: string; body: string }> = {
          reddit: {
            title: `I built ${name} — ${desc}`,
            body: [
              `Hey everyone! I just launched **${name}**.`,
              "",
              desc,
              "",
              `Check it out: ${url}`,
              "",
              "Would love to hear your feedback!",
            ].join("\n"),
          },
          hackernews: {
            title: `Show HN: ${name} — ${desc}`,
            body: [
              desc,
              "",
              `Link: ${url}`,
              "",
              "Built this to solve [problem]. Curious what the HN community thinks.",
            ].join("\n"),
          },
          twitter: {
            title: "",
            body: [
              `Just launched ${name}! 🚀`,
              "",
              desc,
              "",
              `Try it out: ${url}`,
              "",
              "#buildinpublic #launch #indiehacker",
            ].join("\n"),
          },
          producthunt: {
            title: name,
            body: [
              `**${name}** — ${desc}`,
              "",
              "### The Problem",
              "[Describe the problem this solves]",
              "",
              "### The Solution",
              desc,
              "",
              `Try it: ${url}`,
            ].join("\n"),
          },
        };

        const template = templates[platform] ?? templates.reddit;

        return jsonResult({
          platform,
          tone,
          draft: template,
          instructions: [
            `This is a draft ${platform} post. Customize it with specifics about the product.`,
            "Use the browser tool to navigate to the platform and post it.",
            "After posting, call prospect_research with action='log_submission' to record it.",
          ].join(" "),
        });
      }

      if (action === "log_submission") {
        const platform = String(p.platform ?? "unknown");
        const url = p.url ? String(p.url) : undefined;

        state.submissions.push({
          platform,
          url,
          postedAt: new Date().toISOString(),
        });
        params.writeState(state);

        return jsonResult({
          logged: true,
          platform,
          url,
          totalSubmissions: state.submissions.length,
        });
      }

      return jsonResult({ error: `Unknown action: ${action}` });
    },
  };
}

function jsonResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}
