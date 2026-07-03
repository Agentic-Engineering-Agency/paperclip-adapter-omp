import type { AdapterModel } from "@paperclipai/adapter-utils";
/** Map `omp models omniroute --json` output ({models: [{selector, name, id}]}) to AdapterModel[]. */
export declare function mapOmpCatalog(json: unknown): AdapterModel[];
/** Map OpenAI-style gateway `/v1/models` output ({data: [{id}]}) to AdapterModel[]. */
export declare function mapGatewayCatalog(json: unknown): AdapterModel[];
export type OmniRouteModelSource = "omp-cli" | "gateway" | "static";
export declare function discoverOmniRouteModels(): Promise<{
    models: AdapterModel[];
    source: OmniRouteModelSource;
}>;
export declare function listOmniRouteModels(): Promise<AdapterModel[]>;
export declare function refreshOmniRouteModels(): Promise<AdapterModel[]>;
//# sourceMappingURL=models.d.ts.map