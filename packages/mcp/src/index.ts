/**
 * intruva-mcp CLI entry.
 *
 *   intruva-mcp                      stdio transport (default; for Claude Desktop, Cursor, ...)
 *   intruva-mcp --http [--port N] [--host H]   Streamable HTTP at http://H:N/mcp
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { startHttp } from "./http";
import { log } from "./log";
import { createServer } from "./server";
import { VERSION } from "./version";

const DEFAULT_PORT = 8765;
const DEFAULT_HOST = "127.0.0.1";

const HELP = `intruva-mcp ${VERSION} — Intruva prompt-intelligence MCP server (local, rule-based, no network)

Usage:
  intruva-mcp                         Run over stdio (default)
  intruva-mcp --http [--port N] [--host H]
                                      Run Streamable HTTP (stateless) at http://H:N/mcp
                                      Defaults: --host ${DEFAULT_HOST} --port ${DEFAULT_PORT}
  intruva-mcp --version               Print version
  intruva-mcp --help                  Show this help

Tools: intruva_analyze_prompt, intruva_optimize_prompt, intruva_scan_prompt, intruva_list_task_types
`;

interface Cli {
  http: boolean;
  port: number;
  host: string;
}

function fail(message: string): never {
  process.stderr.write(`intruva-mcp: ${message}\n\n${HELP}`);
  process.exit(2);
}

function parseArgs(argv: string[]): Cli {
  const cli: Cli = { http: false, port: DEFAULT_PORT, host: DEFAULT_HOST };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const [flag, inline] = arg.startsWith("--") && arg.includes("=") ? arg.split(/=(.*)/s, 2) : [arg, undefined];
    const value = () => {
      const v = inline ?? argv[++i];
      if (v === undefined || v.startsWith("--")) fail(`${flag} needs a value`);
      return v;
    };
    switch (flag) {
      case "--help":
      case "-h":
        process.stdout.write(HELP);
        process.exit(0);
      case "--version":
      case "-v":
        process.stdout.write(`${VERSION}\n`);
        process.exit(0);
      case "--stdio":
        cli.http = false;
        break;
      case "--http":
        cli.http = true;
        break;
      case "--port": {
        const n = Number(value());
        if (!Number.isInteger(n) || n < 0 || n > 65535) fail("--port must be an integer between 0 and 65535");
        cli.port = n;
        break;
      }
      case "--host":
        cli.host = value();
        break;
      default:
        fail(`unknown argument: ${arg}`);
    }
  }
  return cli;
}

async function main() {
  const cli = parseArgs(process.argv.slice(2));

  if (cli.http) {
    const http = await startHttp({ host: cli.host, port: cli.port });
    log(`v${VERSION} listening on ${http.url} (Streamable HTTP, stateless)`);
    const stop = () => void http.close().then(() => process.exit(0));
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
    return;
  }

  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log(`v${VERSION} running on stdio`);
  const stop = () => void server.close().finally(() => process.exit(0));
  process.stdin.on("end", stop);
  process.stdin.on("close", stop);
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((err: unknown) => {
  const code = (err as NodeJS.ErrnoException)?.code;
  log(`failed to start: ${code ?? (err instanceof Error ? err.message : String(err))}`);
  process.exit(1);
});
