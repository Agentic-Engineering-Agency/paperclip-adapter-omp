import { describe, expect, it } from "vitest";
import { isOmpUnknownSessionError, parseOmpStreamJson } from "./parse.js";
import { sessionCodec } from "./index.js";

const sample = [
  { type: "session", id: "019f28c1-ba31-7000-98fc-d8c06be525da" },
  { type: "message_end", message: { role: "assistant", content: [{ type: "text", text: "pong" }], provider: "omniroute", model: "omp-fast", usage: { input: 10, output: 2, cacheRead: 3, cost: { total: 0.01 } }, stopReason: "stop" } },
].map((v) => JSON.stringify(v)).join("\n");

describe("parseOmpStreamJson", () => {
  it("extracts session, summary, model, provider, usage and cost", () => {
    const parsed = parseOmpStreamJson(sample);
    expect(parsed.sessionId).toBe("019f28c1-ba31-7000-98fc-d8c06be525da");
    expect(parsed.summary).toBe("pong");
    expect(parsed.provider).toBe("omniroute");
    expect(parsed.model).toBe("omp-fast");
    expect(parsed.usage).toEqual({ inputTokens: 10, outputTokens: 2, cachedInputTokens: 3 });
    expect(parsed.costUsd).toBe(0.01);
  });

  it("returns an empty parsed shape for empty stdout", () => {
    expect(parseOmpStreamJson("")).toEqual({
      sessionId: null,
      provider: null,
      model: null,
      costUsd: null,
      usage: null,
      summary: "",
      resultJson: null,
      errorMessage: null,
    });
  });

  it("ignores malformed JSON lines while parsing later valid events", () => {
    const parsed = parseOmpStreamJson([
      "not json",
      JSON.stringify({ type: "session", id: "session-after-bad-line" }),
      JSON.stringify({ type: "message_end", message: { role: "assistant", content: "ok" } }),
    ].join("\n"));

    expect(parsed.sessionId).toBe("session-after-bad-line");
    expect(parsed.summary).toBe("ok");
    expect(parsed.errorMessage).toBeNull();
  });

  it("extracts error text from malformed runs that still emit JSON error events", () => {
    const parsed = parseOmpStreamJson([
      "partial non-json output",
      JSON.stringify({ type: "error", message: "ignored", error: { message: "could not find session missing-123" } }),
    ].join("\n"));

    expect(parsed.errorMessage).toBe("could not find session missing-123");
    expect(isOmpUnknownSessionError(parsed.errorMessage)).toBe(true);
  });
});

describe("isOmpUnknownSessionError", () => {
  it("detects missing session errors", () => {
    expect(isOmpUnknownSessionError("could not find session abc123")).toBe(true);
  });

  it("does not classify unrelated errors as unknown sessions", () => {
    expect(isOmpUnknownSessionError("permission denied opening config file")).toBe(false);
  });
});

describe("sessionCodec", () => {
  it("round trips session params", () => {
    const params = { sessionId: "abc", cwd: "/tmp/project" };
    expect(sessionCodec.deserialize(sessionCodec.serialize(params))).toEqual(params);
    expect(sessionCodec.getDisplayId?.(params)).toBe("abc");
  });
});
