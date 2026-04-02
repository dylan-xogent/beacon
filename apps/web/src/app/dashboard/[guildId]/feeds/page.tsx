import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { requireGuildManage } from "@/lib/discord-api";
import { prisma } from "@beacon/db";
import { FeedForm } from "@/components/FeedForm";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DeleteFeedButton } from "./DeleteFeedButton";

// Discord channel type constants (matches discord.js ChannelType enum)
// GuildText = 0, GuildAnnouncement = 5
const TEXT_CHANNEL_TYPES = [0, 5];

interface PageProps {
  params: { guildId: string };
}

const FEED_TYPE_LABELS: Record<string, string> = {
  YOUTUBE: "YouTube",
  TWITCH: "Twitch",
  REDDIT: "Reddit",
  RSS: "RSS",
};

type FeedBadgeVariant = "youtube" | "twitch" | "reddit" | "rss" | "default";
const FEED_TYPE_BADGE: Record<string, FeedBadgeVariant> = {
  YOUTUBE: "youtube",
  TWITCH: "twitch",
  REDDIT: "reddit",
  RSS: "rss",
};

export default async function FeedsPage({ params }: PageProps) {
  const session = await auth();
  if (!session) redirect("/");

  const { guildId } = params;

  try {
    await requireGuildManage(session.accessToken, guildId);
  } catch {
    notFound();
  }

  const guild = await prisma.guild.findUnique({
    where: { id: guildId },
    select: { name: true },
  });

  if (!guild) notFound();

  const [feeds, channels] = await Promise.all([
    prisma.feedSubscription.findMany({
      where: { guildId, active: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.channel.findMany({
      where: {
        guildId,
        type: { in: TEXT_CHANNEL_TYPES },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Nav */}
      <nav className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors">
            ← Servers
          </Link>
          <span className="text-gray-600">/</span>
          <Link
            href={`/dashboard/${guildId}`}
            className="text-gray-400 hover:text-white transition-colors"
          >
            {guild.name}
          </Link>
          <span className="text-gray-600">/</span>
          <span className="text-white font-medium">Feeds</span>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Social Feeds</h1>
          <p className="text-gray-400 text-sm">
            Manage automatic notifications for YouTube, Twitch, Reddit, and RSS feeds.
          </p>
        </div>

        {/* Add new feed form */}
        <FeedForm guildId={guildId} channels={channels} />

        {/* Active subscriptions */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">
            Active Subscriptions{" "}
            <span className="text-gray-400 font-normal text-sm">({feeds.length}/25)</span>
          </h2>

          {feeds.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-700 p-10 text-center">
              <p className="text-gray-400 text-sm">
                No active feed subscriptions yet. Add one above!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {feeds.map((feed) => (
                <Card key={feed.id} padding={false} className="p-4">
                  <div className="flex items-center gap-4">
                    <Badge variant={FEED_TYPE_BADGE[feed.type] ?? "default"}>
                      {FEED_TYPE_LABELS[feed.type] ?? feed.type}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white truncate">
                        {feed.displayName ?? feed.sourceId}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {feed.displayName ? feed.sourceId : ""} → <span className="font-mono">#{feed.channelId}</span>
                        {feed.lastCheckedAt && (
                          <span className="ml-2">
                            · checked {new Date(feed.lastCheckedAt).toLocaleString()}
                          </span>
                        )}
                      </p>
                    </div>
                    <DeleteFeedButton guildId={guildId} feedId={feed.id} />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
