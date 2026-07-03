import type { AdapterSessionCodec } from "@paperclipai/adapter-utils";
import { asString, parseObject } from "@paperclipai/adapter-utils/server-utils";

export { execute } from "./execute.js";
export { testEnvironment } from "./test.js";
export { isOmpUnknownSessionError, parseOmpStreamJson } from "./parse.js";
export { listOmniRouteModels, refreshOmniRouteModels, mapOmpCatalog, mapGatewayCatalog } from "./models.js";

export const sessionCodec: AdapterSessionCodec = {
  deserialize(raw) {
    const rec = parseObject(raw);
    const sessionId = asString(rec.sessionId, "");
    if (!sessionId) return null;
    return { sessionId, cwd: asString(rec.cwd, "") };
  },
  serialize(params) {
    const rec = parseObject(params);
    const sessionId = asString(rec.sessionId, "");
    if (!sessionId) return null;
    return { sessionId, cwd: asString(rec.cwd, "") };
  },
  getDisplayId(params) {
    const rec = parseObject(params);
    return asString(rec.sessionId, "") || null;
  },
};
