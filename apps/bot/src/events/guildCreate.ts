import type { Guild } from "discord.js";
import type { Redis } from "ioredis";
import { syncGuild } from "../lib/syncGuild.js";
import { scheduleGuildSnapshot } from "../lib/scheduler.js";

/**
 * Fired when the bot joins a new guild.
 * Syncs guild data and sets up snapshot scheduling.
 */
export async function onGuildCreate(guild: Guild, redis: Redis): Promise<void> {
  console.log(`[GuildCreate] Joined guild: ${guild.name} (${guild.id})`);

  try {
    await syncGuild(guild);
    await scheduleGuildSnapshot(redis, guild.id);
    console.log(`[GuildCreate] Synced and scheduled snapshots for guild ${guild.id}`);
  } catch (error) {
    console.error(`[GuildCreate] Failed to sync guild ${guild.id}:`, error);
  }
}
