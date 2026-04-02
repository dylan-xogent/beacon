import "dotenv/config";
import { Events } from "discord.js";
import { Redis } from "ioredis";
import { createClient } from "./client.js";
import { onReady } from "./events/ready.js";
import { onGuildCreate } from "./events/guildCreate.js";
import { onGuildDelete } from "./events/guildDelete.js";
import { onGuildMemberAdd } from "./events/guildMemberAdd.js";
import { onGuildMemberRemove } from "./events/guildMemberRemove.js";
import { onMessageCreate } from "./events/messageCreate.js";
import { onVoiceStateUpdate } from "./events/voiceStateUpdate.js";
import { statsCommand } from "./commands/stats.js";
import { feedsCommand } from "./commands/feeds.js";
import { startFeedPoller } from "./workers/feedPoller.js";
import { startSnapshotWorker } from "./workers/snapshotWorker.js";
import { setupScheduler } from "./lib/scheduler.js";

// ---------------------------------------------------------------------------
// Environment validation
// ---------------------------------------------------------------------------
const requiredEnvVars = ["DISCORD_TOKEN", "DISCORD_CLIENT_ID", "DATABASE_URL", "REDIS_URL"];
const missing = requiredEnvVars.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Redis connection
// ---------------------------------------------------------------------------
const redis = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
});

redis.on("error", (err) => {
  console.error("[Redis] Connection error:", err.message);
});

redis.on("connect", () => {
  console.log("[Redis] Connected.");
});

// ---------------------------------------------------------------------------
// Discord client
// ---------------------------------------------------------------------------
const client = createClient();

// Command map
const commands = new Map([
  [statsCommand.data.name, statsCommand],
  [feedsCommand.data.name, feedsCommand],
]);

// Event: Ready
client.once(Events.ClientReady, async (c) => {
  await onReady(c);

  // Start BullMQ workers after client is ready (snapshot worker needs client ref)
  startFeedPoller(redis);
  startSnapshotWorker(redis, client);

  // Set up recurring job schedules
  await setupScheduler(redis);
});

// Event: Interaction (slash commands)
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`[Command] Error executing /${interaction.commandName}:`, error);
    const reply = { content: "An error occurred while executing that command.", ephemeral: true };
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    } catch {
      // Ignore reply errors
    }
  }
});

// Event: Guild member joined
client.on(Events.GuildMemberAdd, async (member) => {
  await onGuildMemberAdd(member);
});

// Event: Guild member left
client.on(Events.GuildMemberRemove, async (member) => {
  await onGuildMemberRemove(member);
});

// Event: Message created
client.on(Events.MessageCreate, async (message) => {
  await onMessageCreate(message);
});

// Event: Voice state changed
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  await onVoiceStateUpdate(oldState, newState);
});

// Event: Joined a new guild
client.on(Events.GuildCreate, async (guild) => {
  await onGuildCreate(guild, redis);
});

// Event: Removed from guild
client.on(Events.GuildDelete, async (guild) => {
  await onGuildDelete(guild);
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
async function shutdown(signal: string): Promise<void> {
  console.log(`[Beacon] Received ${signal}, shutting down...`);
  await client.destroy();
  await redis.quit();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => {
  console.error("[Beacon] Unhandled rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[Beacon] Uncaught exception:", err);
  process.exit(1);
});

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------
console.log("[Beacon] Starting bot...");
client.login(process.env.DISCORD_TOKEN);
