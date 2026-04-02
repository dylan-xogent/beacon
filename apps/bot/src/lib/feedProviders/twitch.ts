export interface TwitchStream {
  id: string;
  title: string;
  gameName: string;
  viewerCount: number;
  thumbnailUrl: string;
  startedAt: string;
  userLogin: string;
  userName: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Obtains a Twitch client-credentials OAuth token, caching it until expiry.
 */
async function getTwitchToken(
  clientId: string,
  clientSecret: string
): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }

  const response = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(
      `Twitch token fetch failed: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  cachedToken = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  return cachedToken.token;
}

/**
 * Checks whether a Twitch streamer is currently live.
 * Returns stream data if live and the stream ID differs from lastItemId,
 * otherwise returns null (offline or already notified).
 *
 * @param userLogin - Twitch username (case-insensitive)
 * @param lastItemId - Stream ID of the last notification we sent
 */
export async function fetchTwitchStream(
  userLogin: string,
  lastItemId: string | null
): Promise<TwitchStream | null> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET must be set to use Twitch feeds."
    );
  }

  const token = await getTwitchToken(clientId, clientSecret);

  const url = `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(userLogin)}`;
  const response = await fetch(url, {
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(
      `Twitch stream fetch failed: ${response.status} ${response.statusText}`
    );
  }

  const json = (await response.json()) as {
    data: Array<{
      id: string;
      title: string;
      game_name: string;
      viewer_count: number;
      thumbnail_url: string;
      started_at: string;
      user_login: string;
      user_name: string;
    }>;
  };

  const stream = json.data[0];
  if (!stream) return null; // Streamer is offline

  if (stream.id === lastItemId) return null; // Already notified

  return {
    id: stream.id,
    title: stream.title,
    gameName: stream.game_name,
    viewerCount: stream.viewer_count,
    thumbnailUrl: stream.thumbnail_url
      .replace("{width}", "1280")
      .replace("{height}", "720"),
    startedAt: stream.started_at,
    userLogin: stream.user_login,
    userName: stream.user_name,
  };
}
