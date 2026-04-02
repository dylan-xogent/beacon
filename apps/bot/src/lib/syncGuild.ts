import { prisma } from "@beacon/db";
import { Guild, ChannelType } from "discord.js";

/**
 * Upserts a Guild record and all its text/voice channels into the database.
 * Called on bot ready, guildCreate, and periodically to keep data fresh.
 */
export async function syncGuild(guild: Guild): Promise<void> {
  // Fetch full member list to get accurate count
  let memberCount = guild.memberCount;
  try {
    await guild.members.fetch();
    memberCount = guild.memberCount;
  } catch {
    // Fallback to cached count if fetch fails (e.g., missing intent)
  }

  await prisma.guild.upsert({
    where: { id: guild.id },
    create: {
      id: guild.id,
      name: guild.name,
      iconUrl: guild.iconURL() ?? null,
      memberCount,
    },
    update: {
      name: guild.name,
      iconUrl: guild.iconURL() ?? null,
      memberCount,
    },
  });

  // Sync channels — upsert each text, announcement, or voice channel
  const supportedTypes = [
    ChannelType.GuildText,
    ChannelType.GuildAnnouncement,
    ChannelType.GuildVoice,
    ChannelType.GuildStageVoice,
    ChannelType.GuildForum,
  ];

  const channels = guild.channels.cache.filter((ch) =>
    supportedTypes.includes(ch.type)
  );

  for (const [, channel] of channels) {
    await prisma.channel.upsert({
      where: { id: channel.id },
      create: {
        id: channel.id,
        guildId: guild.id,
        name: channel.name,
        type: channel.type,
      },
      update: {
        name: channel.name,
        type: channel.type,
      },
    });
  }
}
