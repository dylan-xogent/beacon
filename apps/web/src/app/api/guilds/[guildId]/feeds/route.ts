import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireGuildManage } from "@/lib/discord-api";
import { prisma } from "@beacon/db";

interface Params {
  params: { guildId: string };
}

const VALID_FEED_TYPES = ["YOUTUBE", "TWITCH", "REDDIT", "RSS"] as const;
type FeedType = (typeof VALID_FEED_TYPES)[number];

/**
 * GET /api/guilds/[guildId]/feeds
 * Returns all feed subscriptions for the guild.
 */
export async function GET(
  _request: NextRequest,
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

  try {
    const feeds = await prisma.feedSubscription.findMany({
      where: { guildId, active: true },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(feeds);
  } catch (error) {
    console.error(`[GET /api/guilds/${guildId}/feeds]`, error);
    return NextResponse.json({ error: "Failed to fetch feeds" }, { status: 500 });
  }
}

/**
 * POST /api/guilds/[guildId]/feeds
 * Creates a new feed subscription.
 *
 * Body: { type, sourceId, channelId, displayName? }
 */
export async function POST(
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { type, sourceId, channelId, displayName } = body as Record<string, string>;

  if (!type || !sourceId || !channelId) {
    return NextResponse.json(
      { error: "Missing required fields: type, sourceId, channelId" },
      { status: 400 }
    );
  }

  if (!VALID_FEED_TYPES.includes(type as FeedType)) {
    return NextResponse.json(
      { error: `Invalid feed type. Must be one of: ${VALID_FEED_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  if (type === "RSS" && !sourceId.startsWith("http")) {
    return NextResponse.json(
      { error: "RSS source must be a valid URL starting with http:// or https://" },
      { status: 400 }
    );
  }

  // Check guild subscription limit
  const count = await prisma.feedSubscription.count({
    where: { guildId, active: true },
  });

  if (count >= 25) {
    return NextResponse.json(
      { error: "This server has reached the maximum of 25 active feed subscriptions." },
      { status: 422 }
    );
  }

  try {
    const feed = await prisma.feedSubscription.create({
      data: {
        guildId,
        channelId,
        type,
        sourceId: sourceId.trim(),
        displayName: displayName?.trim() || null,
        active: true,
      },
    });

    return NextResponse.json(feed, { status: 201 });
  } catch (error) {
    console.error(`[POST /api/guilds/${guildId}/feeds]`, error);
    return NextResponse.json({ error: "Failed to create feed" }, { status: 500 });
  }
}
