import type { CreateConfigValues } from "@paperclipai/adapter-utils";

function parseEnvVars(value: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of value.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  return env;
}

export function buildOmpLocalConfig(v: CreateConfigValues): Record<string, unknown> {
  const ac: Record<string, unknown> = {};
  if (v.cwd) ac.cwd = v.cwd;
  if (v.command) ac.command = v.command;
  if (v.model) ac.model = v.model;
  if (v.thinkingEffort) ac.thinking = v.thinkingEffort;
  if (v.promptTemplate) ac.promptTemplate = v.promptTemplate;
  if (v.extraArgs) ac.extraArgs = v.extraArgs.split(/\s+/).filter(Boolean);
  if (v.envVars) ac.env = parseEnvVars(v.envVars);
  return ac;
}
