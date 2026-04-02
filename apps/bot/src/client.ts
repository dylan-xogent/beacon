import {
  Client,
  GatewayIntentBits,
  Partials,
} from "discord.js";

/**
 * Creates and returns a configured Discord.js Client with all intents
 * required for Beacon's analytics and feed functionality.
 */
export function createClient(): Client {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.GuildMember, Partials.Channel],
  });
}
