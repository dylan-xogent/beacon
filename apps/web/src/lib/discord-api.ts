const DISCORD_API_BASE = "https://discord.com/api/v10";

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  features: string[];
}

/**
 * Fetches the list of guilds the authenticated user is in via Discord's API.
 * Uses the user's OAuth2 access token.
 */
export async function getUserGuilds(accessToken: string): Promise<DiscordGuild[]> {
  const response = await fetch(`${DISCORD_API_BASE}/users/@me/guilds`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    next: { revalidate: 60 }, // Cache for 60 seconds
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Discord access token is invalid or expired.");
    }
    throw new Error(
      `Discord API error: ${response.status} ${response.statusText}`
    );
  }

  return response.json() as Promise<DiscordGuild[]>;
}

/**
 * Filters a list of Discord guilds to those where the user has MANAGE_GUILD permission.
 * Permission bit for MANAGE_GUILD is 0x20.
 */
export function filterManageableGuilds(guilds: DiscordGuild[]): DiscordGuild[] {
  const MANAGE_GUILD = BigInt(0x20);
  return guilds.filter((guild) => {
    const perms = BigInt(guild.permissions);
    return guild.owner || (perms & MANAGE_GUILD) === MANAGE_GUILD;
  });
}

/**
 * Returns the Discord CDN icon URL for a guild.
 */
export function guildIconUrl(
  guildId: string,
  iconHash: string | null
): string | null {
  if (!iconHash) return null;
  const ext = iconHash.startsWith("a_") ? "gif" : "webp";
  return `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.${ext}?size=128`;
}

/**
 * Checks whether the authenticated user can manage a specific guild.
 * Returns the guild data if authorized, throws otherwise.
 */
export async function requireGuildManage(
  accessToken: string,
  guildId: string
): Promise<DiscordGuild> {
  const guilds = await getUserGuilds(accessToken);
  const manageable = filterManageableGuilds(guilds);
  const guild = manageable.find((g) => g.id === guildId);

  if (!guild) {
    throw new Error(`Unauthorized: you do not manage guild ${guildId}`);
  }

  return guild;
}
