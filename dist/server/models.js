import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { DEFAULT_OMNIROUTE_MODELS } from "../model-catalog.js";
const execFileAsync = promisify(execFile);
const CACHE_TTL_MS = 300_000;
const OMP_TIMEOUT_MS = 60_000;
const OMP_MAX_BUFFER = 16 * 1024 * 1024;
const GATEWAY_TIMEOUT_MS = 15_000;
const DEFAULT_GATEWAY_BASE_URL = "https://omniroute.agenticengineering.lat/v1";
let cache = null;
export function clearOmniRouteModelCacheForTest() {
    cache = null;
}
function dedupeById(models) {
    const seen = new Set();
    const out = [];
    for (const m of models) {
        if (seen.has(m.id))
            continue;
        seen.add(m.id);
        out.push(m);
    }
    return out;
}
/** Map `omp models omniroute --json` output ({models: [{selector, name, id}]}) to AdapterModel[]. */
export function mapOmpCatalog(json) {
    if (typeof json !== "object" || json === null)
        return [];
    const models = json.models;
    if (!Array.isArray(models))
        return [];
    const mapped = [];
    for (const entry of models) {
        if (typeof entry !== "object" || entry === null)
            continue;
        const rec = entry;
        const selector = typeof rec.selector === "string" ? rec.selector : "";
        if (!selector)
            continue;
        const rawId = typeof rec.id === "string" ? rec.id : selector;
        const name = typeof rec.name === "string" ? rec.name : "";
        const label = name && name !== rawId ? name : rawId;
        mapped.push({ id: selector, label, rawId });
    }
    const deduped = dedupeById(mapped);
    const labelCounts = new Map();
    for (const m of deduped)
        labelCounts.set(m.label, (labelCounts.get(m.label) ?? 0) + 1);
    const out = deduped.map((m) => (labelCounts.get(m.label) ?? 0) > 1 ? { id: m.id, label: `${m.label} (${m.rawId})` } : { id: m.id, label: m.label });
    return out.sort((a, b) => a.id.localeCompare(b.id));
}
/** Map OpenAI-style gateway `/v1/models` output ({data: [{id}]}) to AdapterModel[]. */
export function mapGatewayCatalog(json) {
    if (typeof json !== "object" || json === null)
        return [];
    const data = json.data;
    if (!Array.isArray(data))
        return [];
    const mapped = [];
    for (const entry of data) {
        if (typeof entry !== "object" || entry === null)
            continue;
        const id = entry.id;
        if (typeof id !== "string" || !id)
            continue;
        mapped.push({ id: `omniroute/${id}`, label: id });
    }
    return dedupeById(mapped).sort((a, b) => a.id.localeCompare(b.id));
}
async function discoverViaOmp() {
    const { stdout } = await execFileAsync("omp", ["models", "omniroute", "--json"], {
        timeout: OMP_TIMEOUT_MS,
        maxBuffer: OMP_MAX_BUFFER,
    });
    // omp may print banner lines (e.g. Langfuse tracing notice) to stdout before the JSON.
    const start = stdout.indexOf("{");
    if (start < 0)
        return [];
    return mapOmpCatalog(JSON.parse(stdout.slice(start)));
}
function gatewayModelsUrl() {
    const base = (process.env.OMNIROUTE_BASE_URL || DEFAULT_GATEWAY_BASE_URL).replace(/\/+$/, "");
    return `${base}/models`;
}
async function discoverViaGateway() {
    const apiKey = process.env.OMNIROUTE_API_KEY;
    if (!apiKey)
        return [];
    const res = await fetch(gatewayModelsUrl(), {
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "User-Agent": "paperclip-adapter-omp",
        },
        signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
    });
    if (!res.ok)
        return [];
    return mapGatewayCatalog(await res.json());
}
export async function discoverOmniRouteModels() {
    try {
        const models = await discoverViaOmp();
        if (models.length > 0)
            return { models, source: "omp-cli" };
    }
    catch {
        // fall through to gateway
    }
    try {
        const models = await discoverViaGateway();
        if (models.length > 0)
            return { models, source: "gateway" };
    }
    catch {
        // fall through to static defaults
    }
    return { models: DEFAULT_OMNIROUTE_MODELS, source: "static" };
}
export async function listOmniRouteModels() {
    if (cache && Date.now() - cache.at < CACHE_TTL_MS)
        return cache.models;
    const { models } = await discoverOmniRouteModels();
    cache = { models, at: Date.now() };
    return models;
}
export async function refreshOmniRouteModels() {
    try {
        await execFileAsync("omp", ["models", "refresh"], { timeout: OMP_TIMEOUT_MS, maxBuffer: OMP_MAX_BUFFER });
    }
    catch {
        // best-effort refresh; ignore failures
    }
    const { models } = await discoverOmniRouteModels();
    cache = { models, at: Date.now() };
    return models;
}
//# sourceMappingURL=models.js.map