import { Queue } from "bullmq";
import type { Redis } from "ioredis";
import { prisma } from "@beacon/db";

const FEED_POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const SNAPSHOT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Sets up recurring BullMQ jobs:
 * - Feed polling every 5 minutes (one job per active FeedSubscription)
 * - Member snapshot every 1 hour (one job per tracked guild)
 */
export async function setupScheduler(connection: Redis): Promise<void> {
  const feedQueue = new Queue("feed-poll", { connection });
  const snapshotQueue = new Queue("snapshot", { connection });

  // Schedule snapshot jobs for all guilds
  const guilds = await prisma.guild.findMany({ select: { id: true } });
  for (const guild of guilds) {
    await snapshotQueue.add(
      "snapshot",
      { guildId: guild.id },
      {
        jobId: `snapshot-${guild.id}`,
        repeat: { every: SNAPSHOT_INTERVAL_MS },
        removeOnComplete: 10,
        removeOnFail: 5,
      }
    );
  }

  // Schedule feed poll jobs for all active subscriptions
  const feeds = await prisma.feedSubscription.findMany({
    where: { active: true },
    select: { id: true },
  });

  for (const feed of feeds) {
    await feedQueue.add(
      "poll",
      { subscriptionId: feed.id },
      {
        jobId: `feed-poll-${feed.id}`,
        repeat: { every: FEED_POLL_INTERVAL_MS },
        removeOnComplete: 5,
        removeOnFail: 5,
      }
    );
  }

  console.log(
    `[Scheduler] Scheduled ${guilds.length} snapshot job(s) and ${feeds.length} feed poll job(s).`
  );
}

/**
 * Adds a feed poll job for a newly created subscription.
 */
export async function scheduleFeed(
  connection: Redis,
  subscriptionId: string
): Promise<void> {
  const feedQueue = new Queue("feed-poll", { connection });
  await feedQueue.add(
    "poll",
    { subscriptionId },
    {
      jobId: `feed-poll-${subscriptionId}`,
      repeat: { every: FEED_POLL_INTERVAL_MS },
      removeOnComplete: 5,
      removeOnFail: 5,
    }
  );
}

/**
 * Removes a feed poll job when a subscription is deleted.
 */
export async function unscheduleFeed(
  connection: Redis,
  subscriptionId: string
): Promise<void> {
  const feedQueue = new Queue("feed-poll", { connection });
  await feedQueue.removeRepeatable("poll", {
    every: FEED_POLL_INTERVAL_MS,
    jobId: `feed-poll-${subscriptionId}`,
  });
}

/**
 * Adds a snapshot job for a newly joined guild.
 */
export async function scheduleGuildSnapshot(
  connection: Redis,
  guildId: string
): Promise<void> {
  const snapshotQueue = new Queue("snapshot", { connection });
  await snapshotQueue.add(
    "snapshot",
    { guildId },
    {
      jobId: `snapshot-${guildId}`,
      repeat: { every: SNAPSHOT_INTERVAL_MS },
      removeOnComplete: 10,
      removeOnFail: 5,
    }
  );
}
