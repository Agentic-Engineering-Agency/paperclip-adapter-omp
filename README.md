# paperclip-adapter-omp

Paperclip adapter for running [Oh My Pi (`omp`)](https://www.npmjs.com/package/@oh-my-pi/pi-coding-agent) as a local Paperclip agent runtime.

This package lets Paperclip invoke `omp --mode json --print`, parse the event stream, persist OMP sessions, and surface usage/model/cost metadata back to Paperclip.

## Status

- Adapter type: `omp_local`
- Runtime command: `omp`
- Paperclip contract source: `@paperclipai/adapter-utils@2026.703.0-canary.5`
- OMP install command for fresh hosts/sandboxes: `npm install -g @oh-my-pi/pi-coding-agent`
- Package exports: shared metadata, server adapter, UI parser/config builder, CLI formatter

## Install

npm package:

```sh
npm install @agentic-engineering-agency/paperclip-adapter-omp
```

GitHub fallback:

```sh
npm install git+https://github.com/Agentic-Engineering-Agency/paperclip-adapter-omp.git
```

Host runtime requirement:

```sh
npm install -g @oh-my-pi/pi-coding-agent
omp --version
```

Configure OMP providers separately, for example in `~/.omp/agent/models.yml`. This adapter does not manage provider credentials; it launches OMP with Paperclip run env injected.

## Exports

| Export | Purpose |
| --- | --- |
| `@agentic-engineering-agency/paperclip-adapter-omp` | `type`, `label`, `models`, `modelProfiles`, `agentConfigurationDoc`, `createServerAdapter` |
| `@agentic-engineering-agency/paperclip-adapter-omp/server` | `execute`, `testEnvironment`, `sessionCodec`, parser helpers |
| `@agentic-engineering-agency/paperclip-adapter-omp/ui` | `parseOmpStdoutLine`, `buildOmpLocalConfig` |
| `@agentic-engineering-agency/paperclip-adapter-omp/ui-parser` | standalone browser-safe `parseStdoutLine` for external adapter manager |
| `@agentic-engineering-agency/paperclip-adapter-omp/cli` | `printOmpStreamEvent` |

## External adapter install

Install through Paperclip's external adapter manager:

```sh
paperclipai adapter install --payload-json '{"packageName":"@agentic-engineering-agency/paperclip-adapter-omp","version":"0.1.2"}'
```

This package root exports `createServerAdapter()`. It also declares `paperclip.adapterUiParser = "1.0.0"` and exposes `./ui-parser` so Paperclip can serve the run transcript parser.

## Paperclip registration

Server registry:

```ts
import {
  agentConfigurationDoc as ompDoc,
  modelProfiles as ompModelProfiles,
  models as ompModels,
  type as ompType,
} from "@agentic-engineering-agency/paperclip-adapter-omp";
import {
  execute as executeOmp,
  sessionCodec as ompSessionCodec,
  testEnvironment as testOmpEnvironment,
} from "@agentic-engineering-agency/paperclip-adapter-omp/server";

const ompAdapter = {
  type: ompType,
  execute: executeOmp,
  testEnvironment: testOmpEnvironment,
  sessionCodec: ompSessionCodec,
  models: ompModels,
  modelProfiles: ompModelProfiles,
  supportsLocalAgentJwt: true,
  agentConfigurationDoc: ompDoc,
};
```

UI registry:

```ts
import { buildOmpLocalConfig, parseOmpStdoutLine } from "@agentic-engineering-agency/paperclip-adapter-omp/ui";

export const ompUIAdapter = {
  type: "omp_local",
  label: "Oh My Pi (omp)",
  parseStdoutLine: parseOmpStdoutLine,
  ConfigFields: OmpConfigFields,
  buildAdapterConfig: buildOmpLocalConfig,
};
```

CLI registry:

```ts
import { printOmpStreamEvent } from "@agentic-engineering-agency/paperclip-adapter-omp/cli";

export const ompCLIAdapter = {
  type: "omp_local",
  formatStdoutEvent: printOmpStreamEvent,
};
```

See [`docs/integration.md`](docs/integration.md) for full registry guidance.

## Minimal agent config

```json
{
  "cwd": "/absolute/path/to/workspace",
  "command": "omp",
  "model": "omniroute/omp-agent",
  "thinking": "high",
  "timeoutSec": 3600,
  "graceSec": 15
}
```

Common fields:

| Field | Default | Meaning |
| --- | --- | --- |
| `cwd` | process cwd | Absolute project directory for OMP |
| `command` | `omp` | Executable name/path |
| `model` | host OMP default | Passed to `--model` |
| `smol`, `slow`, `plan` | unset | Passed to matching OMP role flags |
| `thinking` | unset | Passed to `--thinking` |
| `sessionDir` | OMP default | Passed to `--session-dir` |
| `profile` | OMP default | Passed to `--profile` |
| `configFiles` | `[]` | Repeated `--config` flags |
| `tools`, `skills` | unset | OMP filters for tool/skill loading |
| `noTools`, `noLsp`, `noPty` | `false` | Tool restriction flags |
| `noExtensions`, `noSkills`, `noRules` | `false` | Discovery restriction flags |
| `allowHome`, `advisor`, `hideThinking` | `false` | OMP runtime flags |
| `env` | `{}` | Extra env vars; secrets are redacted from metadata |

Full config notes: [`docs/configuration.md`](docs/configuration.md).

## Session behavior

The adapter stores:

```json
{ "sessionId": "...", "cwd": "/absolute/path" }
```

On next wake, it resumes with `--resume <sessionId>` only when the stored cwd matches current cwd. If OMP reports an unknown/missing session, the adapter retries once without `--resume` and returns `clearSession: true` so Paperclip forgets stale state.

## Event parsing

The parser expects OMP JSON mode events like:

```json
{ "type": "session", "id": "..." }
{ "type": "message_end", "message": { "role": "assistant", "content": [{ "type": "text", "text": "done" }] } }
```

It extracts:

- session id
- provider/model
- summary text
- token usage (`input`, `output`, `cacheRead`)
- cost (`usage.cost.total`)
- structured final event JSON

## Development

```sh
npm install
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

## Release

```sh
npm publish --access public
```

Release currently requires an npm account/token with publish rights for the `@agentic-engineering-agency` scope.
