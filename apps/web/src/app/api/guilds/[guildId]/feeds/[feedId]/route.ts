import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireGuildManage } from "@/lib/discord-api";
import { prisma } from "@beacon/db";

interface Params {
  params: { guildId: string; feedId: string };
}

/**
 * DELETE /api/guilds/[guildId]/feeds/[feedId]
 * Soft-deletes (deactivates) a feed subscription.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: Params
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guildId, feedId } = params;

  try {
    await requireGuildManage(session.accessToken, guildId);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const feed = await prisma.feedSubscription.findFirst({
    where: { id: feedId, guildId },
  });

  if (!feed) {
    return NextResponse.json({ error: "Feed not found" }, { status: 404 });
  }

  try {
    await prisma.feedSubscription.update({
      where: { id: feedId },
      data: { active: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[DELETE /api/guilds/${guildId}/feeds/${feedId}]`, error);
    return NextResponse.json({ error: "Failed to delete feed" }, { status: 500 });
  }
}
