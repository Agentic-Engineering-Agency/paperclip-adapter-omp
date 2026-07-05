import { describe, expect, it } from "vitest";
import { createServerAdapter } from "../index.js";

const wayfinderEntry = {
  key: "mattpocock/skills/wayfinder",
  runtimeName: "wayfinder",
  source: "/tmp/paperclip-skills/wayfinder",
};

describe("omp skill sync", () => {
  it("declares materialized runtime skills support", () => {
    const adapter = createServerAdapter();

    expect(adapter.requiresMaterializedRuntimeSkills).toBe(true);
    expect(adapter.listSkills).toBeTypeOf("function");
    expect(adapter.syncSkills).toBeTypeOf("function");
  });

  it("lists materialized runtime skills from adapter config", async () => {
    const adapter = createServerAdapter();

    const snapshot = await adapter.listSkills!({
      agentId: "agent-1",
      companyId: "company-1",
      adapterType: "omp_local",
      config: {
        paperclipRuntimeSkills: [wayfinderEntry],
        paperclipSkillSync: { desiredSkills: ["mattpocock/skills/wayfinder"] },
      },
    });

    expect(snapshot).toMatchObject({
      adapterType: "omp_local",
      supported: true,
      mode: "ephemeral",
      desiredSkills: ["mattpocock/skills/wayfinder"],
      entries: [
        {
          key: "mattpocock/skills/wayfinder",
          runtimeName: "wayfinder",
          desired: true,
          managed: true,
          state: "configured",
        },
      ],
      warnings: [],
    });
  });

  it("syncs desired skills without requiring config mutation", async () => {
    const adapter = createServerAdapter();

    const snapshot = await adapter.syncSkills!({
      agentId: "agent-1",
      companyId: "company-1",
      adapterType: "omp_local",
      config: { paperclipRuntimeSkills: [wayfinderEntry] },
    }, ["wayfinder"]);

    expect(snapshot.desiredSkills).toEqual(["mattpocock/skills/wayfinder"]);
    expect(snapshot.entries).toMatchObject([
      {
        key: "mattpocock/skills/wayfinder",
        desired: true,
        state: "configured",
      },
    ]);
  });
});
