import { describe, expect, it } from "vitest";
import { mapGatewayCatalog, mapOmpCatalog } from "./models.js";

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
