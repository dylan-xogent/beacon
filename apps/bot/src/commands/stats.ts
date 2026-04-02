import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import { prisma } from "@beacon/db";

export const statsCommand = {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Shows server analytics: member count, messages today, and active voice users.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
      return;
    }

    await interaction.deferReply();

    try {
      const guildId = interaction.guild.id;

      // Member count from DB
      const guild = await prisma.guild.findUnique({
        where: { id: guildId },
        select: { memberCount: true, name: true },
      });

      // Messages in the last 24 hours
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const messagesToday = await prisma.messageEvent.count({
        where: { guildId, timestamp: { gte: since } },
      });

      // Active voice users (have a JOIN with no subsequent LEAVE today)
      const voiceJoinsToday = await prisma.voiceEvent.findMany({
        where: { guildId, type: "JOIN", timestamp: { gte: since } },
        select: { userId: true, channelId: true, timestamp: true },
      });
      const voiceLeavesToday = await prisma.voiceEvent.findMany({
        where: { guildId, type: "LEAVE", timestamp: { gte: since } },
        select: { userId: true, timestamp: true },
      });

      // Count users who joined voice but haven't left
      const leaveMap = new Map<string, Date>();
      for (const leave of voiceLeavesToday) {
        const existing = leaveMap.get(leave.userId);
        if (!existing || leave.timestamp > existing) {
          leaveMap.set(leave.userId, leave.timestamp);
        }
      }

      const activeVoiceUsers = voiceJoinsToday.filter((join) => {
        const lastLeave = leaveMap.get(join.userId);
        return !lastLeave || lastLeave < join.timestamp;
      });
      const uniqueActiveVoice = new Set(activeVoiceUsers.map((v) => v.userId)).size;

      // Member joins/leaves today
      const joinsToday = await prisma.memberEvent.count({
        where: { guildId, type: "JOIN", timestamp: { gte: since } },
      });
      const leavesToday = await prisma.memberEvent.count({
        where: { guildId, type: "LEAVE", timestamp: { gte: since } },
      });

      const embed = new EmbedBuilder()
        .setColor(0x5865f2) // Discord blurple
        .setTitle(`${interaction.guild.name} — Server Stats`)
        .setThumbnail(interaction.guild.iconURL() ?? null)
        .addFields(
          {
            name: "Members",
            value: [
              `**Total:** ${guild?.memberCount?.toLocaleString() ?? "N/A"}`,
              `**Joined today:** +${joinsToday}`,
              `**Left today:** -${leavesToday}`,
            ].join("\n"),
            inline: true,
          },
          {
            name: "Activity (24h)",
            value: [
              `**Messages:** ${messagesToday.toLocaleString()}`,
              `**Active in voice:** ${uniqueActiveVoice}`,
            ].join("\n"),
            inline: true,
          }
        )
        .setFooter({ text: "Powered by Beacon • beacon.gg" })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("[/stats] Error:", error);
      await interaction.editReply({
        content: "Failed to fetch server stats. Please try again later.",
      });
    }
  },
};
