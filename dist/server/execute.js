import path from "node:path";
import { adapterExecutionTargetIsRemote, adapterExecutionTargetSessionIdentity, adapterExecutionTargetSessionMatches, describeAdapterExecutionTarget, ensureAdapterExecutionTargetCommandResolvable, ensureAdapterExecutionTargetDirectory, readAdapterExecutionTarget, resolveAdapterExecutionTargetCwd, runAdapterExecutionTargetProcess, } from "@paperclipai/adapter-utils/execution-target";
import { DEFAULT_PAPERCLIP_AGENT_PROMPT_TEMPLATE, asBoolean, asNumber, asString, asStringArray, buildPaperclipEnv, ensurePathInEnv, parseObject, redactEnvForLogs, renderTemplate, } from "@paperclipai/adapter-utils/server-utils";
import { parseOmpStreamJson, isOmpUnknownSessionError } from "./parse.js";
import { ensureLocalOmpPath } from "./path.js";
const OMP_FINAL_DISPOSITION_MANDATE = [
    "Mandatory final action before exit:",
    "- A successful run is invalid until the current Paperclip issue has both (1) a durable issue comment/work artifact and (2) a concrete disposition.",
    "- Before your final response, write an issue comment summarizing completed work or the exact blocker/next action; then update the issue through Paperclip tooling/API to one of: done, cancelled, in_review with owner/reviewer, blocked with blocker owner/action, delegated follow-up issue, or explicit continuation with the next concrete action.",
    "- Do not rely on documents, logs, screenshots, progress summaries, or Remaining bullets as the issue comment or disposition.",
    "- If work must continue, record explicit continuation on the issue before exiting; never leave a successful heartbeat in plain in_progress with no next-step state and never exit without an issue comment.",
].join("\n");
function parseEnvText(value) {
    const env = {};
    for (const line of value.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#"))
            continue;
        const idx = trimmed.indexOf("=");
        if (idx <= 0)
            continue;
        env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
    }
    return env;
}
function envFromConfig(value) {
    if (typeof value === "string")
        return parseEnvText(value);
    const env = {};
    const rec = parseObject(value);
    for (const [key, raw] of Object.entries(rec)) {
        if (typeof raw === "string")
            env[key] = raw;
    }
    return env;
}
function argsArrayFromConfig(value) {
    if (typeof value === "string")
        return value.split(/\s+/).filter(Boolean);
    return asStringArray(value);
}
function contextString(ctx, key) {
    return asString(ctx.context[key], "");
}
function buildPrompt(ctx, template) {
    return renderTemplate(template, {
        agentId: ctx.agent.id,
        companyId: ctx.agent.companyId,
        runId: ctx.runId,
        company: { id: ctx.agent.companyId },
        agent: ctx.agent,
        run: ctx.runtime,
        context: ctx.context,
    });
}
function sessionFromRuntime(runtimeParams, legacySessionId) {
    const params = parseObject(runtimeParams);
    const sessionId = asString(params.sessionId, legacySessionId ?? "");
    const cwd = asString(params.cwd, "");
    const remoteExecution = parseObject(params.remoteExecution);
    return { sessionId, cwd, remoteExecution };
}
function normalizeCwdForSession(cwd, remote) {
    return remote ? path.posix.normalize(cwd) : path.resolve(cwd);
}
function argsForRun(input) {
    const { config, prompt, sessionId } = input;
    const args = ["--mode", "json", "--print"];
    const stringFlags = [
        ["--model", asString(config.model, "")],
        ["--smol", asString(config.smol, "")],
        ["--slow", asString(config.slow, "")],
        ["--plan", asString(config.plan, "")],
        ["--thinking", asString(config.thinking, asString(config.effort, ""))],
        ["--session-dir", asString(config.sessionDir, "")],
        ["--profile", asString(config.profile, "")],
        ["--tools", asString(config.tools, "")],
        ["--skills", asString(config.skills, "")],
    ];
    for (const [flag, value] of stringFlags)
        if (value)
            args.push(flag, value);
    for (const cfg of asStringArray(config.configFiles))
        args.push("--config", cfg);
    if (sessionId)
        args.push("--resume", sessionId);
    if (asBoolean(config.noTools, false))
        args.push("--no-tools");
    if (asBoolean(config.noLsp, false))
        args.push("--no-lsp");
    if (asBoolean(config.noPty, false))
        args.push("--no-pty");
    if (asBoolean(config.noExtensions, false))
        args.push("--no-extensions");
    if (asBoolean(config.noSkills, false))
        args.push("--no-skills");
    if (asBoolean(config.noRules, false))
        args.push("--no-rules");
    if (asBoolean(config.allowHome, false))
        args.push("--allow-home");
    if (asBoolean(config.advisor, false))
        args.push("--advisor");
    if (asBoolean(config.hideThinking, false))
        args.push("--hide-thinking");
    const maxTimeSec = asNumber(config.maxTimeSec, 0);
    if (maxTimeSec > 0)
        args.push("--max-time", String(maxTimeSec));
    args.push(...argsArrayFromConfig(config.extraArgs));
    args.push(prompt);
    return args;
}
export async function execute(ctx) {
    const config = parseObject(ctx.config);
    const command = asString(config.command, "omp");
    const executionTarget = readAdapterExecutionTarget({
        executionTarget: ctx.executionTarget,
        legacyRemoteExecution: ctx.executionTransport?.remoteExecution,
    });
    const executionTargetIsRemote = adapterExecutionTargetIsRemote(executionTarget);
    const cwd = resolveAdapterExecutionTargetCwd(executionTarget, asString(config.cwd, ""), process.cwd());
    const normalizedCwd = normalizeCwdForSession(cwd, executionTargetIsRemote);
    const timeoutSec = asNumber(config.timeoutSec, 3600);
    const graceSec = asNumber(config.graceSec, 15);
    const promptTemplate = [asString(config.promptTemplate, DEFAULT_PAPERCLIP_AGENT_PROMPT_TEMPLATE), OMP_FINAL_DISPOSITION_MANDATE].join("\n\n");
    await ensureAdapterExecutionTargetDirectory(ctx.runId, executionTarget, cwd, {
        cwd,
        env: {},
        createIfMissing: true,
        timeoutSec: Math.min(timeoutSec, 30),
        graceSec,
        onLog: ctx.onLog,
    });
    const env = {
        ...process.env,
        ...buildPaperclipEnv(ctx.agent),
        ...envFromConfig(config.env),
        PAPERCLIP_RUN_ID: ctx.runId,
    };
    env.PAPERCLIP_TASK_ID = contextString(ctx, "taskId") || contextString(ctx, "issueId");
    env.PAPERCLIP_WAKE_REASON = contextString(ctx, "wakeReason");
    env.PAPERCLIP_WAKE_COMMENT_ID = contextString(ctx, "wakeCommentId") || contextString(ctx, "commentId");
    env.PAPERCLIP_APPROVAL_ID = contextString(ctx, "approvalId");
    env.PAPERCLIP_APPROVAL_STATUS = contextString(ctx, "approvalStatus");
    const issueIds = Array.isArray(ctx.context.issueIds) ? ctx.context.issueIds.filter((v) => typeof v === "string").join(",") : "";
    env.PAPERCLIP_LINKED_ISSUE_IDS = issueIds;
    if (ctx.authToken && !env.PAPERCLIP_API_KEY)
        env.PAPERCLIP_API_KEY = ctx.authToken;
    const baseEnv = Object.fromEntries(Object.entries(ensurePathInEnv(env)).filter((entry) => typeof entry[1] === "string"));
    const runEnv = executionTargetIsRemote ? baseEnv : ensureLocalOmpPath(baseEnv);
    await ensureAdapterExecutionTargetCommandResolvable(command, executionTarget, cwd, runEnv, {
        installCommand: ctx.runtimeCommandSpec?.installCommand,
        timeoutSec,
    });
    const prompt = buildPrompt(ctx, promptTemplate);
    const prior = sessionFromRuntime(ctx.runtime.sessionParams, ctx.runtime.sessionId);
    const sessionTargetMatches = executionTargetIsRemote ? adapterExecutionTargetSessionMatches(prior.remoteExecution, executionTarget) : true;
    const sessionCwdMatches = prior.cwd.length === 0 || normalizeCwdForSession(prior.cwd, executionTargetIsRemote) === normalizedCwd;
    const canResume = prior.sessionId.length > 0 && sessionTargetMatches && sessionCwdMatches;
    const resumeSessionId = canResume ? prior.sessionId : null;
    const runAttempt = async (sessionId) => {
        const args = argsForRun({ config, prompt, sessionId });
        await ctx.onMeta?.({
            adapterType: "omp_local",
            command,
            cwd,
            commandNotes: executionTargetIsRemote ? [`Execution target: ${describeAdapterExecutionTarget(executionTarget)}`] : undefined,
            commandArgs: args.slice(0, -1).concat("<prompt>"),
            env: redactEnvForLogs(runEnv),
            prompt,
            context: ctx.context,
        });
        const proc = await runAdapterExecutionTargetProcess(ctx.runId, executionTarget, command, args, {
            cwd,
            env: runEnv,
            timeoutSec,
            graceSec,
            onLog: ctx.onLog,
            onRuntimeProgress: ctx.onRuntimeProgress,
            onSpawn: ctx.onSpawn,
        });
        return proc;
    };
    let proc = await runAttempt(resumeSessionId);
    if (resumeSessionId && !proc.timedOut && proc.exitCode !== 0 && isOmpUnknownSessionError(`${proc.stdout}\n${proc.stderr}`)) {
        proc = await runAttempt(null);
        const parsed = parseOmpStreamJson(proc.stdout);
        await recordFallbackContinuation(ctx, runEnv, proc);
        return toResult(proc, parsed, cwd, executionTarget, true);
    }
    const parsed = parseOmpStreamJson(proc.stdout);
    await recordFallbackContinuation(ctx, runEnv, proc);
    return toResult(proc, parsed, cwd, executionTarget, false);
}
async function logFallbackContinuationFailure(ctx, message) {
    try {
        if (ctx.onLog) {
            await ctx.onLog("stderr", `${message}\n`);
        }
        else {
            console.warn(message);
        }
    }
    catch {
        console.warn(message);
    }
}
async function recordFallbackContinuation(ctx, env, proc) {
    if (proc.exitCode !== 0 || proc.timedOut)
        return;
    const issueId = env.PAPERCLIP_TASK_ID || contextString(ctx, "issueId");
    const apiUrl = env.PAPERCLIP_API_URL?.replace(/\/+$/, "");
    if (!issueId || !apiUrl)
        return;
    const headers = { "Content-Type": "application/json" };
    if (env.PAPERCLIP_API_KEY)
        headers.Authorization = `Bearer ${env.PAPERCLIP_API_KEY}`;
    try {
        const current = await fetch(`${apiUrl}/api/issues/${encodeURIComponent(issueId)}`, { headers });
        if (!current.ok) {
            await logFallbackContinuationFailure(ctx, `omp_local fallback continuation skipped: GET issue returned HTTP ${current.status}.`);
            return;
        }
        const issue = await current.json();
        if (issue.status !== "in_progress")
            return;
        const identifier = typeof issue.identifier === "string" ? issue.identifier : issueId;
        const body = [
            "Adapter fallback: omp_local run exited successfully while the issue was still in_progress with no recorded disposition.",
            `Recording explicit continuation for ${identifier}: return to todo so the assignee can continue with a concrete next action and choose a final disposition.`,
        ].join("\n");
        const comment = await fetch(`${apiUrl}/api/issues/${encodeURIComponent(issueId)}/comments`, {
            method: "POST",
            headers,
            body: JSON.stringify({ body }),
        });
        if (!comment.ok) {
            await logFallbackContinuationFailure(ctx, `omp_local fallback continuation skipped: POST comment returned HTTP ${comment.status}.`);
            return;
        }
        const patch = await fetch(`${apiUrl}/api/issues/${encodeURIComponent(issueId)}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ status: "todo" }),
        });
        if (!patch.ok) {
            await logFallbackContinuationFailure(ctx, `omp_local fallback continuation skipped: PATCH issue returned HTTP ${patch.status}.`);
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await logFallbackContinuationFailure(ctx, `omp_local fallback continuation skipped: ${message}`);
    }
}
function describeOmpExit(proc) {
    if (proc.timedOut)
        return "omp timed out";
    if (proc.signal)
        return "omp terminated by signal " + proc.signal;
    return "omp exited with code " + (proc.exitCode ?? "null");
}
function toResult(proc, parsed, cwd, executionTarget, clearSession) {
    const errorMessage = proc.exitCode === 0 && !proc.timedOut ? null : (parsed.errorMessage ?? proc.stderr.trim()) || describeOmpExit(proc);
    return {
        exitCode: proc.exitCode,
        signal: proc.signal,
        timedOut: proc.timedOut,
        errorMessage,
        usage: parsed.usage ?? undefined,
        sessionId: parsed.sessionId,
        sessionParams: parsed.sessionId ? { sessionId: parsed.sessionId, cwd, remoteExecution: adapterExecutionTargetSessionIdentity(executionTarget) } : null,
        sessionDisplayId: parsed.sessionId,
        provider: parsed.provider,
        model: parsed.model,
        costUsd: parsed.costUsd,
        resultJson: parsed.resultJson,
        summary: parsed.summary,
        clearSession,
    };
}
//# sourceMappingURL=execute.js.map