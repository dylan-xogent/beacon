"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";

interface Channel {
  id: string;
  name: string;
}

interface FeedFormProps {
  guildId: string;
  channels: Channel[];
}

const FEED_TYPES = [
  { value: "YOUTUBE", label: "YouTube" },
  { value: "TWITCH", label: "Twitch" },
  { value: "REDDIT", label: "Reddit" },
  { value: "RSS", label: "RSS / Atom" },
];

const SOURCE_HINTS: Record<string, string> = {
  YOUTUBE: "YouTube channel ID (e.g. UCxxxxxxxxxxxxxxxxxxxxxx)",
  TWITCH: "Twitch username (e.g. shroud)",
  REDDIT: "Subreddit name without r/ (e.g. programming)",
  RSS: "Full feed URL (e.g. https://example.com/feed.xml)",
};

export function FeedForm({ guildId, channels }: FeedFormProps) {
  const router = useRouter();
  const [type, setType] = useState("YOUTUBE");
  const [sourceId, setSourceId] = useState("");
  const [channelId, setChannelId] = useState(channels[0]?.id ?? "");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const channelOptions = channels.map((ch) => ({
    value: ch.id,
    label: `#${ch.name}`,
  }));

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);

    if (!sourceId.trim()) {
      setError("Source ID is required.");
      return;
    }
    if (!channelId) {
      setError("Please select a Discord channel.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/guilds/${guildId}/feeds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          sourceId: sourceId.trim(),
          channelId,
          displayName: displayName.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to create feed.");
      }

      setSourceId("");
      setDisplayName("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Add New Feed
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Feed Type"
            options={FEED_TYPES}
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setSourceId("");
            }}
          />
          <Select
            label="Post to Channel"
            options={channelOptions}
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            placeholder={channels.length === 0 ? "No channels available" : undefined}
          />
        </div>

        <Input
          label="Source"
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
          hint={SOURCE_HINTS[type]}
          placeholder={SOURCE_HINTS[type]}
          required
        />

        <Input
          label="Display Name (optional)"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="My Favorite Channel"
          hint="A friendly name shown in notifications"
        />

        {error && (
          <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <Button type="submit" loading={loading} className="w-full sm:w-auto">
          Add Feed
        </Button>
      </form>
    </Card>
  );
}
