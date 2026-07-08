import type { AdapterExecutionContext } from "@paperclipai/adapter-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const executionTargetMocks = vi.hoisted(() => ({
  ensureDirectory: vi.fn(),
  ensureCommand: vi.fn(),
  runProcess: vi.fn(),
}));

vi.mock("@paperclipai/adapter-utils/execution-target", () => ({
  adapterExecutionTargetIsRemote: (target: { kind?: string } | null | undefined) => target?.kind === "remote",
  adapterExecutionTargetSessionIdentity: (target: { transport?: string; spec?: { host?: string; port?: number; username?: string }; remoteCwd?: string } | null | undefined) => target ? {
    transport: target.transport,
    host: target.spec?.host,
    port: target.spec?.port,
    username: target.spec?.username,
    remoteCwd: target.remoteCwd,
  } : null,
  adapterExecutionTargetSessionMatches: (saved: { transport?: string; remoteCwd?: string } | null | undefined, target: { transport?: string; remoteCwd?: string } | null | undefined) => Boolean(saved && target && saved.transport === target.transport && saved.remoteCwd === target.remoteCwd),
  describeAdapterExecutionTarget: (target: { transport?: string; spec?: { username?: string; host?: string }; remoteCwd?: string } | null | undefined) => `${target?.transport}:${target?.spec?.username}@${target?.spec?.host}:${target?.remoteCwd}`,
  ensureAdapterExecutionTargetCommandResolvable: executionTargetMocks.ensureCommand,
  ensureAdapterExecutionTargetDirectory: executionTargetMocks.ensureDirectory,
  readAdapterExecutionTarget: (input: { executionTarget?: unknown }) => input.executionTarget ?? null,
  resolveAdapterExecutionTargetCwd: (target: { remoteCwd?: string } | null | undefined, configuredCwd: string, fallback: string) => target?.remoteCwd ?? (configuredCwd || fallback),
  runAdapterExecutionTargetProcess: executionTargetMocks.runProcess,
}));

import { execute } from "./execute.js";

function makeContext(overrides: Partial<AdapterExecutionContext> = {}): AdapterExecutionContext {
  return {
    runId: "run-1",
    agent: {
      id: "agent-1",
      companyId: "company-1",
      name: "Remote OMP",
      adapterType: "omp_local",
    },
    runtime: {
      id: "runtime-1",
      agentId: "agent-1",
      sessionId: null,
      sessionParams: null,
    },
    config: { command: "omp", model: "omniroute/omp-fast" },
    context: {},
    onLog: vi.fn(),
    ...overrides,
  } as AdapterExecutionContext;
}

const sshTarget = {
  kind: "remote",
  transport: "ssh",
  remoteCwd: "/home/sebastian/paperclip/personal",
  spec: {
    host: "100.106.228.87",
    port: 22,
    username: "sebastian",
    remoteWorkspacePath: "/home/sebastian/paperclip/personal",
    privateKey: "redacted",
    knownHosts: null,
    strictHostKeyChecking: false,
    remoteCwd: "/home/sebastian/paperclip/personal",
  },
};

describe("execute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    executionTargetMocks.ensureDirectory.mockResolvedValue(undefined);
    executionTargetMocks.ensureCommand.mockResolvedValue(undefined);
    executionTargetMocks.runProcess.mockResolvedValue({
      exitCode: 0,
      signal: null,
      timedOut: false,
      stdout: [
        JSON.stringify({ type: "session", id: "omp-session-1" }),
        JSON.stringify({ type: "message_end", message: { role: "assistant", content: "done" } }),
      ].join("\n"),
      stderr: "",
    });
  });

  it("runs omp through the selected SSH execution target", async () => {
    const result = await execute(makeContext({ executionTarget: sshTarget }));

    expect(executionTargetMocks.ensureDirectory).toHaveBeenCalledWith("run-1", sshTarget, "/home/sebastian/paperclip/personal", expect.objectContaining({ createIfMissing: true }));
    expect(executionTargetMocks.ensureCommand).toHaveBeenCalledWith("omp", sshTarget, "/home/sebastian/paperclip/personal", expect.any(Object), expect.objectContaining({ installCommand: undefined }));
    expect(executionTargetMocks.runProcess).toHaveBeenCalledWith("run-1", sshTarget, "omp", expect.arrayContaining(["--mode", "json", "--print", "--model", "omniroute/omp-fast"]), expect.objectContaining({ cwd: "/home/sebastian/paperclip/personal" }));
    expect(result.sessionParams).toEqual({
      sessionId: "omp-session-1",
      cwd: "/home/sebastian/paperclip/personal",
      remoteExecution: {
        transport: "ssh",
        host: "100.106.228.87",
        port: 22,
        username: "sebastian",
        remoteCwd: "/home/sebastian/paperclip/personal",
      },
    });
  });

  it("does not resume sessions saved for a different SSH target", async () => {
    await execute(makeContext({
      executionTarget: sshTarget,
      runtime: {
        id: "runtime-1",
        agentId: "agent-1",
        sessionId: "old-session",
        sessionParams: {
          sessionId: "old-session",
          cwd: "/home/sebastian/paperclip/personal",
          remoteExecution: { transport: "ssh", remoteCwd: "/different" },
        },
      },
    }));

    const args = executionTargetMocks.runProcess.mock.calls[0]?.[3] as string[];
    expect(args).not.toContain("--resume");
    expect(args).not.toContain("old-session");
  });
});
