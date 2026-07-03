import pc from "picocolors";
import { parseOmpStdoutLine } from "../ui/parse-stdout.js";
export function printOmpStreamEvent(raw, debug) {
    const entries = parseOmpStdoutLine(raw, new Date().toISOString());
    for (const entry of entries) {
        if (entry.kind === "assistant" && entry.text)
            console.log(pc.green(entry.text));
        else if (entry.kind === "thinking" && debug)
            console.log(pc.gray(entry.text));
        else if (entry.kind === "user" && debug)
            console.log(pc.blue(`user: ${entry.text}`));
        else if (entry.kind === "init" && debug)
            console.log(pc.cyan(`omp session ${entry.sessionId}`));
        else if (entry.kind === "result" && debug)
            console.log(pc.magenta(`usage in=${entry.inputTokens} out=${entry.outputTokens} cached=${entry.cachedTokens} cost=$${entry.costUsd}`));
        else if ((entry.kind === "stdout" || entry.kind === "system") && debug)
            console.log(pc.gray(entry.text));
    }
}
//# sourceMappingURL=format-event.js.map