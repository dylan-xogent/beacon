"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

interface DeleteFeedButtonProps {
  guildId: string;
  feedId: string;
}

export function DeleteFeedButton({ guildId, feedId }: DeleteFeedButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete(): Promise<void> {
    if (!confirm("Remove this feed subscription? Notifications will stop immediately.")) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/guilds/${guildId}/feeds/${feedId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      router.refresh();
    } catch (err) {
      console.error("Delete feed error:", err);
      alert("Failed to remove feed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="danger"
      size="sm"
      loading={loading}
      onClick={handleDelete}
      className="flex-shrink-0"
    >
      Remove
    </Button>
  );
}
