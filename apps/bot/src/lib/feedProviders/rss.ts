import Parser from "rss-parser";

export interface RssItem {
  id: string; // guid or link
  title: string;
  url: string;
  author: string | null;
  publishedAt: string | null;
  contentSnippet: string | null;
}

const rssParser = new Parser({
  timeout: 10_000,
  headers: { "User-Agent": "Beacon-Bot/1.0" },
});

/**
 * Fetches the latest item from a generic RSS or Atom feed.
 *
 * @param feedUrl - Full URL of the RSS/Atom feed
 * @param lastItemId - GUID or link of the last item we notified about
 * @returns The latest item if it differs from lastItemId, otherwise null
 */
export async function fetchLatestRssItem(
  feedUrl: string,
  lastItemId: string | null
): Promise<RssItem | null> {
  const feed = await rssParser.parseURL(feedUrl);

  if (!feed.items || feed.items.length === 0) return null;

  const latest = feed.items[0];
  const id = latest.guid ?? latest.link ?? latest.title ?? "";

  if (!id || id === lastItemId) return null;

  return {
    id,
    title: latest.title ?? "Untitled",
    url: latest.link ?? feedUrl,
    author: latest.creator ?? latest.author ?? null,
    publishedAt: latest.pubDate ?? latest.isoDate ?? null,
    contentSnippet: latest.contentSnippet?.slice(0, 300) ?? null,
  };
}
