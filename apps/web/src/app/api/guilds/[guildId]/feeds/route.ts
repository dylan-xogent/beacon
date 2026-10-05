import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireGuildManage } from "@/lib/discord-api";
import { prisma } from "@beacon/db";


function isPublicHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) return false;
    if (/^\[?(::1?|f[cd][0-9a-f]{2}:|fe[89ab][0-9a-f]:)/.test(h)) return false;
    const m = h.match(/^(\d+)\.(\d+)\.\d+\.\d+$/);
    if (m) {
      const a = Number(m[1]), b = Number(m[2]);
      if (a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

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

  if (type === "RSS" && !isPublicHttpUrl(sourceId)) {
    return NextResponse.json(
      { error: "RSS source must be a public http:// or https:// URL" },
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
