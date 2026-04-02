# Beacon

A self-hosted Discord analytics and social feed notification bot.

Beacon gives you full ownership of your Discord server's data — member growth, message activity, voice usage — and lets you subscribe channels to YouTube, Twitch, Reddit, and RSS feeds, all in a clean web dashboard.

## Features

- **Analytics Dashboard** — member join/leave trends, message volume per channel, voice activity minutes, all visualised with interactive charts
- **Social Feed Notifications** — YouTube new video, Twitch goes live, Reddit new post, any RSS/Atom feed
- **Self-hosted** — your data stays on your server; deploy with a single `docker compose up`
- **Slash Commands** — `/stats` for a quick embed, `/feeds` to manage subscriptions from Discord

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Bot | TypeScript + discord.js v14 + BullMQ |
| Web | Next.js 14 (App Router) + Tailwind CSS + NextAuth.js v5 |
| Database | PostgreSQL via Prisma ORM |
| Queue | Redis + BullMQ |
| Deploy | Docker Compose |

## Quick Start

### Prerequisites

- Docker & Docker Compose v2
- A Discord application with a bot token ([create one here](https://discord.com/developers/applications))
- (Optional) Twitch API credentials for Twitch notifications

### 1. Clone and configure

```bash
git clone https://github.com/your-org/beacon.git
cd beacon
cp .env.example .env
```

Edit `.env` and fill in:

| Variable | Description |
|----------|-------------|
| `DISCORD_TOKEN` | Bot token from Discord Developer Portal |
| `DISCORD_CLIENT_ID` | Application ID |
| `DISCORD_CLIENT_SECRET` | OAuth2 client secret (for web login) |
| `NEXTAUTH_SECRET` | Random secret — run `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Public URL of the web dashboard |
| `TWITCH_CLIENT_ID` | Twitch app client ID (optional) |
| `TWITCH_CLIENT_SECRET` | Twitch app client secret (optional) |

### 2. Invite the bot

Go to `https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot+applications.commands` and invite Beacon to your server.

### 3. Deploy

```bash
docker compose up -d
```

The web dashboard will be available at `http://localhost:3000` (or your configured `NEXTAUTH_URL`).

The bot automatically runs database migrations on first start.

## Development

### Requirements

- Node.js 20+
- pnpm 9+
- Docker (for Postgres + Redis)

### Setup

```bash
# Install dependencies
pnpm install

# Start infrastructure
docker compose -f docker-compose.dev.yml up -d

# Set up .env (copy and fill in values)
cp .env.example .env

# Run database migrations
pnpm db:migrate

# Generate Prisma client
pnpm db:generate

# Register slash commands with Discord
pnpm --filter @beacon/bot deploy-commands

# Start bot (in one terminal)
pnpm dev:bot

# Start web app (in another terminal)
pnpm dev:web
```

### Project Structure

```
beacon/
├── apps/
│   ├── bot/          # Discord bot (TypeScript + discord.js)
│   └── web/          # Web dashboard (Next.js 14)
├── packages/
│   └── db/           # Shared Prisma client + schema
├── docker-compose.yml
└── docker-compose.dev.yml
```

## Slash Commands

| Command | Description |
|---------|-------------|
| `/stats` | Shows member count, messages today, and active voice users |
| `/feeds list` | Lists all active feed subscriptions in this server |
| `/feeds add` | Adds a new feed subscription |
| `/feeds remove` | Removes a feed subscription |

## Feed Types

| Type | Source ID Format | Example |
|------|-----------------|---------|
| `YOUTUBE` | YouTube channel ID | `UCxxxxxx` |
| `TWITCH` | Twitch username | `shroud` |
| `REDDIT` | Subreddit name | `programming` |
| `RSS` | Feed URL | `https://example.com/feed.xml` |

## Environment Variables Reference

See `.env.example` for the full list with descriptions.

## License

MIT
