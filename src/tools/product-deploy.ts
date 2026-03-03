import { Type } from "@sinclair/typebox";
import type { CEOClawState } from "../state/business-state.js";

export const ProductDeploySchema = Type.Object({
  action: Type.String({
    description:
      'One of: "scaffold", "add_stripe", "deploy", "status". ' +
      '"scaffold" creates a Next.js project. ' +
      '"add_stripe" injects Stripe Checkout into the project. ' +
      '"deploy" deploys to Vercel. ' +
      '"status" checks current deployment.',
  }),
  projectName: Type.Optional(
    Type.String({ description: "Project name (for scaffold)" }),
  ),
  productTitle: Type.Optional(
    Type.String({ description: "Product title for the landing page" }),
  ),
  productDescription: Type.Optional(
    Type.String({ description: "One-line product description" }),
  ),
  productTagline: Type.Optional(
    Type.String({ description: "Hero tagline for the landing page" }),
  ),
  priceDisplay: Type.Optional(
    Type.String({ description: 'Price display string, e.g. "$4.99"' }),
  ),
  stripePublishableKey: Type.Optional(
    Type.String({ description: "Stripe publishable key to embed in frontend" }),
  ),
  paymentLink: Type.Optional(
    Type.String({ description: "Stripe payment link URL to embed" }),
  ),
  projectDir: Type.Optional(
    Type.String({ description: "Absolute path to project directory (for deploy/add_stripe/status)" }),
  ),
});

export function createProductDeployTool(params: {
  projectsDir: string;
  vercelToken?: string;
  stripePublishableKey?: string;
  stateDir: string;
  readState: () => CEOClawState;
  writeState: (s: CEOClawState) => void;
}) {
  return {
    name: "product_deploy",
    label: "Product Deploy",
    description: [
      "Scaffold, build, and deploy web products.",
      '"scaffold": creates a Next.js project directory with a landing page template.',
      '"add_stripe": injects a Stripe Checkout payment button into the project.',
      '"deploy": deploys the project to Vercel using the Vercel CLI.',
      '"status": checks deployment status.',
      "The agent should use its coding tools (read/write/edit) to customize the generated code,",
      "then use this tool to deploy. This tool handles the infrastructure, not the content.",
    ].join(" "),
    parameters: ProductDeploySchema,
    execute: async (_toolCallId: string, p: Record<string, unknown>) => {
      const action = String(p.action ?? "status");

      if (action === "scaffold") {
        const name = sanitizeName(String(p.projectName ?? "ceoclaw-product"));
        const dir = `${params.projectsDir}/${name}`;
        const title = String(p.productTitle ?? "Amazing Product");
        const description = String(p.productDescription ?? "The best product ever built by AI.");
        const tagline = String(p.productTagline ?? "Built by AI. Loved by humans.");
        const price = String(p.priceDisplay ?? "$4.99");

        const instructions = {
          tool: "exec",
          steps: [
            {
              description: "Create project directory and initialize",
              command: `mkdir -p "${dir}" && cd "${dir}" && npm init -y`,
            },
            {
              description: "Install Next.js and React",
              command: `cd "${dir}" && npm install next react react-dom`,
            },
            {
              description: "Create directory structure",
              command: `cd "${dir}" && mkdir -p app public`,
            },
          ],
          then: {
            description: "Create the landing page",
            createFiles: {
              [`${dir}/app/layout.tsx`]: generateLayout(title, description),
              [`${dir}/app/page.tsx`]: generateLandingPage(title, tagline, description, price),
              [`${dir}/app/globals.css`]: generateGlobalCSS(),
              [`${dir}/next.config.js`]: "/** @type {import('next').NextConfig} */\nconst nextConfig = {};\nmodule.exports = nextConfig;\n",
            },
          },
          projectDir: dir,
          message: [
            `Scaffold instructions generated for "${title}".`,
            `Project directory: ${dir}`,
            "",
            "Execute the commands above using the exec tool, then use your write tool to create the files.",
            "After that, customize the landing page content, then call product_deploy with action='deploy'.",
          ].join("\n"),
        };

        const state = params.readState();
        state.product = {
          name: title,
          description,
        };
        state.stage = "build";
        params.writeState(state);

        return jsonResult(instructions);
      }

      if (action === "add_stripe") {
        const dir = String(p.projectDir ?? "");
        const paymentLink = String(p.paymentLink ?? "");
        const pubKey = String(
          p.stripePublishableKey ?? params.stripePublishableKey ?? "",
        );

        if (!paymentLink && !pubKey) {
          return jsonResult({
            error: "Either paymentLink or stripePublishableKey is required.",
            hint: "First use stripe_revenue to create a product and payment link, then pass the paymentLink here.",
          });
        }

        const instructions = {
          message: [
            "To add Stripe to your landing page:",
            "",
            paymentLink
              ? `1. Add a "Buy Now" button that links to: ${paymentLink}`
              : "1. Install stripe: npm install @stripe/stripe-js stripe",
            paymentLink
              ? "2. Style it prominently — this is the CTA."
              : `2. Create a checkout API route at app/api/checkout/route.ts`,
            "3. Add a success page at app/success/page.tsx",
            "",
            paymentLink
              ? "The simplest approach: make the CTA button an <a> tag pointing to the Stripe payment link."
              : "Use Stripe Checkout Sessions for a hosted payment page.",
          ].join("\n"),
          paymentLink,
          publishableKey: pubKey,
          projectDir: dir,
        };

        return jsonResult(instructions);
      }

      if (action === "deploy") {
        const dir = String(p.projectDir ?? "");
        if (!dir) {
          return jsonResult({ error: "projectDir is required for deploy" });
        }

        const tokenFlag = params.vercelToken
          ? ` --token ${params.vercelToken}`
          : "";

        const instructions = {
          tool: "exec",
          steps: [
            {
              description: "Build the project",
              command: `cd "${dir}" && npx next build`,
            },
            {
              description: "Deploy to Vercel (production)",
              command: `cd "${dir}" && npx vercel --prod --yes${tokenFlag}`,
            },
          ],
          message: [
            "Run these commands with the exec tool to deploy.",
            "After deployment, save the production URL and update state.",
            "The Vercel CLI will output the live URL.",
          ].join("\n"),
        };

        return jsonResult(instructions);
      }

      // status
      const state = params.readState();
      return jsonResult({
        stage: state.stage,
        product: state.product ?? null,
        projectsDir: params.projectsDir,
      });
    },
  };
}

function sanitizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function generateLayout(title: string, description: string): string {
  return `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: ${JSON.stringify(title)},
  description: ${JSON.stringify(description)},
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`;
}

function generateLandingPage(
  title: string,
  tagline: string,
  description: string,
  price: string,
): string {
  return `export default function Home() {
  return (
    <main className="hero">
      <div className="container">
        <h1>${escapeJsx(title)}</h1>
        <p className="tagline">${escapeJsx(tagline)}</p>
        <p className="description">${escapeJsx(description)}</p>
        <div className="cta-section">
          <a href="#" className="cta-button">
            Get it now — ${escapeJsx(price)}
          </a>
        </div>
        <div className="features">
          <div className="feature">
            <h3>Fast</h3>
            <p>Built for speed and simplicity.</p>
          </div>
          <div className="feature">
            <h3>Reliable</h3>
            <p>Works every time, no exceptions.</p>
          </div>
          <div className="feature">
            <h3>Affordable</h3>
            <p>One-time payment. No subscriptions.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
`;
}

function generateGlobalCSS(): string {
  return `* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: #0a0a0a;
  color: #fafafa;
  min-height: 100vh;
}

.hero {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 2rem;
}

.container { max-width: 800px; }

h1 {
  font-size: 3.5rem;
  font-weight: 800;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 1rem;
}

.tagline {
  font-size: 1.5rem;
  color: #a0a0a0;
  margin-bottom: 1.5rem;
}

.description {
  font-size: 1.1rem;
  color: #888;
  margin-bottom: 2.5rem;
  line-height: 1.6;
}

.cta-section { margin-bottom: 4rem; }

.cta-button {
  display: inline-block;
  padding: 1rem 2.5rem;
  font-size: 1.2rem;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  text-decoration: none;
  transition: transform 0.2s, box-shadow 0.2s;
}

.cta-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(102, 126, 234, 0.4);
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 2rem;
  text-align: left;
}

.feature {
  padding: 1.5rem;
  background: #111;
  border-radius: 12px;
  border: 1px solid #222;
}

.feature h3 {
  font-size: 1.2rem;
  margin-bottom: 0.5rem;
  color: #667eea;
}

.feature p { color: #888; line-height: 1.5; }
`;
}

function escapeJsx(s: string): string {
  return s.replace(/[{}<>&"]/g, (c) => {
    const map: Record<string, string> = {
      "{": "&#123;",
      "}": "&#125;",
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      '"': "&quot;",
    };
    return map[c] ?? c;
  });
}

function jsonResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}
