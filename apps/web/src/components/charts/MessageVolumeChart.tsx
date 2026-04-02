"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface MessageVolumePoint {
  date: string;
  channelId: string;
  channelName: string;
  count: number;
}

interface MessageVolumeProps {
  data: MessageVolumePoint[];
}

// Generate a consistent color for each channel ID
function channelColor(channelId: string): string {
  const colors = [
    "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
    "#f97316", "#eab308", "#22c55e", "#06b6d4",
    "#3b82f6", "#a855f7",
  ];
  let hash = 0;
  for (const ch of channelId) {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return colors[hash % colors.length];
}

export function MessageVolumeChart({ data }: MessageVolumeProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-500 text-sm">
        No messages recorded yet.
      </div>
    );
  }

  // Pivot data: group by date, with one key per channel
  const channelIds = [...new Set(data.map((d) => d.channelId))];
  const channelNames: Record<string, string> = {};
  for (const d of data) {
    channelNames[d.channelId] = d.channelName;
  }

  const dates = [...new Set(data.map((d) => d.date))].sort();
  const pivoted = dates.map((date) => {
    const row: Record<string, string | number> = { date };
    for (const cid of channelIds) {
      const entry = data.find((d) => d.date === date && d.channelId === cid);
      row[cid] = entry?.count ?? 0;
    }
    return row;
  });

  // Only show top 8 channels by total messages to avoid clutter
  const channelTotals = channelIds.map((cid) => ({
    cid,
    total: data.filter((d) => d.channelId === cid).reduce((s, d) => s + d.count, 0),
  }));
  channelTotals.sort((a, b) => b.total - a.total);
  const topChannels = channelTotals.slice(0, 8).map((c) => c.cid);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={pivoted} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          tickFormatter={(val: string) => {
            const parts = val.split("-");
            return `${parts[1]}/${parts[2]}`;
          }}
        />
        <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} width={45} />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1f2937",
            border: "1px solid #374151",
            borderRadius: "8px",
            color: "#f9fafb",
          }}
        />
        <Legend
          formatter={(value) => channelNames[value] ?? value}
          wrapperStyle={{ fontSize: "11px" }}
        />
        {topChannels.map((cid) => (
          <Bar
            key={cid}
            dataKey={cid}
            stackId="a"
            fill={channelColor(cid)}
            name={channelNames[cid] ?? cid}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
