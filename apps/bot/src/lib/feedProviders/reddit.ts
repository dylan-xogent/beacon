export interface RedditPost {
  id: string; // fullname, e.g. t3_abc123
  title: string;
  url: string;
  permalink: string;
  author: string;
  subreddit: string;
  score: number;
  thumbnail: string | null;
  isNsfw: boolean;
  createdUtc: number;
}

/**
 * Fetches the newest posts from a subreddit using Reddit's public JSON API.
 * No authentication required.
 *
 * @param subreddit - Subreddit name without the r/ prefix
 * @param lastItemId - Fullname (e.g. t3_abc123) of the last post we notified about
 * @returns The newest post if it is newer than lastItemId, otherwise null
 */
export async function fetchLatestRedditPost(
  subreddit: string,
  lastItemId: string | null
): Promise<RedditPost | null> {
  const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/new.json?limit=5`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Beacon-Bot/1.0 (self-hosted Discord bot)",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(
      `Reddit fetch failed: ${response.status} ${response.statusText}`
    );
  }

  const json = (await response.json()) as {
    data: {
      children: Array<{
        data: {
          name: string;
          title: string;
          url: string;
          permalink: string;
          author: string;
          subreddit: string;
          score: number;
          thumbnail: string;
          over_18: boolean;
          created_utc: number;
        };
      }>;
    };
  };

  const posts = json.data.children;
  if (!posts || posts.length === 0) return null;

  const latest = posts[0].data;

  if (latest.name === lastItemId) return null;

  const thumbnail =
    latest.thumbnail &&
    latest.thumbnail !== "self" &&
    latest.thumbnail !== "default" &&
    latest.thumbnail !== "nsfw" &&
    latest.thumbnail.startsWith("http")
      ? latest.thumbnail
      : null;

  return {
    id: latest.name,
    title: latest.title,
    url: latest.url,
    permalink: `https://www.reddit.com${latest.permalink}`,
    author: latest.author,
    subreddit: latest.subreddit,
    score: latest.score,
    thumbnail,
    isNsfw: latest.over_18,
    createdUtc: latest.created_utc,
  };
}
