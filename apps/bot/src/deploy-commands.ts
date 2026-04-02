/**
 * One-time script to register slash commands with the Discord API.
 * Run with: pnpm --filter @beacon/bot deploy-commands
 */
import "dotenv/config";
import { REST, Routes } from "discord.js";
import { statsCommand } from "./commands/stats.js";
import { feedsCommand } from "./commands/feeds.js";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

if (!token || !clientId) {
  console.error(
    "Missing DISCORD_TOKEN or DISCORD_CLIENT_ID environment variables."
  );
  process.exit(1);
}

const commands = [statsCommand.data.toJSON(), feedsCommand.data.toJSON()];

const rest = new REST({ version: "10" }).setToken(token);

(async () => {
  try {
    console.log(`Registering ${commands.length} application commands...`);

    const data = await rest.put(Routes.applicationCommands(clientId), {
      body: commands,
    });

    console.log(
      `Successfully registered ${(data as unknown[]).length} application commands.`
    );
  } catch (error) {
    console.error("Failed to register commands:", error);
    process.exit(1);
  }
})();
