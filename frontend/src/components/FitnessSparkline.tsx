import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";

export function FitnessSparkline({ values }: { values: number[] }) {
  const data = values.map((value, index) => ({ round: index + 1, value }));
  return (
    <div className="sparkline-shell">
      <ResponsiveContainer width="100%" height={92}>
        <LineChart data={data} margin={{ top: 8, right: 6, bottom: 8, left: 6 }}>
          <YAxis hide domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={{
              background: "#0d0d0d",
              border: "1px solid #1a1a1a",
              color: "#e8e8e8",
              fontFamily: "JetBrains Mono, Courier New, monospace",
              fontSize: 11,
              textTransform: "uppercase",
            }}
            labelFormatter={(value) => `ROUND_${String(value).padStart(2, "0")}`}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#00ffcc"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3, fill: "#00ffcc", stroke: "#080808" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
