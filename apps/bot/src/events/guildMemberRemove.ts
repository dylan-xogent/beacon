import type { GuildMember, PartialGuildMember } from "discord.js";
import { prisma } from "@beacon/db";

/**
 * Fired when a member leaves or is removed from a guild.
 * Records a LEAVE MemberEvent and decrements the member count.
 */
export async function onGuildMemberRemove(
  member: GuildMember | PartialGuildMember
): Promise<void> {
  if (member.user?.bot) return; // Ignore bot accounts

  try {
    await prisma.$transaction([
      prisma.memberEvent.create({
        data: {
          guildId: member.guild.id,
          userId: member.user?.id ?? "unknown",
          type: "LEAVE",
        },
      }),
      prisma.guild.update({
        where: { id: member.guild.id },
        data: { memberCount: { decrement: 1 } },
      }),
    ]);
  } catch (error) {
    console.error(
      `[GuildMemberRemove] Failed to record leave for user ${member.user?.id} in guild ${member.guild.id}:`,
      error
    );
  }
}
