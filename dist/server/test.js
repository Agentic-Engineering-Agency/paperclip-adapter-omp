import { describeAdapterExecutionTarget, ensureAdapterExecutionTargetCommandResolvable, ensureAdapterExecutionTargetDirectory, readAdapterExecutionTarget, resolveAdapterExecutionTargetCwd, } from "@paperclipai/adapter-utils/execution-target";
import { asString, ensurePathInEnv, parseObject } from "@paperclipai/adapter-utils/server-utils";
import { discoverOmniRouteModels } from "./models.js";
function statusFrom(checks) {
    if (checks.some((c) => c.level === "error"))
        return "fail";
    if (checks.some((c) => c.level === "warn"))
        return "warn";
    return "pass";
}
export async function testEnvironment(ctx) {
    const config = parseObject(ctx.config);
    const command = asString(config.command, "omp");
    const executionTarget = readAdapterExecutionTarget({
        executionTarget: ctx.executionTarget,
    });
    const cwd = resolveAdapterExecutionTargetCwd(executionTarget, asString(config.cwd, ""), process.cwd());
    const checks = [];
    const env = Object.fromEntries(Object.entries(ensurePathInEnv({ ...process.env })).filter((entry) => typeof entry[1] === "string"));
    const runId = `omp-envtest-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    if (executionTarget?.kind === "remote") {
        checks.push({ code: "execution_target", level: "info", message: `Probing inside environment: ${ctx.environmentName ?? describeAdapterExecutionTarget(executionTarget)}` });
    }
    try {
        await ensureAdapterExecutionTargetDirectory(runId, executionTarget, cwd, {
            cwd,
            env,
            createIfMissing: false,
            timeoutSec: 30,
            graceSec: 5,
        });
        checks.push({ code: "cwd_ok", level: "info", message: "Working directory exists", detail: cwd });
    }
    catch (err) {
        checks.push({ code: "cwd_invalid", level: "error", message: "Working directory is not usable", detail: err instanceof Error ? err.message : String(err), hint: "Set adapterConfig.cwd to an existing directory in the selected environment." });
    }
    try {
        await ensureAdapterExecutionTargetCommandResolvable(command, executionTarget, cwd, env);
        checks.push({ code: "command_ok", level: "info", message: "omp command is resolvable", detail: command });
    }
    catch (err) {
        checks.push({ code: "command_missing", level: "error", message: "omp command is not resolvable", detail: err instanceof Error ? err.message : String(err), hint: "Install omp in the selected environment or set adapterConfig.command to its absolute path." });
    }
    const model = asString(config.model, "");
    if (model)
        checks.push({ code: "model_configured", level: "info", message: "Model configured", detail: model });
    else
        checks.push({ code: "model_default", level: "warn", message: "No explicit model configured", hint: "Set adapterConfig.model so agent runs are stable across host omp defaults." });
    const { models, source } = await discoverOmniRouteModels();
    if (source === "static")
        checks.push({ code: "models_static_fallback", level: "warn", message: "Model discovery fell back to static defaults", hint: "Ensure omp is on PATH or set OMNIROUTE_API_KEY." });
    else
        checks.push({ code: "models_discovered", level: "info", message: "OmniRoute model discovery working", detail: `${models.length} models` });
    return { adapterType: ctx.adapterType, status: statusFrom(checks), checks, testedAt: new Date().toISOString() };
}
//# sourceMappingURL=test.js.map