# CEOClaw — Agent Guidelines

- Repo: https://github.com/MetcalfeTom/ceoclaw
- This is an OpenClaw plugin extension, not a standalone app. It requires a running OpenClaw gateway.
- The Telegram team operates as **Shell Corp** — 4 bots in a group called "Shell Corp HQ".

## Project Structure

```
ceoclaw/
├── index.ts                     # Plugin entry: registers 5 tools, 1 hook, 1 HTTP route, 1 CLI group
├── openclaw.plugin.json         # Plugin manifest with config schema
├── package.json                 # Standalone package, openclaw as peerDependency
├── tsconfig.json
├── src/
│   ├── tools/
│   │   ├── stripe-revenue.ts    # Direct Stripe API (balance, charges, products, prices, payment links)
│   │   ├── product-deploy.ts    # Scaffold Next.js + Stripe Checkout, deploy to Vercel
│   │   ├── business-metrics.ts  # Aggregate Stripe revenue + site uptime + action history
│   │   ├── prospect-research.ts # Find launch communities, draft posts, log submissions
│   │   └── team-manage.ts       # HIRE/FIRE/EVALUATE agents by writing SOUL.md files
│   ├── state/business-state.ts  # Persistent JSON state at ~/.openclaw/ceoclaw/state.json
│   ├── prompt/
│   │   ├── founder-persona.ts   # CEO system prompt (injected via before_prompt_build hook)
│   │   └── default-souls.ts     # Default SOUL.md templates for CEO, Dev, Marketing, Sales
│   ├── loop/ooda.ts             # OODA loop prompt + cron config for autonomous 30-min cycles
│   ├── dashboard/handler.ts     # Live HTML dashboard at /plugins/ceoclaw
│   └── cli/commands.ts          # CLI: openclaw ceo status/team/report/setup/reset
└── skills/
    ├── SKILL.md                 # Founder playbook the agent reads
    └── playbooks/
        └── idea-to-revenue.md   # Idea → build → deploy → sell pipeline
```

## Key Concepts

- **Plugin SDK**: imports from `openclaw/plugin-sdk` resolve at runtime via jiti alias. The `openclaw` package is a peerDependency.
- **SOUL.md**: each agent has a workspace file (`~/.openclaw/workspace-<agentId>/SOUL.md`) that defines its persona. The CEO can rewrite any team member's SOUL.md via `team_manage` — this is the fire/hire mechanic.
- **State**: persistent business state lives at `~/.openclaw/ceoclaw/state.json`. Tracks startup stage (ideation → build → launch → growth), team roster with W/L records, metrics, submissions, and action log.
- **OODA loop**: the CEO runs Observe → Orient → Decide → Act on a 30-minute cron cycle.
- **Shell Corp**: the Telegram presence. 4 bots (CEO, Dev, Marketing, Sales) in a group called "Shell Corp HQ". Each bot has the 🦞 emoji.
- **node_modules**: ceoclaw resolves dependencies from OpenClaw's `node_modules` via symlink. On the VM: `ln -s ~/openclaw/node_modules ~/ceoclaw/node_modules`.
- **Founder prompt scope**: `before_prompt_build` founder context must only apply to `agentId === "ceo"`. Applying it globally causes Dev/Marketing/Sales to act like the CEO.

## Telegram Config

The Telegram plugin uses `botToken` (not `token`) for account credentials. Group policy must be `"open"` for group messages to work:

```yaml
channels:
  telegram:
    groupPolicy: "open"
    accounts:
      ceo:    { botToken: "..." }
      dev:    { botToken: "..." }
      mkt:    { botToken: "..." }
      sales:  { botToken: "..." }
```

For Telegram Web links like `https://webk.telegram.org/#-5246625820`, chat IDs can be:
- Basic group: `-5246625820`
- Supergroup/channel: `-100...`

Shell Corp currently uses `-5246625820`.

Exec permissions live under `tools`, not `agent`:

```yaml
tools:
  exec:
    security: "full"
    ask: "off"
```

Model selection for all agents can be set globally:

```yaml
agents:
  defaults:
    model:
      primary: "openai-codex/gpt-5.3-codex"
```

OpenAI API key can be set via:

```bash
openclaw config set env.OPENAI_API_KEY "sk-proj-..."
```

## Config Schema

Plugin config keys (set via `openclaw config set plugins.entries.ceoclaw.config.<key>`):
- `stripeSecretKey` — Stripe secret key
- `stripePublishableKey` — Stripe publishable key
- `vercelToken` — Vercel API token for deploying products
- `githubToken` — GitHub PAT for repo creation
- `telegramGroupId` — Telegram group chat ID for the team
- `openclawStateDir` — OpenClaw state dir (default: `~/.openclaw`)
- `projectsDir` — base directory for product projects (default: `~/.openclaw/ceoclaw/projects`)
- `loopIntervalMinutes` — CEO cron interval (default: 30)

## Required External Tokens

To run CEOClaw you need:
1. 4 Telegram bot tokens (CEO, Dev, Marketing, Sales) from @BotFather
2. A Telegram group chat ID with all 4 bots added
3. Stripe keys (secret + publishable, test or live)
4. Vercel token
5. GitHub PAT (repo scope) — also needed to clone if repo is private
6. An AI provider API key (OpenAI / Anthropic) configured in OpenClaw connections

## GCP VM Deployment (vibe project)

The canonical cloud deployment uses a GCP VM in the `vibe-425614` project, instance name `ceoclaw-runner`, zone `us-central1-a`.

```bash
# Create VM
gcloud compute instances create ceoclaw-runner \
  --project=vibe-425614 \
  --zone=us-central1-a \
  --machine-type=e2-standard-4 \
  --image-family=ubuntu-2404-lts-amd64 \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=50GB \
  --boot-disk-type=pd-balanced \
  --tags=http-server,https-server

# SSH in
gcloud compute ssh ceoclaw-runner --zone=us-central1-a --project=vibe-425614
```

Current stability profile for `ceoclaw-runner`:
- `provisioningModel: STANDARD` (not spot/preemptible)
- `preemptible: false`
- `automaticRestart: true`
- `onHostMaintenance: MIGRATE`
- `deletionProtection: true`

On the VM:

```bash
# 1. Install system deps
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git build-essential unzip
sudo npm install -g pnpm@latest
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# 2. Clone and build OpenClaw
cd ~
git clone https://github.com/openclaw/openclaw.git
cd openclaw
export PATH="$HOME/.bun/bin:$PATH"
pnpm install --frozen-lockfile
pnpm build
OPENCLAW_PREFER_PNPM=1 pnpm ui:build
sudo ln -sf $(pwd)/openclaw.mjs /usr/local/bin/openclaw
sudo chmod 755 openclaw.mjs

# 3. Clone and install CEOClaw
cd ~
git clone https://github.com/MetcalfeTom/ceoclaw.git
cd ceoclaw
ln -s ~/openclaw/node_modules node_modules
openclaw plugins install -l .
openclaw plugins enable ceoclaw

# 4. Configure (see README for full config template)
openclaw config set connections.anthropic.apiKey "sk-ant-..."
# ... set all agents, channels, bindings, plugin config ...

# 5. Start gateway
openclaw config set gateway.mode "local"
openclaw config set gateway.bind "lan"
openclaw config set gateway.port 18789
nohup openclaw gateway run --bind lan --port 18789 --force > /tmp/openclaw-gateway.log 2>&1 &
```

For persistent operation, prefer a systemd service over `nohup`:

```bash
sudo systemctl enable openclaw-gateway.service
sudo systemctl restart openclaw-gateway.service
sudo systemctl status openclaw-gateway.service
```

Service file path:
- `/etc/systemd/system/openclaw-gateway.service`

Autonomy cron (active on VM):
- Name: `CEOClaw CEO OODA Loop`
- Interval: every 30 minutes
- Session: `isolated`
- Agent: `ceo`

### Monitoring

```bash
tail -n 100 /tmp/openclaw-gateway.log  # Gateway logs
openclaw ceo status                     # Business status
openclaw ceo team                       # Team roster
openclaw ceo report                     # Full report
# Dashboard: http://EXTERNAL_IP:18789/plugins/ceoclaw
```

### Restart / Stop

```bash
pkill -9 -f openclaw-gateway || true
nohup openclaw gateway run --bind lan --port 18789 --force > /tmp/openclaw-gateway.log 2>&1 &
```

### Cleanup

```bash
gcloud compute instances delete ceoclaw-runner \
  --zone=us-central1-a --project=vibe-425614
```

## Coding Style

- TypeScript (ESM). Plugin imports from `openclaw/plugin-sdk`.
- Keep files concise; no `@ts-nocheck`.
- State mutations go through `business-state.ts` helpers.
- Tools register via the plugin SDK's `definePlugin` pattern in `index.ts`.

## CLI Commands

```bash
openclaw ceo status    # Business status + team roster
openclaw ceo team      # Detailed team info with hire/fire history
openclaw ceo report    # Full mission report
openclaw ceo setup     # Print config template for multi-bot setup
openclaw ceo reset     # Wipe state and start fresh
```
