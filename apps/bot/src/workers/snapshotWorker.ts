import { Worker, Job } from "bullmq";
import type { Redis } from "ioredis";
import type { Client } from "discord.js";
import { prisma } from "@beacon/db";

interface SnapshotJobData {
  guildId: string;
}

/**
 * Takes a MemberSnapshot for a guild — records the current member count with a timestamp.
 * This powers the member growth chart in the dashboard.
 */
async function processSnapshotJob(
  job: Job<SnapshotJobData>,
  client: Client
): Promise<void> {
  const { guildId } = job.data;

  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    console.warn(`[SnapshotWorker] Guild ${guildId} not in cache, skipping snapshot.`);
    return;
  }

  // Fetch fresh member count
  let memberCount = guild.memberCount;
  try {
    await guild.members.fetch();
    memberCount = guild.memberCount;
  } catch {
    // Use cached count if fetch fails
  }

  await prisma.$transaction([
    prisma.memberSnapshot.create({
      data: { guildId, memberCount },
    }),
    prisma.guild.update({
      where: { id: guildId },
      data: { memberCount },
    }),
  ]);

  console.log(
    `[SnapshotWorker] Snapshot for guild ${guildId}: ${memberCount} members.`
  );
}

/**
 * Creates and starts the BullMQ snapshot worker.
 * Requires a reference to the Discord client to read live member counts.
 */
export function startSnapshotWorker(
  connection: Redis,
  client: Client
): Worker<SnapshotJobData> {
  const worker = new Worker<SnapshotJobData>(
    "snapshot",
    async (job) => {
      await processSnapshotJob(job, client);
    },
    {
      connection,
      concurrency: 2,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 10_000 },
      },
    }
  );

  worker.on("completed", (job) => {
    console.log(`[SnapshotWorker] Snapshot job ${job.id} completed for guild ${job.data.guildId}`);
  });

  worker.on("failed", (job, err) => {
    console.error(
      `[SnapshotWorker] Job ${job?.id} failed for guild ${job?.data.guildId}:`,
      err.message
    );
  });

  return worker;
}
