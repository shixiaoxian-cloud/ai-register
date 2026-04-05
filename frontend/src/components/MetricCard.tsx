import { StatusPill } from "./StatusPill";
import type { Tone } from "../lib/types";

interface MetricCardProps {
  label: string;
  value: string | number;
  detail: string;
  tone?: Tone;
}

export function MetricCard({ label, value, detail, tone = "neutral" }: MetricCardProps) {
  return (
    <article className="metric-card">
      <StatusPill tone={tone}>{label}</StatusPill>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}
