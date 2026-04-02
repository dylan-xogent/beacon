import type { Guild } from "discord.js";
import { prisma } from "@beacon/db";

/**
 * Fired when the bot is removed from a guild (or the guild is deleted).
 * We keep historical analytics data but mark the guild as effectively inactive
 * by not removing it — operators can clean up via the dashboard if needed.
 */
export async function onGuildDelete(guild: Guild): Promise<void> {
  console.log(`[GuildDelete] Removed from guild: ${guild.name} (${guild.id})`);

  try {
    // Deactivate all feed subscriptions for this guild
    await prisma.feedSubscription.updateMany({
      where: { guildId: guild.id },
      data: { active: false },
    });

    console.log(`[GuildDelete] Deactivated feed subscriptions for guild ${guild.id}`);
  } catch (error) {
    console.error(`[GuildDelete] Error handling guild deletion for ${guild.id}:`, error);
  }
}
