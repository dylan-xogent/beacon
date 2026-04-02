import { Worker, Job } from "bullmq";
import type { Redis } from "ioredis";
import { EmbedBuilder, REST, Routes } from "discord.js";
import { prisma } from "@beacon/db";
import { fetchLatestYouTubeVideo } from "../lib/feedProviders/youtube.js";
import { fetchTwitchStream } from "../lib/feedProviders/twitch.js";
import { fetchLatestRedditPost } from "../lib/feedProviders/reddit.js";
import { fetchLatestRssItem } from "../lib/feedProviders/rss.js";

interface FeedPollJobData {
  subscriptionId: string;
}

// Discord embed colors per feed type
const EMBED_COLORS: Record<string, number> = {
  YOUTUBE: 0xff0000,  // YouTube red
  TWITCH: 0x9146ff,   // Twitch purple
  REDDIT: 0xff4500,   // Reddit orange
  RSS: 0xf9a825,      // Amber
};

/**
 * Posts a Discord embed message to the specified channel via REST.
 */
async function postEmbed(
  channelId: string,
  embed: EmbedBuilder,
  content?: string
): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(
    process.env.DISCORD_TOKEN!
  );

  await rest.post(Routes.channelMessages(channelId) as `/${string}`, {
    body: {
      content: content ?? undefined,
      embeds: [embed.toJSON()],
    },
  });
}

/**
 * Processes a single feed subscription poll job.
 */
async function processFeedJob(job: Job<FeedPollJobData>): Promise<void> {
  const { subscriptionId } = job.data;

  const sub = await prisma.feedSubscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!sub || !sub.active) {
    console.log(`[FeedPoller] Subscription ${subscriptionId} not found or inactive, skipping.`);
    return;
  }

  let newItemId: string | null = null;
  let embed: EmbedBuilder | null = null;
  let content: string | undefined;

  try {
    switch (sub.type) {
      case "YOUTUBE": {
        const video = await fetchLatestYouTubeVideo(sub.sourceId, sub.lastItemId);
        if (!video) break;
        newItemId = video.id;
        embed = new EmbedBuilder()
          .setColor(EMBED_COLORS.YOUTUBE)
          .setTitle(video.title)
          .setURL(video.url)
          .setAuthor({ name: video.author })
          .setImage(video.thumbnail)
          .setFooter({ text: "YouTube" })
          .setTimestamp(new Date(video.publishedAt));
        content = `📺 **${video.author}** just uploaded a new video!`;
        break;
      }

      case "TWITCH": {
        const stream = await fetchTwitchStream(sub.sourceId, sub.lastItemId);
        if (!stream) break;
        newItemId = stream.id;
        embed = new EmbedBuilder()
          .setColor(EMBED_COLORS.TWITCH)
          .setTitle(`${stream.userName} is live on Twitch!`)
          .setURL(`https://www.twitch.tv/${stream.userLogin}`)
          .setDescription(stream.title || null)
          .addFields(
            { name: "Game", value: stream.gameName || "Unknown", inline: true },
            { name: "Viewers", value: stream.viewerCount.toLocaleString(), inline: true }
          )
          .setImage(stream.thumbnailUrl)
          .setFooter({ text: "Twitch" })
          .setTimestamp(new Date(stream.startedAt));
        content = `🟣 **${stream.userName}** is live!`;
        break;
      }

      case "REDDIT": {
        const post = await fetchLatestRedditPost(sub.sourceId, sub.lastItemId);
        if (!post) break;
        if (post.isNsfw) break; // Skip NSFW posts
        newItemId = post.id;
        embed = new EmbedBuilder()
          .setColor(EMBED_COLORS.REDDIT)
          .setTitle(post.title.slice(0, 256))
          .setURL(post.permalink)
          .addFields(
            { name: "Author", value: `u/${post.author}`, inline: true },
            { name: "Score", value: post.score.toString(), inline: true }
          )
          .setFooter({ text: `r/${post.subreddit}` })
          .setTimestamp(new Date(post.createdUtc * 1000));
        if (post.thumbnail) {
          embed.setThumbnail(post.thumbnail);
        }
        content = `🔴 New post in **r/${post.subreddit}**`;
        break;
      }

      case "RSS": {
        const item = await fetchLatestRssItem(sub.sourceId, sub.lastItemId);
        if (!item) break;
        newItemId = item.id;
        embed = new EmbedBuilder()
          .setColor(EMBED_COLORS.RSS)
          .setTitle(item.title.slice(0, 256))
          .setURL(item.url)
          .setFooter({ text: sub.displayName ?? "RSS Feed" })
          .setTimestamp(item.publishedAt ? new Date(item.publishedAt) : undefined);
        if (item.contentSnippet) {
          embed.setDescription(item.contentSnippet);
        }
        if (item.author) {
          embed.setAuthor({ name: item.author });
        }
        content = `📰 New post from **${sub.displayName ?? "RSS Feed"}**`;
        break;
      }

      default:
        console.warn(`[FeedPoller] Unknown feed type: ${sub.type}`);
    }
  } catch (providerError) {
    console.error(
      `[FeedPoller] Provider error for subscription ${subscriptionId} (${sub.type}/${sub.sourceId}):`,
      providerError
    );
    throw providerError; // Re-throw so BullMQ can retry
  }

  // Update lastCheckedAt regardless of whether there's new content
  if (newItemId && embed) {
    try {
      await postEmbed(sub.channelId, embed, content);
    } catch (discordError) {
      console.error(
        `[FeedPoller] Failed to post to channel ${sub.channelId}:`,
        discordError
      );
      // Don't throw — don't want to retry just because Discord had a blip
    }

    await prisma.feedSubscription.update({
      where: { id: subscriptionId },
      data: {
        lastItemId: newItemId,
        lastCheckedAt: new Date(),
      },
    });
  } else {
    await prisma.feedSubscription.update({
      where: { id: subscriptionId },
      data: { lastCheckedAt: new Date() },
    });
  }
}

/**
 * Creates and starts the BullMQ feed poll worker.
 */
export function startFeedPoller(connection: Redis): Worker<FeedPollJobData> {
  const worker = new Worker<FeedPollJobData>(
    "feed-poll",
    async (job) => {
      await processFeedJob(job);
    },
    {
      connection,
      concurrency: 5,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
      },
    }
  );

  worker.on("completed", (job) => {
    console.log(`[FeedPoller] Job ${job.id} completed (sub: ${job.data.subscriptionId})`);
  });

  worker.on("failed", (job, err) => {
    console.error(
      `[FeedPoller] Job ${job?.id} failed (sub: ${job?.data.subscriptionId}):`,
      err.message
    );
  });

  return worker;
}
