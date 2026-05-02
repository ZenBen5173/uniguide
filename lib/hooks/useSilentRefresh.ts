/**
 * useSilentRefresh — re-fire a refetch callback periodically and on
 * tab/window visibility changes WITHOUT touching the page's loading state.
 *
 * Why this exists: many of UniGuide's pages mutate data via Supabase from
 * other tabs / other users (coordinator decides → student sees status flip;
 * admin creates a procedure → it should appear in the catalogue). Realtime
 * publications cover applications/steps/letters/messages, but a number of
 * tables aren't in the publication (procedures, application_briefings,
 * application_decisions, application_coordinator_notes, glm_reasoning_trace)
 * or aren't subscribed to from the relevant page. The user reported:
 *   "throughout the system i see a lot of changes not showing and its okay
 *    after a refresh, so do a silent refresh for all necessary pages".
 *
 * This hook is the simple, low-risk fix: call the page's existing refetch
 * function on a ~30s interval AND when the tab regains focus / becomes
 * visible. No loading spinner, no flicker — data just freshens in place.
 *
 * Usage:
 *   const refresh = async () => { ...fetch... setData(...) };
 *   useSilentRefresh(refresh);            // default: 30s + focus + visibility
 *   useSilentRefresh(refresh, 15000);     // 15s
 *   useSilentRefresh(refresh, { intervalMs: 60000, onFocus: false });
 *
 * The page's existing refresh function should NOT set a loading flag in the
 * silent path. Either keep the loading flag only on initial load (most
 * pages already do this — they have a separate useEffect for the first
 * fetch), or pass a wrapper that skips the loading state.
 */

"use client";

import { useEffect, useRef } from "react";

interface SilentRefreshOptions {
  /** Polling interval in milliseconds. Default 30_000 (30s). 0 disables polling. */
  intervalMs?: number;
  /** Refetch when window regains focus. Default true. */
  onFocus?: boolean;
  /** Refetch when document.visibilityState becomes "visible". Default true. */
  onVisible?: boolean;
}

export function useSilentRefresh(
  refetch: () => void | Promise<void>,
  options: number | SilentRefreshOptions = {}
): void {
  const opts: SilentRefreshOptions =
    typeof options === "number" ? { intervalMs: options } : options;
  const intervalMs = opts.intervalMs ?? 30_000;
  const onFocus = opts.onFocus ?? true;
  const onVisible = opts.onVisible ?? true;

  // Latest refetch ref — keeps the timer / event handlers stable while the
  // closure they call always sees the current state setters.
  const refetchRef = useRef(refetch);
  useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);

  // Skip the very first focus/visibility fire so we don't double-fetch right
  // after the page mounts (the page's own initial useEffect already loads).
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = false;
    // Allow handlers to fire after a short delay — long enough for the
    // initial fetch to be in flight.
    const t = setTimeout(() => { mountedRef.current = true; }, 1000);
    return () => clearTimeout(t);
  }, []);

  // Polling
  useEffect(() => {
    if (intervalMs <= 0) return;
    const id = window.setInterval(() => {
      // Don't poll while the tab is hidden — Chrome throttles timers
      // anyway, and a poll on a backgrounded tab is wasted work.
      if (document.visibilityState === "hidden") return;
      void Promise.resolve(refetchRef.current()).catch(() => {});
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  // Focus + visibility
  useEffect(() => {
    if (!onFocus && !onVisible) return;
    const trigger = () => {
      if (!mountedRef.current) return;
      void Promise.resolve(refetchRef.current()).catch(() => {});
    };
    const onVis = () => {
      if (document.visibilityState === "visible") trigger();
    };
    if (onFocus) window.addEventListener("focus", trigger);
    if (onVisible) document.addEventListener("visibilitychange", onVis);
    return () => {
      if (onFocus) window.removeEventListener("focus", trigger);
      if (onVisible) document.removeEventListener("visibilitychange", onVis);
    };
  }, [onFocus, onVisible]);
}
