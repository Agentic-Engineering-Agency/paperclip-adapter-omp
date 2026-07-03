import type { TranscriptEntry } from "@paperclipai/adapter-utils";

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function parseLine(line: string): Record<string, unknown> | null {
  try { return asRecord(JSON.parse(line)); } catch { return null; }
}

function textFromContent(content: unknown, type: "text" | "thinking"): string {
  if (!Array.isArray(content)) return "";
  return content.map((raw) => {
    const block = asRecord(raw);
    if (!block || block.type !== type) return "";
    return typeof block.text === "string" ? block.text : "";
  }).join("");
}

function usageEntry(message: Record<string, unknown>, ts: string, text: string): TranscriptEntry | null {
  const usage = asRecord(message.usage);
  if (!usage) return null;
  const cost = asRecord(usage.cost);
  return {
    kind: "result",
    ts,
    text,
    inputTokens: typeof usage.input === "number" ? usage.input : 0,
    outputTokens: typeof usage.output === "number" ? usage.output : 0,
    cachedTokens: typeof usage.cacheRead === "number" ? usage.cacheRead : 0,
    costUsd: cost && typeof cost.total === "number" ? cost.total : 0,
    subtype: typeof message.stopReason === "string" ? message.stopReason : "success",
    isError: false,
    errors: [],
  };
}

export function parseOmpStdoutLine(line: string, ts: string): TranscriptEntry[] {
  const parsed = parseLine(line);
  if (!parsed) return [{ kind: "stdout", ts, text: line }];
  const type = typeof parsed.type === "string" ? parsed.type : "";

  if (type === "session") {
    return [{ kind: "init", ts, model: "omp", sessionId: typeof parsed.id === "string" ? parsed.id : "" }];
  }
  if (type === "agent_start" || type === "turn_start") {
    return [{ kind: "system", ts, text: type }];
  }

  const msg = asRecord(parsed.message);
  if (msg) {
    const role = typeof msg.role === "string" ? msg.role : "";
    const text = textFromContent(msg.content, "text");
    const thinking = textFromContent(msg.content, "thinking");
    const entries: TranscriptEntry[] = [];
    if (role === "user" && text) entries.push({ kind: "user", ts, text });
    if (role === "assistant") {
      if (thinking) entries.push({ kind: "thinking", ts, text: thinking });
      if (text) entries.push({ kind: "assistant", ts, text });
      if (type === "message_end") {
        const result = usageEntry(msg, ts, text);
        if (result) entries.push(result);
      }
    }
    if (entries.length > 0) return entries;
  }

  if (type === "error") return [{ kind: "result", ts, text: line, inputTokens: 0, outputTokens: 0, cachedTokens: 0, costUsd: 0, subtype: "error", isError: true, errors: [line] }];
  return [{ kind: "stdout", ts, text: line }];
}
