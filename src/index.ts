import type { AdapterConfigSchema, AdapterModelProfileDefinition, AdapterRuntimeCommandSpec, ServerAdapterModule } from "@paperclipai/adapter-utils";
import { execute, sessionCodec, testEnvironment } from "./server/index.js";

export const type = "omp_local";
export const label = "Oh My Pi (omp)";
export const SANDBOX_INSTALL_COMMAND = "npm install -g @oh-my-pi/pi-coding-agent";

export const models = [
  { id: "omniroute/omp-fast", label: "OmniRoute OMP Fast" },
  { id: "omniroute/omp-agent", label: "OmniRoute OMP Agent" },
  { id: "omniroute/auto/best-coding", label: "OmniRoute Auto Best Coding" },
  { id: "omniroute/cc/claude-sonnet-5", label: "OmniRoute Claude Sonnet 5" },
  { id: "omniroute/cc/claude-fable-5", label: "OmniRoute Claude Fable 5" },
  { id: "omniroute/cc/claude-opus-4-8", label: "OmniRoute Claude Opus 4.8" },
  { id: "omniroute/cc/claude-opus-4-7", label: "OmniRoute Claude Opus 4.7" },
];

export const modelProfiles: AdapterModelProfileDefinition[] = [
  {
    key: "cheap",
    label: "Cheap",
    description: "Use OMP's fast OmniRoute lane for lower-cost lightweight work.",
    adapterConfig: {
      model: "omniroute/omp-fast",
      thinking: "low",
    },
    source: "adapter_default",
  },
];

export const agentConfigurationDoc = `# omp_local agent configuration

Adapter: omp_local

Use when:
- The agent should run the Oh My Pi (omp) CLI locally on the Paperclip host
- You want direct access to omp providers, model roles, skills, rules, LSP, browser, and shell tooling
- You need session persistence through omp's native session store
- You want to route through a configured OpenAI-compatible gateway such as OmniRoute

Don't use when:
- omp is not installed on the host PATH
- The agent must run in a remote sandbox without omp installed
- The task needs a minimal one-shot process runner rather than a full coding agent runtime
- You need Claude Code subscription-only behavior; use claude_local for that path

Core fields:
- cwd (string, optional): absolute working directory for omp. Defaults to process cwd if absent.
- command (string, optional, default "omp"): omp executable name/path.
- model (string, optional): value passed to --model, for example "omniroute/omp-agent".
- smol (string, optional): value passed to --smol.
- slow (string, optional): value passed to --slow.
- plan (string, optional): value passed to --plan.
- thinking (string, optional): value passed to --thinking (off|minimal|low|medium|high|xhigh|auto).
- promptTemplate (string, optional): Paperclip run prompt template. Uses the shared Paperclip agent prompt contract by default.
- timeoutSec (number, optional, default 3600): hard timeout for the omp process.
- graceSec (number, optional, default 15): graceful shutdown window.
- maxTimeSec (number, optional): if >0, passed to omp as --max-time.
- sessionDir (string, optional): passed to --session-dir.
- profile (string, optional): passed to --profile.
- configFiles (string[], optional): each entry passed with --config.
- tools (string, optional): comma-separated tools passed to --tools.
- skills (string, optional): comma-separated skill filter passed to --skills.
- noTools (boolean, optional, default false): pass --no-tools.
- noLsp (boolean, optional, default false): pass --no-lsp.
- noPty (boolean, optional, default false): pass --no-pty.
- noExtensions (boolean, optional, default false): pass --no-extensions.
- noSkills (boolean, optional, default false): pass --no-skills.
- noRules (boolean, optional, default false): pass --no-rules.
- allowHome (boolean, optional, default false): pass --allow-home.
- advisor (boolean, optional, default false): pass --advisor.
- hideThinking (boolean, optional, default false): pass --hide-thinking.
- extraArgs (string[], optional): additional literal CLI args before the prompt. Use sparingly.
- env (object, optional): environment variables for the process. Secrets stay in env and are redacted from metadata.

Session behavior:
- The adapter persists omp's session id plus cwd and resumes with --resume when cwd matches.
- Unknown/missing session errors trigger one fresh retry and return clearSession=true so Paperclip drops stale state.

Security:
- Secrets belong in env, not promptTemplate.
- This adapter runs a local coding agent with host filesystem access to cwd. Scope cwd carefully.
- Avoid noTools/noLsp/noPty only when you intentionally want to restrict omp's tool surface.
`;


function getConfigSchema(): AdapterConfigSchema {
  return {
    fields: [
      {
        key: "command",
        label: "omp command",
        type: "text",
        default: "omp",
        hint: "Executable name or absolute path for the Oh My Pi CLI.",
      },
      {
        key: "cwd",
        label: "Working directory",
        type: "text",
        hint: "Absolute directory where omp runs. Defaults to the server process cwd when omitted.",
      },
      {
        key: "model",
        label: "Model",
        type: "combobox",
        options: models.map((model) => ({ value: model.id, label: model.label })),
        hint: "Optional model passed to omp --model, for example omniroute/omp-agent.",
      },
      {
        key: "thinking",
        label: "Thinking effort",
        type: "select",
        default: "medium",
        options: [
          { value: "off", label: "Off" },
          { value: "minimal", label: "Minimal" },
          { value: "low", label: "Low" },
          { value: "medium", label: "Medium" },
          { value: "high", label: "High" },
          { value: "xhigh", label: "Extra high" },
          { value: "auto", label: "Auto" },
        ],
      },
      {
        key: "timeoutSec",
        label: "Timeout seconds",
        type: "number",
        default: 3600,
      },
      {
        key: "graceSec",
        label: "Grace seconds",
        type: "number",
        default: 15,
        hint: "Seconds to wait after terminating omp before killing the process.",
      },
      {
        key: "maxTimeSec",
        label: "OMP max time seconds",
        type: "number",
        hint: "Optional value passed to omp --max-time.",
      },
      {
        key: "sessionDir",
        label: "Session directory",
        type: "text",
        hint: "Optional value passed to omp --session-dir.",
      },
      {
        key: "profile",
        label: "OMP profile",
        type: "text",
        hint: "Optional value passed to omp --profile.",
      },
      {
        key: "tools",
        label: "Tools",
        type: "text",
        hint: "Optional comma-separated value passed to omp --tools.",
      },
      {
        key: "skills",
        label: "Skills",
        type: "text",
        hint: "Optional comma-separated value passed to omp --skills.",
      },
      {
        key: "noTools",
        label: "Disable tools",
        type: "toggle",
        default: false,
        hint: "Pass omp --no-tools.",
      },
      {
        key: "noLsp",
        label: "Disable LSP",
        type: "toggle",
        default: false,
        hint: "Pass omp --no-lsp.",
      },
      {
        key: "noSkills",
        label: "Disable skills",
        type: "toggle",
        default: false,
        hint: "Pass omp --no-skills.",
      },
      {
        key: "allowHome",
        label: "Allow home access",
        type: "toggle",
        default: false,
        hint: "Pass omp --allow-home.",
      },
      {
        key: "advisor",
        label: "Advisor mode",
        type: "toggle",
        default: false,
        hint: "Pass omp --advisor.",
      },
      {
        key: "hideThinking",
        label: "Hide thinking",
        type: "toggle",
        default: false,
        hint: "Pass omp --hide-thinking.",
      },
      {
        key: "promptTemplate",
        label: "Prompt template",
        type: "textarea",
        hint: "Optional Paperclip prompt template rendered for each run.",
      },
      {
        key: "extraArgs",
        label: "Extra args",
        type: "textarea",
        hint: "Optional literal extra arguments. Prefer dedicated fields when available.",
      },
      {
        key: "env",
        label: "Environment",
        type: "textarea",
        hint: "Optional environment variables for omp. Secrets are injected as env and redacted from logs.",
      },
    ],
  };
}

function getRuntimeCommandSpec(config: Record<string, unknown>): AdapterRuntimeCommandSpec {
  const command = typeof config.command === "string" && config.command.trim() ? config.command : "omp";
  return {
    command,
    detectCommand: command,
    installCommand: SANDBOX_INSTALL_COMMAND,
  };
}

export function createServerAdapter(): ServerAdapterModule {
  return {
    type,
    execute,
    testEnvironment,
    sessionCodec,
    models,
    modelProfiles,
    supportsLocalAgentJwt: true,
    agentConfigurationDoc,
    getConfigSchema,
    getRuntimeCommandSpec,
  };
}

export { createServerAdapter as createOmpLocalServerAdapter };