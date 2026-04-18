/**
 * Load a versioned system prompt from lib/glm/prompts/<name>.md.
 *
 * Prompts live as separate files so they can be diffed in PRs and hashed
 * for the audit trail. Never inline a system prompt in an endpoint file.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const cache = new Map<string, string>();

export function loadPrompt(name: string): string {
  const cached = cache.get(name);
  if (cached) return cached;

  const path = join(process.cwd(), "lib", "glm", "prompts", `${name}.md`);
  const content = readFileSync(path, "utf-8").trim();
  cache.set(name, content);
  return content;
}
