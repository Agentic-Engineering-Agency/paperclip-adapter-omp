import type { UsageSummary } from "@paperclipai/adapter-utils";
export interface ParsedOmpOutput {
    sessionId: string | null;
    provider: string | null;
    model: string | null;
    costUsd: number | null;
    usage: UsageSummary | null;
    summary: string;
    resultJson: Record<string, unknown> | null;
    errorMessage: string | null;
}
export declare function parseOmpStreamJson(stdout: string): ParsedOmpOutput;
export declare function isOmpUnknownSessionError(stdoutOrError: string | Record<string, unknown> | null | undefined): boolean;
//# sourceMappingURL=parse.d.ts.map