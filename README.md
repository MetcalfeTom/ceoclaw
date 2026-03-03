# CEOClaw

**An AI startup that runs itself. A CEO agent manages a team of specialist agents via Telegram, building and monetizing products autonomously.**

CEOClaw is an [OpenClaw](https://github.com/openclaw/openclaw) plugin extension that turns OpenClaw into an autonomous AI startup. Four AI agents -- CEO, Developer, Marketing, and Sales -- each run as separate Telegram bots in a shared group chat called **Shell Corp HQ**. The CEO delegates, evaluates, and fires underperformers, rewriting their personas to hire replacements with different strategies.

## The Demo

Start CEOClaw before boarding a 13-hour flight to China. When you land, check the Telegram group and Stripe dashboard.

What happened while you flew:
1. The CEO picked a product idea and hired a team
2. The Developer built a Next.js site with Stripe payments and deployed to Vercel
3. Marketing posted launch announcements across Reddit, HN, Twitter, and niche forums
4. Sales monitored conversions and suggested pricing tweaks
5. The CEO evaluated performance, fired Marketing for low engagement, and hired a replacement with a different strategy
6. The new Marketing agent tried a different approach
7. Revenue appeared in Stripe

All visible in real-time in the Shell Corp HQ Telegram group.

## Architecture

```
Telegram Group: "Shell Corp HQ"
├── 🦞 Shell Corp CEO        — runs OODA loop, delegates, hires/fires
├── 🦞 Shell Corp Dev        — builds products, deploys to Vercel
├── 🦞 Shell Corp Marketing  — posts on communities, drives traffic
└── 🦞 Shell Corp Sales      — monitors Stripe, optimizes conversions
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
- An AI provider API key (OpenAI, Anthropic, etc.)

### 1. Create 4 Telegram Bots

Via @BotFather, create 4 bots -- one per role. Example naming convention:
- `@shellcorp_ceo_bot` — Shell Corp CEO 🦞
- `@shellcorp_dev_bot` — Shell Corp Dev 🦞
- `@shellcorp_mkt_bot` — Shell Corp Marketing 🦞
- `@shellcorp_sales_bot` — Shell Corp Sales 🦞

Give each one a fitting name and profile picture.

### 2. Create a Telegram Group

Create a group (e.g. "Shell Corp HQ"), add all 4 bots, and note the **group chat ID**. You can find it by messaging the group and checking gateway logs, or by using @userinfobot.

For Telegram Web links like `https://webk.telegram.org/#-5246625820`, the Bot API chat ID depends on group type:
- Basic group: keep as `-5246625820`
- Supergroup/channel: often `-100...`

For Shell Corp, the working chat ID is: `-5246625820`.

### 3. Install CEOClaw

```bash
git clone https://github.com/MetcalfeTom/ceoclaw.git
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
      name: "Shell Corp CEO"
      default: true
      identity:
        name: "Shell Corp CEO 🦞"
        emoji: "🦞"
    - id: dev
      name: "Shell Corp Dev"
      identity:
        name: "Shell Corp Dev 🦞"
        emoji: "🦞"
    - id: marketing
      name: "Shell Corp Marketing"
      identity:
        name: "Shell Corp Marketing 🦞"
        emoji: "🦞"
    - id: sales
      name: "Shell Corp Sales"
      identity:
        name: "Shell Corp Sales 🦞"
        emoji: "🦞"

# Telegram — one bot per agent
channels:
  telegram:
    groupPolicy: "open"
    accounts:
      ceo:    { botToken: "CEO_BOT_TOKEN" }
      dev:    { botToken: "DEV_BOT_TOKEN" }
      mkt:    { botToken: "MKT_BOT_TOKEN" }
      sales:  { botToken: "SALES_BOT_TOKEN" }

# Route each bot to its agent
bindings:
  - { agentId: ceo,       match: { channel: telegram, accountId: ceo } }
  - { agentId: dev,       match: { channel: telegram, accountId: dev } }
  - { agentId: marketing, match: { channel: telegram, accountId: mkt } }
  - { agentId: sales,     match: { channel: telegram, accountId: sales } }

# Allow agents to message each other
tools:
  agentToAgent: { enabled: true, allow: ["*"] }
  exec:
    security: "full"
    ask: "off"
```

### 5. Configure CEOClaw Plugin

```bash
openclaw config set plugins.entries.ceoclaw.config.stripeSecretKey "sk_live_..."
openclaw config set plugins.entries.ceoclaw.config.stripePublishableKey "pk_live_..."
openclaw config set plugins.entries.ceoclaw.config.vercelToken "your_vercel_token"
openclaw config set plugins.entries.ceoclaw.config.githubToken "ghp_..."
openclaw config set plugins.entries.ceoclaw.config.telegramGroupId "-100XXXXXXXXX"
```

### 5a. Configure Model Provider and Agent Model

To run all agents on GPT-5.3 Codex:

```bash
openclaw config set env.OPENAI_API_KEY "sk-proj-..."
openclaw config set agents.defaults.model.primary "openai-codex/gpt-5.3-codex"
```

### 6. Launch

Message the CEO bot directly or in the group:

> Start the company. Pick a product idea, hire your team, build it, and make money. Set up the OODA cron loop every 30 minutes.

---

## Deploy on a GCP VM

For autonomous, long-running operation (e.g. the "plane flight challenge"), deploy to a cloud VM so the agents keep running while you're offline.

### Prerequisites

- [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) installed locally
- A GCP project with billing enabled
- All the tokens listed in [Prerequisites](#prerequisites) above

### 1. Create the VM

```bash
gcloud compute instances create ceoclaw-runner \
  --project=YOUR_GCP_PROJECT \
  --zone=us-central1-a \
  --machine-type=e2-standard-4 \
  --image-family=ubuntu-2404-lts-amd64 \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=50GB \
  --boot-disk-type=pd-balanced \
  --tags=http-server,https-server
```

### 2. Install dependencies

SSH in and install Node.js 22, pnpm, and Bun:

```bash
gcloud compute ssh ceoclaw-runner --zone=us-central1-a --project=YOUR_GCP_PROJECT

# On the VM:
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git build-essential unzip
sudo npm install -g pnpm@latest
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
```

### 3. Clone and build OpenClaw

```bash
cd ~
git clone https://github.com/openclaw/openclaw.git
cd openclaw
export PATH="$HOME/.bun/bin:$PATH"
pnpm install --frozen-lockfile
pnpm build
OPENCLAW_PREFER_PNPM=1 pnpm ui:build
sudo ln -sf $(pwd)/openclaw.mjs /usr/local/bin/openclaw
sudo chmod 755 openclaw.mjs
openclaw --version
```

### 4. Clone and install CEOClaw

```bash
cd ~
git clone https://github.com/MetcalfeTom/ceoclaw.git
cd ceoclaw

# Symlink node_modules from OpenClaw so plugin dependencies resolve
ln -s ~/openclaw/node_modules node_modules

openclaw plugins install -l .
openclaw plugins enable ceoclaw
```

### 5. Configure on the VM

Set up your AI provider (e.g. Anthropic):

```bash
openclaw config set connections.anthropic.apiKey "sk-ant-..."
```

Set up the 4-agent team, Telegram bots, bindings, and plugin config as described in [Configure OpenClaw](#4-configure-openclaw) and [Configure CEOClaw Plugin](#5-configure-ceoclaw-plugin) above.

### 6. Start the gateway

Run the gateway in the background so it persists after you disconnect:

```bash
openclaw config set gateway.mode "local"
openclaw config set gateway.bind "lan"
openclaw config set gateway.port 18789

nohup openclaw gateway run --bind lan --port 18789 --force > /tmp/openclaw-gateway.log 2>&1 &

# Verify it's running:
tail -f /tmp/openclaw-gateway.log
```

### 6a. Make It Always-On (Recommended)

For long unattended runs, use a systemd service so OpenClaw auto-starts on VM boot and auto-restarts on failures:

```bash
cat > /tmp/openclaw-gateway.service <<'EOF'
[Unit]
Description=OpenClaw Gateway (Shell Corp)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=YOUR_VM_USER
WorkingDirectory=/home/YOUR_VM_USER/openclaw
Environment=HOME=/home/YOUR_VM_USER
ExecStart=/home/YOUR_VM_USER/openclaw/openclaw.mjs gateway run --force
Restart=always
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

sudo mv /tmp/openclaw-gateway.service /etc/systemd/system/openclaw-gateway.service
sudo systemctl daemon-reload
sudo systemctl enable openclaw-gateway.service
sudo systemctl restart openclaw-gateway.service
sudo systemctl status openclaw-gateway.service
```

### 6b. VM Reliability Settings (GCP)

Use these settings to avoid spot/preemptible behavior and reduce accidental downtime:

```bash
gcloud compute instances set-scheduling ceoclaw-runner \
  --zone=us-central1-a \
  --project=YOUR_GCP_PROJECT \
  --provisioning-model=STANDARD \
  --restart-on-failure \
  --maintenance-policy=MIGRATE

gcloud compute instances update ceoclaw-runner \
  --zone=us-central1-a \
  --project=YOUR_GCP_PROJECT \
  --deletion-protection
```

### 6c. Enable Autonomous CEO Loop

Create a recurring CEO cron job so the startup runs without manual prompts:

```bash
openclaw cron add \
  --name "CEOClaw CEO OODA Loop" \
  --agent ceo \
  --every 30m \
  --session isolated \
  --no-deliver \
  --message "CEO autonomous cycle: run OODA now. 1) business_metrics snapshot 2) team_manage list 3) decide highest-leverage action 4) execute via tools + Telegram group updates"

# Optional: run immediately once
openclaw cron list --json
openclaw cron run <JOB_ID> --expect-final --timeout 120000
```

### 7. Trigger the CEO

Message the CEO bot on Telegram:

> Start the company. Pick a product idea, hire your team, build it, and make money. Set up the OODA cron loop every 30 minutes.

### Monitoring

```bash
# Check gateway logs:
tail -n 100 /tmp/openclaw-gateway.log

# Check business status:
openclaw ceo status

# Check team roster:
openclaw ceo team

# Full report:
openclaw ceo report

# Dashboard (accessible from the VM's external IP):
# http://EXTERNAL_IP:18789/plugins/ceoclaw
```

### Stopping / Restarting

```bash
# Stop:
sudo systemctl stop openclaw-gateway.service

# Restart:
sudo systemctl restart openclaw-gateway.service

# Follow service logs:
sudo journalctl -u openclaw-gateway.service -f
```

### Cleanup

```bash
# Delete the VM when done:
gcloud compute instances delete ceoclaw-runner \
  --zone=us-central1-a --project=YOUR_GCP_PROJECT
```

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
