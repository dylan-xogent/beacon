import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserGuilds, filterManageableGuilds, guildIconUrl } from "@/lib/discord-api";
import { prisma } from "@beacon/db";

/**
 * GET /api/guilds
 * Returns the list of guilds the user manages AND where Beacon is installed.
 */
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userGuilds = await getUserGuilds(session.accessToken);
    const manageable = filterManageableGuilds(userGuilds);
    const manageableIds = manageable.map((g) => g.id);

    // Find which of those guilds have Beacon installed
    const installedGuilds = await prisma.guild.findMany({
      where: { id: { in: manageableIds } },
      select: { id: true, name: true, iconUrl: true, memberCount: true, installedAt: true },
    });

    const installedIds = new Set(installedGuilds.map((g) => g.id));

    const result = manageable
      .filter((g) => installedIds.has(g.id))
      .map((g) => {
        const dbGuild = installedGuilds.find((dg) => dg.id === g.id);
        return {
          id: g.id,
          name: g.name,
          icon: guildIconUrl(g.id, g.icon) ?? dbGuild?.iconUrl ?? null,
          memberCount: dbGuild?.memberCount ?? 0,
          installedAt: dbGuild?.installedAt ?? null,
        };
      });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[GET /api/guilds]", error);
    return NextResponse.json(
      { error: "Failed to fetch guilds" },
      { status: 500 }
    );
  }
}
