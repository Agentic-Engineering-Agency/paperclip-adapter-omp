import path from "node:path";
const LOCAL_CLI_PATHS = [".bun/bin", ".local/bin"];
const MAC_CLI_PATHS = ["/opt/homebrew/bin", "/usr/local/bin"];
function prependMissing(pathValue, additions) {
    const parts = pathValue.split(path.delimiter).filter(Boolean);
    const missing = additions.filter((entry) => entry && !parts.includes(entry));
    return [...missing, ...parts].join(path.delimiter);
}
export function ensureLocalOmpPath(env, home = process.env.HOME) {
    const homePaths = home ? LOCAL_CLI_PATHS.map((entry) => path.join(home, entry)) : [];
    return {
        ...env,
        PATH: prependMissing(env.PATH ?? "", [...homePaths, ...MAC_CLI_PATHS]),
    };
}
//# sourceMappingURL=path.js.map