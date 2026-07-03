# paperclip-adapter-omp

Standalone Paperclip adapter package for running [Oh My Pi (`omp`)](https://github.com/oh-my-pi) as a local Paperclip agent runtime.

## Package exports

- `@agentic-engineering-agency/paperclip-adapter-omp` — shared metadata (`type`, `label`, `models`, `agentConfigurationDoc`)
- `@agentic-engineering-agency/paperclip-adapter-omp/server` — `execute`, `testEnvironment`, parser, session codec
- `@agentic-engineering-agency/paperclip-adapter-omp/ui` — stdout parser and config builder
- `@agentic-engineering-agency/paperclip-adapter-omp/cli` — watch-mode formatter

## Paperclip registration sketch

```ts
import { agentConfigurationDoc, modelProfiles, models, type } from "@agentic-engineering-agency/paperclip-adapter-omp";
import { execute, sessionCodec, testEnvironment } from "@agentic-engineering-agency/paperclip-adapter-omp/server";

export const ompAdapter = {
  type,
  execute,
  testEnvironment,
  sessionCodec,
  models,
  modelProfiles,
  supportsLocalAgentJwt: true,
  agentConfigurationDoc,
};
```

Use the matching `./ui` and `./cli` exports in Paperclip's UI and CLI adapter registries.

## Required host setup

- `omp` CLI installed and on `PATH`
- `~/.omp/agent/models.yml` configured for desired providers, or provider keys available in environment
- working directory configured per agent via `cwd`

## Config fields

See `agentConfigurationDoc` in `src/index.ts` for LLM-facing routing and field documentation.
