/** Replaced at build time from package.json (see scripts/build.mjs). */
declare const __INTRUVA_MCP_VERSION__: string | undefined;

export const VERSION: string = typeof __INTRUVA_MCP_VERSION__ === "string" ? __INTRUVA_MCP_VERSION__ : "0.0.0-dev";
