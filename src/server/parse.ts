import type { UsageSummary } from "@paperclipai/adapter-utils";
import { asNumber, asString, parseJson, parseObject } from "@paperclipai/adapter-utils/server-utils";

export interface ParsedOmpOutput {
  sessionId: string | null;
  provider: string | null;
  model: string | null;
  costUsd: number | null;
  usage: UsageSummary | null;
  summary: string;
  resultJson: Record<string, unknown> | null;
  errorMessage: string | null;
}

function contentText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const raw of content) {
    const block = parseObject(raw);
    if (!block) continue;
    const type = asString(block.type, "");
    const text = asString(block.text, "");
    if ((type === "text" || type === "thinking") && text) parts.push(text);
  }
  return parts.join("");
}

function usageFrom(value: unknown): UsageSummary | null {
  const rec = parseObject(value);
  if (!rec) return null;
  const inputTokens = asNumber(rec.input, asNumber(rec.inputTokens, 0));
  const outputTokens = asNumber(rec.output, asNumber(rec.outputTokens, 0));
  const cachedInputTokens = asNumber(rec.cacheRead, asNumber(rec.cachedInputTokens, 0));
  if (inputTokens === 0 && outputTokens === 0 && cachedInputTokens === 0) return null;
  return { inputTokens, outputTokens, cachedInputTokens };
}

function costFrom(value: unknown): number | null {
  const rec = parseObject(value);
  if (!rec) return null;
  const cost = parseObject(rec.cost);
  if (!cost) return null;
  const total = asNumber(cost.total, Number.NaN);
  return Number.isFinite(total) ? total : null;
}

function errorText(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  const rec = parseObject(value);
  if (!rec) return null;
  return (
    asString(rec.message, "") ||
    asString(rec.error, "") ||
    asString(rec.code, "") ||
    null
  );
}

export function parseOmpStreamJson(stdout: string): ParsedOmpOutput {
  let sessionId: string | null = null;
  let provider: string | null = null;
  let model: string | null = null;
  let usage: UsageSummary | null = null;
  let costUsd: number | null = null;
  let resultJson: Record<string, unknown> | null = null;
  let errorMessage: string | null = null;
  let lastAssistantText = "";

  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const event = parseJson(line);
    if (!event) continue;
    resultJson = event;
    const type = asString(event.type, "");
    if (type === "session") {
      sessionId = asString(event.id, sessionId ?? "") || (sessionId ?? null);
      continue;
    }
    const message = parseObject(event.message);
    if (message) {
      const role = asString(message.role, "");
      if (role === "assistant") {
        provider = asString(message.provider, provider ?? "") || (provider ?? null);
        model = asString(message.model, model ?? "") || (model ?? null);
        const nextUsage = usageFrom(message.usage);
        if (nextUsage) usage = nextUsage;
        const nextCost = costFrom(message.usage);
        if (nextCost !== null) costUsd = nextCost;
        const text = contentText(message.content);
        if (text) lastAssistantText = text;
      }
    }
    const err = errorText(event.error) ?? (type === "error" ? errorText(event) : null);
    if (err) errorMessage = err;
  }

  return {
    sessionId,
    provider,
    model,
    costUsd,
    usage,
    summary: lastAssistantText,
    resultJson,
    errorMessage,
  };
}

export function isOmpUnknownSessionError(stdoutOrError: string | Record<string, unknown> | null | undefined): boolean {
  const text = typeof stdoutOrError === "string" ? stdoutOrError : JSON.stringify(stdoutOrError ?? {});
  return /(?:unknown|missing|not found|could not find|no such).{0,80}(?:session|conversation|resume)|(?:session|conversation).{0,80}(?:unknown|missing|not found|expired)/i.test(text);
}
