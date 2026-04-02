"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface VoiceActivityPoint {
  date: string;
  minutes: number;
}

interface VoiceActivityProps {
  data: VoiceActivityPoint[];
}

export function VoiceActivityChart({ data }: VoiceActivityProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-500 text-sm">
        No voice activity recorded yet.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          tickFormatter={(val: string) => {
            const parts = val.split("-");
            return `${parts[1]}/${parts[2]}`;
          }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          tickFormatter={(v: number) => `${v}m`}
          width={45}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1f2937",
            border: "1px solid #374151",
            borderRadius: "8px",
            color: "#f9fafb",
          }}
          formatter={(value: number) => [`${value} min`, "Voice Activity"]}
        />
        <Bar
          dataKey="minutes"
          fill="#22c55e"
          radius={[4, 4, 0, 0]}
          name="Voice Minutes"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
