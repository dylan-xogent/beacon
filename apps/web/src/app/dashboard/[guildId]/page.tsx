import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { requireGuildManage } from "@/lib/discord-api";
import { prisma } from "@beacon/db";
import { MemberGrowthChart } from "@/components/charts/MemberGrowthChart";
import { MessageVolumeChart } from "@/components/charts/MessageVolumeChart";
import { VoiceActivityChart } from "@/components/charts/VoiceActivityChart";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface PageProps {
  params: { guildId: string };
  searchParams: { range?: string };
}

type Range = "7d" | "30d" | "90d";

interface AnalyticsData {
  memberGrowth: Array<{ date: string; joins: number; leaves: number }>;
  messageVolume: Array<{ date: string; channelId: string; channelName: string; count: number }>;
  voiceActivity: Array<{ date: string; minutes: number }>;
  memberSnapshot: Array<{ date: string; count: number }>;
}

async function fetchAnalytics(
  guildId: string,
  range: Range
): Promise<AnalyticsData> {
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const res = await fetch(
    `${baseUrl}/api/guilds/${guildId}/analytics?range=${range}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Failed to fetch analytics");
  return res.json() as Promise<AnalyticsData>;
}

export default async function GuildAnalyticsPage({
  params,
  searchParams,
}: PageProps) {
  const session = await auth();
  if (!session) redirect("/");

  const { guildId } = params;
  const range = (searchParams.range ?? "7d") as Range;

  // Auth check
  try {
    await requireGuildManage(session.accessToken, guildId);
  } catch {
    notFound();
  }

  const guild = await prisma.guild.findUnique({
    where: { id: guildId },
    select: { name: true, iconUrl: true, memberCount: true },
  });

  if (!guild) notFound();

  let analytics: AnalyticsData = {
    memberGrowth: [],
    messageVolume: [],
    voiceActivity: [],
    memberSnapshot: [],
  };

  try {
    analytics = await fetchAnalytics(guildId, range);
  } catch (err) {
    console.error("[GuildPage] Analytics fetch failed:", err);
  }

  // Compute summary stats
  const totalJoins = analytics.memberGrowth.reduce((s, d) => s + d.joins, 0);
  const totalLeaves = analytics.memberGrowth.reduce((s, d) => s + d.leaves, 0);
  const totalMessages = analytics.messageVolume.reduce((s, d) => s + d.count, 0);
  const totalVoiceMinutes = analytics.voiceActivity.reduce((s, d) => s + d.minutes, 0);

  const rangeLabels: Record<Range, string> = {
    "7d": "7 days",
    "30d": "30 days",
    "90d": "90 days",
  };

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Nav */}
      <nav className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors">
            ← Servers
          </Link>
          <span className="text-gray-600">/</span>
          <span className="text-white font-medium">{guild.name}</span>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href={`/dashboard/${guildId}/feeds`}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Feeds →
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{guild.name}</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              {guild.memberCount.toLocaleString()} members
            </p>
          </div>

          {/* Range picker */}
          <div className="flex gap-2">
            {(["7d", "30d", "90d"] as Range[]).map((r) => (
              <Link
                key={r}
                href={`/dashboard/${guildId}?range=${r}`}
                className={[
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  range === r
                    ? "bg-brand-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:text-white",
                ].join(" ")}
              >
                {rangeLabels[r]}
              </Link>
            ))}
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Members", value: guild.memberCount.toLocaleString() },
            {
              label: `Joins (${rangeLabels[range]})`,
              value: `+${totalJoins}`,
              className: "text-green-400",
            },
            {
              label: `Leaves (${rangeLabels[range]})`,
              value: `-${totalLeaves}`,
              className: "text-red-400",
            },
            {
              label: `Messages (${rangeLabels[range]})`,
              value: totalMessages.toLocaleString(),
            },
          ].map((stat) => (
            <Card key={stat.label}>
              <p className="text-xs text-gray-400 mb-1">{stat.label}</p>
              <p className={["text-2xl font-bold text-white", stat.className ?? ""].join(" ")}>
                {stat.value}
              </p>
            </Card>
          ))}
        </div>

        {/* Member Growth Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Member Growth</CardTitle>
            <Badge variant="default">Snapshots</Badge>
          </CardHeader>
          <MemberGrowthChart data={analytics.memberSnapshot} />
        </Card>

        {/* Message Volume Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Message Volume</CardTitle>
            <Badge variant="default">By channel</Badge>
          </CardHeader>
          <MessageVolumeChart data={analytics.messageVolume} />
        </Card>

        {/* Voice Activity Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Voice Activity</CardTitle>
            <p className="text-sm text-gray-400">
              {Math.round(totalVoiceMinutes / 60).toLocaleString()}h total
            </p>
          </CardHeader>
          <VoiceActivityChart data={analytics.voiceActivity} />
        </Card>
      </main>
    </div>
  );
}
