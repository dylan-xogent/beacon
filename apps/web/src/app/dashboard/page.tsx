import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import { GuildCard } from "@/components/GuildCard";
import { Button } from "@/components/ui/Button";

interface Guild {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session) {
    redirect("/");
  }

  // Call internal API — or query DB directly here
  const { getUserGuilds, filterManageableGuilds, guildIconUrl } = await import(
    "@/lib/discord-api"
  );
  const { prisma } = await import("@beacon/db");

  let guilds: Guild[] = [];
  try {
    const userGuilds = await getUserGuilds(session.accessToken);
    const manageable = filterManageableGuilds(userGuilds);
    const manageableIds = manageable.map((g) => g.id);

    const installed = await prisma.guild.findMany({
      where: { id: { in: manageableIds } },
      select: { id: true, name: true, iconUrl: true, memberCount: true },
    });

    const installedIds = new Set(installed.map((g) => g.id));

    guilds = manageable
      .filter((g) => installedIds.has(g.id))
      .map((g) => {
        const db = installed.find((d) => d.id === g.id);
        return {
          id: g.id,
          name: g.name,
          icon: guildIconUrl(g.id, g.icon) ?? db?.iconUrl ?? null,
          memberCount: db?.memberCount ?? 0,
        };
      });
  } catch (err) {
    console.error("[Dashboard] Failed to fetch guilds:", err);
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Top nav */}
      <nav className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔦</span>
            <span className="text-lg font-bold text-white">Beacon</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400 hidden sm:block">
              {session.user.name}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <Button variant="ghost" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Your Servers</h1>
          <p className="text-gray-400 text-sm">
            Select a server to view its analytics dashboard.
          </p>
        </div>

        {guilds.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-700 p-12 text-center">
            <p className="text-4xl mb-4">🔦</p>
            <h2 className="text-lg font-semibold text-white mb-2">
              No servers found
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              Beacon isn&apos;t installed in any server you manage. Invite the bot first.
            </p>
            <a
              href={`https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&permissions=8&scope=bot+applications.commands`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button>Invite Beacon to a Server</Button>
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {guilds.map((guild) => (
              <GuildCard
                key={guild.id}
                id={guild.id}
                name={guild.name}
                icon={guild.icon}
                memberCount={guild.memberCount}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
