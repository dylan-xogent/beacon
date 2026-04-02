import type { Client } from "discord.js";
import { syncGuild } from "../lib/syncGuild.js";

/**
 * Fired once when the Discord client is ready.
 * Syncs all guilds the bot is currently in.
 */
export async function onReady(client: Client<true>): Promise<void> {
  console.log(`[Ready] Logged in as ${client.user.tag}`);
  console.log(`[Ready] In ${client.guilds.cache.size} guild(s). Syncing...`);

  const results = await Promise.allSettled(
    client.guilds.cache.map((guild) => syncGuild(guild))
  );

  const failed = results.filter((r) => r.status === "rejected").length;
  const succeeded = results.length - failed;

  console.log(
    `[Ready] Synced ${succeeded}/${results.length} guild(s).${failed > 0 ? ` (${failed} failed)` : ""}`
  );
}
