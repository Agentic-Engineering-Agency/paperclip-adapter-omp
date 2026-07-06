import { execFile } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_OMNIROUTE_MODELS } from "../model-catalog.js";
import { clearOmniRouteModelCacheForTest, discoverOmniRouteModels, listOmniRouteModels, mapGatewayCatalog, mapOmpCatalog } from "./models.js";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

const execFileMock = vi.mocked(execFile);

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  clearOmniRouteModelCacheForTest();
});

function mockExecFileResult(stdout: string) {
  execFileMock.mockImplementation(((_file, _args, _options, callback) => {
    callback(null, { stdout, stderr: "" });
  }) as typeof execFile);
}

function mockExecFileError(error: Error) {
  execFileMock.mockImplementation(((_file, _args, _options, callback) => {
    callback(error, { stdout: "", stderr: error.message });
  }) as typeof execFile);
}

function mockFetch(json: unknown, ok = true) {
  const fetchMock = vi.fn(async () => ({
    ok,
    json: async () => json,
  })) as unknown as typeof fetch;
  vi.stubGlobal("fetch", fetchMock);
  return vi.mocked(fetchMock);
}

describe("mapOmpCatalog", () => {
  it("maps selector to id and name to label when name differs from id", () => {
    const result = mapOmpCatalog({ models: [{ selector: "omniroute/x", name: "X Model", id: "x" }] });
    expect(result).toEqual([{ id: "omniroute/x", label: "X Model" }]);
  });

  it("dedupes entries with the same selector, keeping the first occurrence", () => {
    const result = mapOmpCatalog({
      models: [
        { selector: "omniroute/x", name: "First", id: "x" },
        { selector: "omniroute/x", name: "Second", id: "x" },
      ],
    });
    expect(result).toEqual([{ id: "omniroute/x", label: "First" }]);
  });

  it("disambiguates duplicate labels with the raw id in parentheses", () => {
    const result = mapOmpCatalog({
      models: [
        { selector: "omniroute/a", name: "Same Name", id: "a" },
        { selector: "omniroute/b", name: "Same Name", id: "b" },
      ],
    });
    expect(result).toEqual([
      { id: "omniroute/a", label: "Same Name (a)" },
      { id: "omniroute/b", label: "Same Name (b)" },
    ]);
  });

  it("falls back to the raw id as label when name equals id", () => {
    const result = mapOmpCatalog({ models: [{ selector: "omniroute/x", name: "x", id: "x" }] });
    expect(result).toEqual([{ id: "omniroute/x", label: "x" }]);
  });

  it("sorts results ascending by id", () => {
    const result = mapOmpCatalog({
      models: [
        { selector: "omniroute/zeta", name: "Zeta", id: "zeta" },
        { selector: "omniroute/alpha", name: "Alpha", id: "alpha" },
      ],
    });
    expect(result.map((m) => m.id)).toEqual(["omniroute/alpha", "omniroute/zeta"]);
  });

  it("skips entries missing a selector while keeping valid ones", () => {
    const result = mapOmpCatalog({
      models: [
        { name: "No Selector", id: "x" },
        { selector: "omniroute/y", name: "Y", id: "y" },
      ],
    });
    expect(result).toEqual([{ id: "omniroute/y", label: "Y" }]);
  });

  it.each([
    ["null", null],
    ["a string", "not an object"],
    ["an empty object", {}],
    ["models not an array", { models: "nope" }],
    ["an empty models array", { models: [] }],
  ])("returns [] for %s", (_desc, input) => {
    expect(mapOmpCatalog(input)).toEqual([]);
  });
});

describe("mapGatewayCatalog", () => {
  it("maps id to an omniroute-prefixed id with the raw id as label", () => {
    const result = mapGatewayCatalog({ data: [{ id: "cc/claude" }] });
    expect(result).toEqual([{ id: "omniroute/cc/claude", label: "cc/claude" }]);
  });

  it("dedupes entries with the same id, keeping the first occurrence", () => {
    const result = mapGatewayCatalog({ data: [{ id: "cc/claude" }, { id: "cc/claude" }] });
    expect(result).toEqual([{ id: "omniroute/cc/claude", label: "cc/claude" }]);
  });

  it("sorts results ascending by id", () => {
    const result = mapGatewayCatalog({ data: [{ id: "zeta" }, { id: "alpha" }] });
    expect(result.map((m) => m.id)).toEqual(["omniroute/alpha", "omniroute/zeta"]);
  });

  it.each([
    ["null", null],
    ["a string", "not an object"],
    ["an empty object", {}],
    ["data not an array", { data: "nope" }],
  ])("returns [] for %s", (_desc, input) => {
    expect(mapGatewayCatalog(input)).toEqual([]);
  });
});

describe("discoverOmniRouteModels", () => {
  it("uses omp-cli models when the omp catalog command succeeds", async () => {
    mockExecFileResult(JSON.stringify({ models: [{ selector: "omniroute/omp", name: "OMP", id: "omp" }] }));
    const fetchMock = mockFetch({ data: [{ id: "gateway" }] });

    await expect(discoverOmniRouteModels()).resolves.toEqual({
      source: "omp-cli",
      models: [{ id: "omniroute/omp", label: "OMP" }],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls through to the gateway when omp-cli discovery fails", async () => {
    mockExecFileError(new Error("omp unavailable"));
    vi.stubEnv("OMNIROUTE_API_KEY", "test-key");
    mockFetch({ data: [{ id: "gateway" }] });

    await expect(discoverOmniRouteModels()).resolves.toEqual({
      source: "gateway",
      models: [{ id: "omniroute/gateway", label: "gateway" }],
    });
  });

  it("falls through to static defaults when omp-cli and gateway discovery fail", async () => {
    mockExecFileError(new Error("omp unavailable"));
    vi.stubEnv("OMNIROUTE_API_KEY", "test-key");
    mockFetch({ data: [{ id: "gateway" }] }, false);

    await expect(discoverOmniRouteModels()).resolves.toEqual({
      source: "static",
      models: DEFAULT_OMNIROUTE_MODELS,
    });
  });
});

describe("listOmniRouteModels", () => {
  it("returns the cached catalog within five minutes and refreshes after the TTL expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    mockExecFileResult(JSON.stringify({ models: [{ selector: "omniroute/first", name: "First", id: "first" }] }));

    await expect(listOmniRouteModels()).resolves.toEqual([{ id: "omniroute/first", label: "First" }]);

    mockExecFileResult(JSON.stringify({ models: [{ selector: "omniroute/second", name: "Second", id: "second" }] }));
    vi.setSystemTime(299_999);
    await expect(listOmniRouteModels()).resolves.toEqual([{ id: "omniroute/first", label: "First" }]);
    expect(execFileMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(300_000);
    await expect(listOmniRouteModels()).resolves.toEqual([{ id: "omniroute/second", label: "Second" }]);
    expect(execFileMock).toHaveBeenCalledTimes(2);
  });
});
