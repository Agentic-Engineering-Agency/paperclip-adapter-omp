import { describe, expect, it } from "vitest";
import { buildOmpLocalConfig } from "./build-config.js";

describe("buildOmpLocalConfig", () => {
  it("maps create values into adapter config", () => {
    const config = buildOmpLocalConfig({
      adapterType: "omp_local",
      cwd: "/tmp/project",
      promptTemplate: "hello {{agent.name}}",
      model: "omniroute/omp-agent",
      thinkingEffort: "high",
      chrome: false,
      dangerouslySkipPermissions: false,
      search: false,
      fastMode: false,
      dangerouslyBypassSandbox: false,
      command: "omp",
      args: "",
      extraArgs: "--allow-home",
      envVars: "OMP_TEST=1",
      envBindings: {},
      url: "",
      bootstrapPrompt: "",
      maxTurnsPerRun: 0,
      heartbeatEnabled: false,
      intervalSec: 0,
    });
    expect(config).toMatchObject({ cwd: "/tmp/project", command: "omp", model: "omniroute/omp-agent", thinking: "high", extraArgs: ["--allow-home"], env: { OMP_TEST: "1" } });
  });
});
