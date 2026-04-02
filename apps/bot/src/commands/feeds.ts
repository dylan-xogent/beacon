import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
} from "discord.js";
import { prisma } from "@beacon/db";

const FEED_TYPE_LABELS: Record<string, string> = {
  YOUTUBE: "YouTube",
  TWITCH: "Twitch",
  REDDIT: "Reddit",
  RSS: "RSS",
};

const FEED_COLORS: Record<string, number> = {
  YOUTUBE: 0xff0000,
  TWITCH: 0x9146ff,
  REDDIT: 0xff4500,
  RSS: 0xf9a825,
};

export const feedsCommand = {
  data: new SlashCommandBuilder()
    .setName("feeds")
    .setDescription("Manage social feed subscriptions for this server.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("List all active feed subscriptions.")
    )
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Subscribe a channel to a social feed.")
        .addStringOption((opt) =>
          opt
            .setName("type")
            .setDescription("Feed type")
            .setRequired(true)
            .addChoices(
              { name: "YouTube", value: "YOUTUBE" },
              { name: "Twitch", value: "TWITCH" },
              { name: "Reddit", value: "REDDIT" },
              { name: "RSS", value: "RSS" }
            )
        )
        .addStringOption((opt) =>
          opt
            .setName("source")
            .setDescription(
              "YouTube channel ID, Twitch username, subreddit name, or RSS URL"
            )
            .setRequired(true)
        )
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription(
              "Discord channel to post notifications in (defaults to current channel)"
            )
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName("name")
            .setDescription("Display name for this feed (optional)")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a feed subscription by its ID.")
        .addStringOption((opt) =>
          opt
            .setName("id")
            .setDescription("Feed subscription ID (from /feeds list)")
            .setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        ephemeral: true,
      });
      return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === "list") {
      await handleList(interaction);
    } else if (sub === "add") {
      await handleAdd(interaction);
    } else if (sub === "remove") {
      await handleRemove(interaction);
    }
  },
};

async function handleList(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const feeds = await prisma.feedSubscription.findMany({
    where: { guildId: interaction.guild!.id, active: true },
    orderBy: { createdAt: "asc" },
  });

  if (feeds.length === 0) {
    await interaction.editReply({
      content: "No active feed subscriptions. Use `/feeds add` to set one up!",
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("Active Feed Subscriptions")
    .setDescription(
      feeds
        .map(
          (f) =>
            `**${FEED_TYPE_LABELS[f.type] ?? f.type}** — ${f.displayName ?? f.sourceId}\n` +
            `Channel: <#${f.channelId}> | ID: \`${f.id}\``
        )
        .join("\n\n")
    )
    .setFooter({ text: `${feeds.length} subscription(s)` });

  await interaction.editReply({ embeds: [embed] });
}

async function handleAdd(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const type = interaction.options.getString("type", true);
  const sourceId = interaction.options.getString("source", true).trim();
  const targetChannel =
    interaction.options.getChannel("channel") ?? interaction.channel;
  const displayName = interaction.options.getString("name") ?? undefined;

  if (!targetChannel) {
    await interaction.editReply({ content: "Could not determine target channel." });
    return;
  }

  // Basic source validation
  if (type === "RSS" && !sourceId.startsWith("http")) {
    await interaction.editReply({
      content: "For RSS feeds, please provide a full URL starting with http:// or https://",
    });
    return;
  }

  // Limit per guild
  const existingCount = await prisma.feedSubscription.count({
    where: { guildId: interaction.guild!.id, active: true },
  });

  if (existingCount >= 25) {
    await interaction.editReply({
      content: "This server has reached the maximum of 25 active feed subscriptions.",
    });
    return;
  }

  const feed = await prisma.feedSubscription.create({
    data: {
      guildId: interaction.guild!.id,
      channelId: targetChannel.id,
      type,
      sourceId,
      displayName: displayName ?? null,
      active: true,
    },
  });

  const embed = new EmbedBuilder()
    .setColor(FEED_COLORS[type] ?? 0x5865f2)
    .setTitle("Feed Subscription Added")
    .addFields(
      { name: "Type", value: FEED_TYPE_LABELS[type] ?? type, inline: true },
      { name: "Source", value: sourceId, inline: true },
      { name: "Channel", value: `<#${targetChannel.id}>`, inline: true },
      { name: "ID", value: `\`${feed.id}\``, inline: false }
    )
    .setFooter({ text: "Notifications will start within 5 minutes." });

  await interaction.editReply({ embeds: [embed] });
}

async function handleRemove(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const feedId = interaction.options.getString("id", true).trim();

  const feed = await prisma.feedSubscription.findFirst({
    where: { id: feedId, guildId: interaction.guild!.id },
  });

  if (!feed) {
    await interaction.editReply({
      content: `No feed subscription found with ID \`${feedId}\` in this server.`,
    });
    return;
  }

  await prisma.feedSubscription.update({
    where: { id: feedId },
    data: { active: false },
  });

  await interaction.editReply({
    content: `Removed feed subscription \`${feedId}\` (${FEED_TYPE_LABELS[feed.type] ?? feed.type}: ${feed.sourceId}).`,
  });
}
