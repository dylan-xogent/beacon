import type { GuildMember } from "discord.js";
import { prisma } from "@beacon/db";

/**
 * Fired when a member joins a guild.
 * Records a JOIN MemberEvent and updates the guild's cached member count.
 */
export async function onGuildMemberAdd(member: GuildMember): Promise<void> {
  if (member.user.bot) return; // Ignore bot accounts

  try {
    await prisma.$transaction([
      prisma.memberEvent.create({
        data: {
          guildId: member.guild.id,
          userId: member.user.id,
          type: "JOIN",
        },
      }),
      prisma.guild.update({
        where: { id: member.guild.id },
        data: { memberCount: { increment: 1 } },
      }),
    ]);
  } catch (error) {
    console.error(
      `[GuildMemberAdd] Failed to record join for user ${member.user.id} in guild ${member.guild.id}:`,
      error
    );
  }
}
