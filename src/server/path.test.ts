import path from "node:path";
import { describe, expect, it } from "vitest";
import { ensureLocalOmpPath } from "./path.js";

describe("ensureLocalOmpPath", () => {
  it("prepends common local CLI directories so omp is resolvable from GUI-launched Paperclip", () => {
    const env = ensureLocalOmpPath({ PATH: "/usr/bin:/bin" }, "/Users/agent");

    expect(env.PATH.split(path.delimiter).slice(0, 4)).toEqual([
      "/Users/agent/.bun/bin",
      "/Users/agent/.local/bin",
      "/opt/homebrew/bin",
      "/usr/local/bin",
    ]);
  });

  it("does not duplicate entries already present", () => {
    const env = ensureLocalOmpPath({ PATH: "/Users/agent/.bun/bin:/usr/bin" }, "/Users/agent");

    expect(env.PATH.split(path.delimiter).filter((entry) => entry === "/Users/agent/.bun/bin")).toHaveLength(1);
  });
});
