import { defineConfig } from "vitest/config";
import path from "node:path";

// Vitest config — only here to resolve the `@/*` alias used throughout the
// codebase. The `@/lib/supabase/server` import in trace.ts (transitively
// loaded by every GLM wrapper) needs this; without it, tests that import
// any GLM endpoint die with "Failed to load url @/lib/supabase/server".
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
  },
});
