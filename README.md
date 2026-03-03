# CEOClaw

**An AI startup that runs itself. A CEO agent manages a team of specialist agents via Telegram, building and monetizing products autonomously.**

CEOClaw is an [OpenClaw](https://github.com/openclaw/openclaw) plugin extension that simulates a real startup. Four AI agents -- CEO, Developer, Marketing, and Sales -- each run as separate Telegram bots in a shared group chat. The CEO delegates, evaluates, and fires underperformers, rewriting their personas to hire replacements with different strategies.

## Architecture

```
Telegram Group: "CEOClaw Startup"
├── 🧑‍💼 Alex (CEO Bot)     — runs OODA loop, delegates, hires/fires
├── 👩‍💻 Jordan (Dev Bot)    — builds products, deploys to Vercel
├── 📣 Sam (Marketing Bot)  — posts on communities, drives traffic
└── 💰 Riley (Sales Bot)    — monitors Stripe, optimizes conversions
```

Each agent is a separate OpenClaw agent with:
- Its own Telegram bot token (different visible identity in the group)
- Its own `SOUL.md` workspace file (defines persona and behavior)
- Its own agent config (model, workspace, identity)

The CEO agent can **rewrite any team member's SOUL.md** at runtime, effectively "firing" them and "hiring" a replacement with a completely different persona and strategy. This takes effect on the agent's next turn.

### Plugin Registration

| Registration | What |
|---|---|
| **5 tools** | `stripe_revenue`, `product_deploy`, `business_metrics`, `prospect_research`, `team_manage` |
| **1 hook** | `before_prompt_build` — injects CEO context with team roster, metrics, and state |
| **1 HTTP route** | `/plugins/ceoclaw` — live dashboard with team cards, revenue, fire/hire history |
| **1 CLI group** | `openclaw ceo status`, `team`, `report`, `setup`, `reset` |
| **Skills** | Founder playbook + idea-to-revenue pipeline |

### The Fire/Hire Mechanic

The `team_manage` tool gives the CEO these actions:

| Action | What it does |
|---|---|
| `hire` | Creates a team member: writes a `SOUL.md` to their agent workspace |
| `fire` | Marks them as fired, writes a "terminated" SOUL.md, records the reason |
| `rehire` | Fills a fired role with a new persona (completely different SOUL.md) |
| `evaluate` | Records a win or miss, tracks performance stats |
| `update_persona` | Rewrites SOUL.md mid-run to adjust behavior without firing |
| `list` | Shows the team roster with W/L records |

When the CEO fires Marketing for posting bland content and rehires with a persona that's "aggressive, meme-literate, and focuses on viral Reddit posts" — that's a real change. The new SOUL.md takes effect on the Marketing agent's next turn.

## Setup

### Prerequisites

- [OpenClaw](https://github.com/openclaw/openclaw) installed and running
- 4 Telegram bot tokens (create via [@BotFather](https://t.me/BotFather))
- A Telegram group with all 4 bots added
- Stripe account (test or live keys)
- Vercel account with CLI authenticated

### 1. Create 4 Telegram Bots

Via @BotFather, create:
- `@yourproject_ceo_bot` — the CEO
- `@yourproject_dev_bot` — the Developer
- `@yourproject_mkt_bot` — Marketing
- `@yourproject_sales_bot` — Sales

Give each one a fitting name and profile picture.

### 2. Create a Telegram Group

Create a group, add all 4 bots, and note the **group chat ID**. You can find it by messaging the group and checking gateway logs, or by using @userinfobot.

### 3. Install CEOClaw

```bash
git clone https://github.com/yourusername/ceoclaw.git
cd ceoclaw
openclaw plugins install -l .
openclaw plugins enable ceoclaw
```

### 4. Configure OpenClaw

Run `openclaw ceo setup` to see the full config template, or add manually:

```yaml
# agents.list — one agent per role
agents:
  list:
    - id: ceo
      name: "Alex (CEO)"
      default: true
      identity:
        name: "Alex (CEO)"
        emoji: "🧑‍💼"
    - id: dev
      name: "Jordan (Dev)"
      identity:
        name: "Jordan (Dev)"
        emoji: "👩‍💻"
    - id: marketing
      name: "Sam (Marketing)"
      identity:
        name: "Sam (Marketing)"
        emoji: "📣"
    - id: sales
      name: "Riley (Sales)"
      identity:
        name: "Riley (Sales)"
        emoji: "💰"

# Telegram — one bot per agent
channels:
  telegram:
    accounts:
      ceo:    { token: "CEO_BOT_TOKEN" }
      dev:    { token: "DEV_BOT_TOKEN" }
      mkt:    { token: "MKT_BOT_TOKEN" }
      sales:  { token: "SALES_BOT_TOKEN" }

# Route each bot to its agent
bindings:
  - { agentId: ceo,       match: { channel: telegram, accountId: ceo } }
  - { agentId: dev,       match: { channel: telegram, accountId: dev } }
  - { agentId: marketing, match: { channel: telegram, accountId: mkt } }
  - { agentId: sales,     match: { channel: telegram, accountId: sales } }

# Allow agents to message each other
tools:
  agentToAgent: { enabled: true, allow: ["*"] }

# Allow exec, browser, cron for autonomous operation
agent:
  exec:
    security: "full"
    ask: "off"
```

### 5. Configure CEOClaw Plugin

```bash
openclaw config set plugins.entries.ceoclaw.config.stripeSecretKey "sk_live_..."
openclaw config set plugins.entries.ceoclaw.config.stripePublishableKey "pk_live_..."
openclaw config set plugins.entries.ceoclaw.config.vercelToken "your_vercel_token"
openclaw config set plugins.entries.ceoclaw.config.telegramGroupId "-100XXXXXXXXX"
```

### 6. Launch

Message the CEO bot directly or in the group:

> Start the company. Pick a product idea, hire your team, build it, and make money. Set up the OODA cron loop every 30 minutes.

## CLI Commands

```bash
openclaw ceo status    # Business status + team roster
openclaw ceo team      # Detailed team info with hire/fire history
openclaw ceo report    # Full mission report
openclaw ceo setup     # Print config template for multi-bot setup
openclaw ceo reset     # Wipe state and start fresh
```

## Dashboard

Open `http://localhost:PORT/plugins/ceoclaw` for a live dashboard showing:
- Revenue and payment count
- Team cards with W/L records and persona change count
- Fired members (greyed out with reason)
- Product info and live URL
- Full action log
- Marketing submissions

Auto-refreshes every 60 seconds.

## File Structure

```
ceoclaw/
├── index.ts                        # Plugin entry point
├── openclaw.plugin.json            # Plugin manifest + config schema
├── package.json
├── src/
│   ├── tools/
│   │   ├── stripe-revenue.ts       # Stripe API: products, prices, payment links, revenue
│   │   ├── product-deploy.ts       # Next.js scaffold + Vercel deploy orchestration
│   │   ├── business-metrics.ts     # Multi-source KPI aggregation
│   │   ├── prospect-research.ts    # Community finder + post drafter
│   │   └── team-manage.ts         # Hire, fire, evaluate, rewrite SOUL.md
│   ├── state/
│   │   └── business-state.ts       # Persistent state machine + team tracking
│   ├── prompt/
│   │   ├── founder-persona.ts      # CEO system prompt with team context
│   │   └── default-souls.ts        # Default SOUL.md templates per role
│   ├── loop/
│   │   └── ooda.ts                 # CEO OODA loop prompt + cron config
│   ├── dashboard/
│   │   └── handler.ts              # Live HTML dashboard
│   └── cli/
│       └── commands.ts             # CLI commands
└── skills/
    ├── SKILL.md                    # Founder playbook
    └── playbooks/
        └── idea-to-revenue.md      # Idea → build → deploy → sell pipeline
```

## License

MIT
