import type { Message } from "discord.js";
import { ChannelType } from "discord.js";
import { prisma } from "@beacon/db";

/**
 * Fired for every message. Records a MessageEvent for analytics.
 * Ignores: bot messages, DMs, system messages.
 */
export async function onMessageCreate(message: Message): Promise<void> {
  // Ignore bots and system messages
  if (message.author.bot || message.system) return;

  // Ignore DMs — we only track guild messages
  if (!message.guild || message.channel.type === ChannelType.DM) return;

  try {
    // Ensure channel exists in DB (may have been created after last sync)
    await prisma.channel.upsert({
      where: { id: message.channelId },
      create: {
        id: message.channelId,
        guildId: message.guild.id,
        name: message.channel.isTextBased() && "name" in message.channel
          ? message.channel.name
          : "unknown",
        type: message.channel.type,
      },
      update: {},
    });

    await prisma.messageEvent.create({
      data: {
        guildId: message.guild.id,
        channelId: message.channelId,
        userId: message.author.id,
      },
    });
  } catch (error) {
    console.error(
      `[MessageCreate] Failed to record message in channel ${message.channelId}:`,
      error
    );
  }
}
