import { XMLParser } from "fast-xml-parser";

export interface YouTubeVideo {
  id: string;
  title: string;
  url: string;
  author: string;
  publishedAt: string;
  thumbnail: string;
}

const FEED_BASE = "https://www.youtube.com/feeds/videos.xml?channel_id=";
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

/**
 * Fetches the latest video from a YouTube channel's public RSS feed.
 * No API key required.
 *
 * @param channelId - YouTube channel ID (e.g. UCxxxxxx)
 * @param lastItemId - ID of the last video we already notified about
 * @returns The latest video if it is newer than lastItemId, otherwise null
 */
export async function fetchLatestYouTubeVideo(
  channelId: string,
  lastItemId: string | null
): Promise<YouTubeVideo | null> {
  const url = `${FEED_BASE}${channelId}`;

  const response = await fetch(url, {
    headers: { "User-Agent": "Beacon-Bot/1.0" },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(
      `YouTube RSS fetch failed: ${response.status} ${response.statusText}`
    );
  }

  const xml = await response.text();
  const parsed = parser.parse(xml);

  const feed = parsed?.feed;
  if (!feed) return null;

  const entries: unknown[] = Array.isArray(feed.entry)
    ? feed.entry
    : feed.entry
    ? [feed.entry]
    : [];

  if (entries.length === 0) return null;

  const latest = entries[0] as Record<string, unknown>;
  const videoId = String(latest["yt:videoId"] ?? "");

  if (!videoId || videoId === lastItemId) return null;

  const mediaGroup = latest["media:group"] as Record<string, unknown> | undefined;
  const thumbnail =
    (mediaGroup?.["media:thumbnail"] as Record<string, string> | undefined)?.[
      "@_url"
    ] ?? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  return {
    id: videoId,
    title: String(latest.title ?? "Untitled"),
    url: `https://www.youtube.com/watch?v=${videoId}`,
    author: String(
      (latest.author as Record<string, unknown>)?.name ??
        feed.title ??
        "Unknown"
    ),
    publishedAt: String(latest.published ?? new Date().toISOString()),
    thumbnail,
  };
}
