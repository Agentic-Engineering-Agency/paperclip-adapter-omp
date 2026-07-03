# Paperclip integration

This adapter is a standalone package. Preferred integration is Paperclip's external adapter manager. Direct source registry wiring is still supported for Paperclip forks that want to vendor the adapter.

## 1. External adapter manager

```sh
paperclipai adapter install --payload-json '{"packageName":"@agentic-engineering-agency/paperclip-adapter-omp","version":"0.1.2"}'
```

The package root exports `createServerAdapter()`, `./ui-parser` exposes a standalone browser-safe `parseStdoutLine`, and `package.json` declares `paperclip.adapterUiParser = "1.0.0"`.

## 2. Source registry integration

Use this path only when editing Paperclip source directly instead of using external adapter install.

### Server registry
Add the package dependency to Paperclip server workspace, then register a `ServerAdapterModule`:

```ts
import {
  agentConfigurationDoc,
  modelProfiles,
  models,
  type,
} from "@agentic-engineering-agency/paperclip-adapter-omp";
import { execute, sessionCodec, testEnvironment } from "@agentic-engineering-agency/paperclip-adapter-omp/server";

const ompLocalAdapter = {
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

Add `ompLocalAdapter` to Paperclip's adapter map.

### UI registry

The package exports parser/config builder only. Paperclip UI still owns the React config component.

```ts
import { label, type } from "@agentic-engineering-agency/paperclip-adapter-omp";
import { buildOmpLocalConfig, parseOmpStdoutLine } from "@agentic-engineering-agency/paperclip-adapter-omp/ui";
import { OmpConfigFields } from "./omp-local/config-fields";

export const ompLocalUIAdapter = {
  type,
  label,
  parseStdoutLine: parseOmpStdoutLine,
  ConfigFields: OmpConfigFields,
  buildAdapterConfig: buildOmpLocalConfig,
};
```

Minimum UI fields:

- `cwd`
- `model`
- `thinking`
- `command`
- `promptTemplate`
- `envVars`
- `extraArgs`

### CLI registry

```ts
import { type } from "@agentic-engineering-agency/paperclip-adapter-omp";
import { printOmpStreamEvent } from "@agentic-engineering-agency/paperclip-adapter-omp/cli";

export const ompLocalCLIAdapter = {
  type,
  formatStdoutEvent: printOmpStreamEvent,
};
```

## 3. Host setup

Every host that can run `omp_local` agents needs:

```sh
npm install -g @oh-my-pi/pi-coding-agent
omp --version
```

Provider credentials/config stay in OMP's own config, commonly `~/.omp/agent/models.yml` and `~/.omp/agent/.env`.

## 5. Environment test behavior

`testEnvironment()` checks:

- cwd exists and is usable
- `command` resolves on PATH
- model is explicitly configured (warn only if absent)

Warnings are not save blockers. Missing cwd/command are errors.
