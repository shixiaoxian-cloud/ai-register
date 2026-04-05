import type { ReactNode } from "react";

import type { Tone } from "../lib/types";

interface StatusPillProps {
  tone?: Tone;
  children: ReactNode;
}

export function StatusPill({ tone = "neutral", children }: StatusPillProps) {
  return <span className={`status-pill tone-${tone}`}>{children}</span>;
}
