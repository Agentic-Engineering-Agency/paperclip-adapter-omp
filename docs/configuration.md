# Adapter configuration

`omp_local` config is stored in Paperclip as `agent.adapterConfig`. Values are runtime-resolved by the adapter before spawning `omp`.

## Recommended config

```json
{
  "cwd": "/Users/agent/AgenticEngineering/workspace",
  "command": "omp",
  "model": "omniroute/omp-agent",
  "thinking": "high",
  "timeoutSec": 3600,
  "graceSec": 15
}
```

## Model routing

The adapter passes model flags directly to OMP:

- `model` -> `--model`
- `smol` -> `--smol`
- `slow` -> `--slow`
- `plan` -> `--plan`
- `thinking` or legacy `effort` -> `--thinking`

This keeps model routing and provider auth in OMP, not Paperclip.

Model *discovery* for the Paperclip UI resolves through a three-tier chain: `omp models omniroute --json` on the host, then a direct gateway fetch of `$OMNIROUTE_BASE_URL/models` (default `https://omniroute.agenticengineering.lat/v1`, requires `OMNIROUTE_API_KEY`), then the static defaults in `src/model-catalog.ts`. Results are cached 5 minutes; the UI "refresh models" action bypasses the cache.

## Session fields

The adapter persists only opaque OMP session identity plus cwd:

```json
{
  "sessionId": "019f28c1-ba31-7000-98fc-d8c06be525da",
  "cwd": "/Users/agent/project"
}
```

A session is resumed only if cwd matches. This prevents cross-project contamination.

## Runtime restriction flags

Use these when an agent should be constrained:

```json
{
  "noTools": true,
  "noLsp": true,
  "noPty": true,
  "noExtensions": true,
  "noSkills": true,
  "noRules": true
}
```

By default the adapter does not disable OMP capabilities.

## Env vars and secrets

```json
{
  "env": {
    "OPENAI_API_KEY": "...",
    "OMNIROUTE_API_KEY": "..."
  }
}
```

Secrets are injected into the child process environment and redacted from adapter invocation metadata. Do not put secrets in `promptTemplate`.

## Prompt template

If `promptTemplate` is omitted, the adapter uses Paperclip's shared `DEFAULT_PAPERCLIP_AGENT_PROMPT_TEMPLATE`.

Template variables include:

- `{{agentId}}`
- `{{companyId}}`
- `{{runId}}`
- `{{agent.*}}`
- `{{run.*}}`
- `{{context.*}}`

## Escape hatch

`extraArgs` appends literal CLI args before the prompt. Prefer typed config fields first; use `extraArgs` only for new OMP flags the adapter does not expose yet.
