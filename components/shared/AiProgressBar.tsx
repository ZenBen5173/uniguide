"use client";

/**
 * AiProgressBar — a soft, indeterminate-but-time-aware progress bar shown
 * whenever the UI is waiting on a GLM call.
 *
 * Z.AI calls take 10-60 seconds depending on load. Showing a static spinner
 * for that long looks broken. This bar:
 *   • Animates from 0% to 95% over the expected duration (default 25 s),
 *     so the student/coordinator can see something is happening.
 *   • Asymptotes near 95% rather than completing — so we don't lie about
 *     finishing. The caller sets `done` (or unmounts) when the call
 *     actually returns.
 *   • Optionally cycles through stage labels at fixed times — useful for
 *     multi-call flows like preview-letter (Drafting -> Judging).
 *
 * Pure presentational; takes no GLM dependencies. Works on every spinner.
 */

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

export interface ProgressStage {
  /** Seconds elapsed when this stage's label kicks in. */
  at: number;
  label: string;
}

export interface AiProgressBarProps {
  /** Total expected duration in ms. Bar reaches ~95% at this mark. */
  expectedMs?: number;
  /** Optional list of {at, label} stage labels (seconds). */
  stages?: ProgressStage[];
  /** Override the auto-advancing label. Use null to fall back to stages. */
  label?: string | null;
  /** Single-line caption shown below the bar. Use it for the "Z.AI calls
   *  take 10-60 seconds…" reassurance copy. */
  caption?: string;
  /** Compact horizontal mode for inline use. Default false (full block). */
  compact?: boolean;
}

export default function AiProgressBar({
  expectedMs = 25_000,
  stages,
  label,
  caption,
  compact = false,
}: AiProgressBarProps) {
  const [pct, setPct] = useState(2);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      setElapsedSec(Math.floor(elapsed / 1000));
      // Asymptotic curve: 95 * (1 - exp(-elapsed / expectedMs * 3)).
      // Reaches ~95% at expectedMs, never crosses 95.
      const ratio = elapsed / expectedMs;
      const next = Math.min(95, 95 * (1 - Math.exp(-ratio * 3)));
      setPct(Math.max(2, next));
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [expectedMs]);

  const stageLabel = (() => {
    if (label) return label;
    if (!stages || stages.length === 0) return null;
    const matching = [...stages].reverse().find((s) => elapsedSec >= s.at);
    return matching?.label ?? stages[0].label;
  })();

  if (compact) {
    return (
      <div className="flex items-center gap-2 w-full">
        <Sparkles className="h-3.5 w-3.5 text-ai-ink flex-shrink-0" strokeWidth={2.25} />
        <div className="flex-1 h-[3px] rounded-full bg-line-2 overflow-hidden">
          <div
            className="h-full bg-ai-ink rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        {stageLabel && (
          <span className="text-[11px] text-ai-ink font-medium whitespace-nowrap">
            {stageLabel}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-6 px-4">
      <div className="flex items-center gap-1.5 text-ai-ink">
        <Sparkles className="h-4 w-4 animate-pulse" strokeWidth={2.25} />
        <span className="text-[12.5px] font-semibold">
          {stageLabel ?? "Working with the AI…"}
        </span>
      </div>

      <div className="w-full max-w-md h-[6px] rounded-full bg-line-2 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-ai-ink to-ai-ink/70 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center gap-2 text-[11px] text-ink-4 mono">
        <span>{Math.round(pct)}%</span>
        <span className="opacity-50">·</span>
        <span>{elapsedSec}s elapsed</span>
      </div>

      {caption && (
        <div className="text-[12px] text-ink-4 text-center max-w-md leading-snug">
          {caption}
        </div>
      )}
    </div>
  );
}
