import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireGuildManage } from "@/lib/discord-api";
import { prisma } from "@beacon/db";
import { format, subDays, eachDayOfInterval } from "date-fns";

type RangeKey = "7d" | "30d" | "90d";
const RANGE_DAYS: Record<RangeKey, number> = { "7d": 7, "30d": 30, "90d": 90 };

interface Params {
  params: { guildId: string };
}

/**
 * GET /api/guilds/[guildId]/analytics?range=7d|30d|90d
 *
 * Returns member growth, message volume, voice activity, and member snapshots
 * for the specified date range.
 */
export async function GET(
  request: NextRequest,
  { params }: Params
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guildId } = params;

  try {
    await requireGuildManage(session.accessToken, guildId);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rangeParam = (request.nextUrl.searchParams.get("range") ?? "7d") as RangeKey;
  const days = RANGE_DAYS[rangeParam] ?? 7;

  const since = subDays(new Date(), days);
  const dateRange = eachDayOfInterval({ start: since, end: new Date() });

  try {
    // --- Member events ---
    const memberEvents = await prisma.memberEvent.findMany({
      where: { guildId, timestamp: { gte: since } },
      select: { type: true, timestamp: true },
    });

    const memberGrowthMap = new Map<
      string,
      { joins: number; leaves: number }
    >();
    for (const day of dateRange) {
      memberGrowthMap.set(format(day, "yyyy-MM-dd"), { joins: 0, leaves: 0 });
    }
    for (const event of memberEvents) {
      const key = format(event.timestamp, "yyyy-MM-dd");
      const entry = memberGrowthMap.get(key);
      if (entry) {
        if (event.type === "JOIN") entry.joins++;
        else entry.leaves++;
      }
    }
    const memberGrowth = Array.from(memberGrowthMap.entries()).map(
      ([date, v]) => ({ date, ...v })
    );

    // --- Message volume (grouped by day + channel) ---
    const messageEvents = await prisma.messageEvent.findMany({
      where: { guildId, timestamp: { gte: since } },
      include: { channel: { select: { name: true } } },
    });

    type MessageRow = { channelId: string; timestamp: Date; channel: { name: string } };
    const msgMap = new Map<string, { channelId: string; channelName: string; count: number }>();
    for (const event of messageEvents as MessageRow[]) {
      const dateKey = format(event.timestamp, "yyyy-MM-dd");
      const key = `${dateKey}::${event.channelId}`;
      const existing = msgMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        msgMap.set(key, {
          channelId: event.channelId,
          channelName: event.channel.name,
          count: 1,
        });
      }
    }
    const messageVolume = Array.from(msgMap.entries()).map(([key, v]) => ({
      date: key.split("::")[0],
      ...v,
    }));

    // --- Voice activity (minutes per day) ---
    // Pair up JOIN and LEAVE events per user to compute session duration
    const voiceEvents = await prisma.voiceEvent.findMany({
      where: { guildId, timestamp: { gte: since } },
      orderBy: { timestamp: "asc" },
      select: { userId: true, type: true, timestamp: true, channelId: true },
    });

    // Track open sessions: userId -> join timestamp
    const openSessions = new Map<string, Date>();
    const minutesPerDay = new Map<string, number>();
    for (const day of dateRange) {
      minutesPerDay.set(format(day, "yyyy-MM-dd"), 0);
    }

    for (const event of voiceEvents) {
      const userKey = `${event.userId}:${event.channelId}`;
      if (event.type === "JOIN") {
        openSessions.set(userKey, event.timestamp);
      } else if (event.type === "LEAVE") {
        const joinTime = openSessions.get(userKey);
        if (joinTime) {
          openSessions.delete(userKey);
          const durationMs = event.timestamp.getTime() - joinTime.getTime();
          const durationMin = Math.round(durationMs / 60_000);
          const dateKey = format(event.timestamp, "yyyy-MM-dd");
          minutesPerDay.set(dateKey, (minutesPerDay.get(dateKey) ?? 0) + durationMin);
        }
      }
    }
    const voiceActivity = Array.from(minutesPerDay.entries()).map(
      ([date, minutes]) => ({ date, minutes })
    );

    // --- Member snapshots ---
    const snapshots = await prisma.memberSnapshot.findMany({
      where: { guildId, timestamp: { gte: since } },
      orderBy: { timestamp: "asc" },
      select: { memberCount: true, timestamp: true },
    });

    const memberSnapshot = snapshots.map((s) => ({
      date: format(s.timestamp, "yyyy-MM-dd HH:mm"),
      count: s.memberCount,
    }));

    return NextResponse.json({
      memberGrowth,
      messageVolume,
      voiceActivity,
      memberSnapshot,
    });
  } catch (error) {
    console.error(`[GET /api/guilds/${guildId}/analytics]`, error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
