/**
 * Banner shown across the app when GLM is running in mock-fixture mode
 * (no real Z.AI API key configured). Makes it explicit to demo viewers
 * that AI responses are pre-recorded fixtures, not live generation.
 *
 * Renders nothing when ZAI_API_KEY is set and GLM_MOCK_MODE != "true".
 */

import { Sparkles } from "lucide-react";

function isMock(): boolean {
  if (process.env.GLM_MOCK_MODE === "true") return true;
  if (process.env.GLM_MOCK_MODE === "false") return false;
  return !process.env.ZAI_API_KEY;
}

export default function DemoModeBanner() {
  if (!isMock()) return null;

  return (
    <div className="bg-ai-tint border-b border-ai-line">
      <div className="mx-auto max-w-[1440px] px-6 py-1.5 flex items-center justify-center gap-2 text-[12px] text-ai-ink">
        <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
        <span className="font-semibold uppercase tracking-wider text-[10.5px]">Demo mode</span>
        <span className="opacity-70">·</span>
        <span>AI responses are recorded fixtures from the Yayasan UM scholarship flow. Set <span className="mono">ZAI_API_KEY</span> to enable live GLM.</span>
      </div>
    </div>
  );
}
