# Beacon

**Self-hosted Discord analytics and social feed notifications.**

Beacon gives your Discord community full insight into its own growth — member trends, message activity, voice usage — and automatically notifies channels when your favourite creators post new content. All in a clean web dashboard, with your data stored on your own server.

> **Free forever. No paywalls. One `docker compose up`.**

---

## Why Beacon?

Most Discord analytics and social feed features are locked behind $10–$30/month paywalls (MEE6, Carl-bot, Statbot). Beacon is an open-source, self-hosted alternative that gives you everything for free:

| Feature | Statbot / MEE6 | Beacon |
|---------|---------------|--------|
| Member growth charts | $29+/month | ✅ Free |
| Message volume by channel | $29+/month | ✅ Free |
| Voice activity tracking | $29+/month | ✅ Free |
| Historical data (unlimited) | Premium only | ✅ Unlimited |
| YouTube new video alerts | $11.95+/month | ✅ Free |
| Twitch live alerts | $11.95+/month | ✅ Free |
| Reddit new post alerts | $11.95+/month | ✅ Free |
| RSS/Atom feed alerts | Premium only | ✅ Free |
| Data ownership | Their servers | ✅ Your server |

---

## Features

### Analytics Dashboard
- **Member Growth** — line chart of member count over time, with daily join/leave breakdown
- **Message Volume** — stacked bar chart showing activity per channel per day
- **Voice Activity** — bar chart of total voice minutes per day
- **Summary Stats** — quick-glance totals for joins, leaves, and messages over your chosen time range
- **Range Picker** — 7 days, 30 days, or 90 days

### Social Feed Notifications
| Feed Type | Source | Notes |
|-----------|--------|-------|
| YouTube | Channel ID (e.g. `UCxxxxxx`) | Uses public RSS — no API key required |
| Twitch | Username (e.g. `shroud`) | Live stream alerts via Twitch Helix API |
| Reddit | Subreddit name (e.g. `programming`) | New posts via public Reddit API |
| RSS/Atom | Any feed URL | Generic support for any RSS or Atom feed |

Rich Discord embeds with correct branding colours for each platform.

### Slash Commands
| Command | Description |
|---------|-------------|
| `/stats` | Embed showing current member count, messages today, active voice users |
| `/feeds list` | Lists all active feed subscriptions in this server |
| `/feeds add` | Add a new social feed subscription |
| `/feeds remove` | Remove a feed subscription |

---

## Quick Start

### Prerequisites
- Docker & Docker Compose v2
- A Discord application ([create one](https://discord.com/developers/applications))
- Twitch API credentials *(optional — only needed for Twitch alerts)*

### 1. Clone and configure

```bash
git clone https://github.com/dylan-xogent/beacon.git
cd beacon
cp .env.example .env
```

Open `.env` and fill in your values:

| Variable | Where to get it |
|----------|----------------|
| `DISCORD_TOKEN` | Discord Developer Portal → Your App → Bot → Token |
| `DISCORD_CLIENT_ID` | Discord Developer Portal → Your App → General Information → Application ID |
| `DISCORD_CLIENT_SECRET` | Discord Developer Portal → Your App → OAuth2 → Client Secret |
| `NEXTAUTH_SECRET` | Run `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Public URL of your dashboard (e.g. `https://beacon.yourdomain.com`) |
| `TWITCH_CLIENT_ID` | [Twitch Dev Console](https://dev.twitch.tv/console) *(optional)* |
| `TWITCH_CLIENT_SECRET` | [Twitch Dev Console](https://dev.twitch.tv/console) *(optional)* |

### 2. Set up your Discord app

In the [Discord Developer Portal](https://discord.com/developers/applications):

1. Under **OAuth2 → Redirects**, add `<NEXTAUTH_URL>/api/auth/callback/discord`
2. Invite the bot to your server:
   ```
   https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot+applications.commands
   ```

### 3. Deploy

```bash
docker compose up -d
```

That's it. The web dashboard will be live at port `3000`. The bot automatically runs database migrations on first start.

---

## Development

### Requirements
- Node.js 20+
- pnpm 9+
- Docker (for local Postgres + Redis)

### Setup

```bash
# Install dependencies
pnpm install

# Start local infrastructure (Postgres + Redis only)
docker compose -f docker-compose.dev.yml up -d

# Copy and configure environment
cp .env.example .env

# Run database migrations and generate Prisma client
pnpm db:migrate
pnpm db:generate

# Register slash commands with Discord (run once)
pnpm --filter @beacon/bot deploy-commands

# Start the bot (terminal 1)
pnpm dev:bot

# Start the web dashboard (terminal 2)
pnpm dev:web
```

Dashboard: `http://localhost:3000`

### Project Structure

```
beacon/
├── apps/
│   ├── bot/                        # Discord bot
│   │   └── src/
│   │       ├── commands/           # /stats, /feeds slash commands
│   │       ├── events/             # Discord event handlers
│   │       ├── lib/
│   │       │   └── feedProviders/  # YouTube, Twitch, Reddit, RSS
│   │       └── workers/            # BullMQ feed poller + snapshot worker
│   └── web/                        # Next.js 14 dashboard
│       └── src/
│           ├── app/
│           │   ├── api/            # REST API routes
│           │   └── dashboard/      # Dashboard pages
│           ├── components/
│           │   ├── charts/         # Recharts components
│           │   └── ui/             # Button, Card, Input, Select, Badge
│           └── lib/                # Auth, Discord API helpers
└── packages/
    └── db/                         # Prisma schema + shared client
        └── prisma/
            └── schema.prisma
```

### Useful Commands

```bash
pnpm dev:bot          # Start bot in watch mode
pnpm dev:web          # Start Next.js dev server
pnpm build            # Build all packages
pnpm db:migrate       # Run Prisma migrations
pnpm db:studio        # Open Prisma Studio (DB browser)
pnpm typecheck        # TypeScript type checking across all packages
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Bot | TypeScript · discord.js v14 · BullMQ |
| Web | Next.js 14 (App Router) · Tailwind CSS · NextAuth.js v5 |
| Charts | Recharts |
| Database | PostgreSQL · Prisma ORM |
| Queue | Redis · BullMQ |
| Deploy | Docker Compose |

---

## How It Works

### Analytics Collection
The bot listens to Discord gateway events (`guildMemberAdd`, `guildMemberRemove`, `messageCreate`, `voiceStateUpdate`) and writes a lightweight event record to PostgreSQL for each one. A BullMQ worker runs hourly to snapshot the current member count. The web dashboard queries these records and aggregates them by day for display.

### Social Feed Polling
Each active feed subscription is enqueued as a BullMQ job every 5 minutes. The appropriate provider fetches the latest content:
- **YouTube** — parses the channel's public RSS feed (no API key needed)
- **Twitch** — calls the Helix `/streams` endpoint with a cached client-credentials token
- **Reddit** — fetches `/r/{subreddit}/new.json` from the public Reddit API
- **RSS** — parses any Atom/RSS feed using `rss-parser`

If new content is found (compared against `lastItemId`), a rich embed is posted to the configured Discord channel via webhook. Jobs retry up to 3 times with exponential backoff on failure.

### Authentication
The web dashboard uses Discord OAuth2 via NextAuth.js. Every API route verifies the logged-in user has `MANAGE_GUILD` permission in the requested server before returning any data.

---

## Roadmap

- [ ] Role-based access (allow non-admin users to view analytics)
- [ ] Email/webhook alerting for member count milestones
- [ ] CSV export for analytics data
- [ ] Per-channel message analytics page
- [ ] Member retention cohort charts
- [ ] Customisable dashboard widgets
- [ ] Kubernetes / Helm chart deployment option

---

## Contributing

Contributions are welcome. Please open an issue before submitting a large PR so we can discuss the approach.

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit your changes
4. Push and open a pull request

---

## License

[MIT](LICENSE)
