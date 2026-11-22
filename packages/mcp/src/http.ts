/**
 * Streamable HTTP transport (stateless). One McpServer per POST /mcp request,
 * JSON responses, no sessions. Bound to 127.0.0.1 by default with Host/Origin
 * checks against DNS-rebinding, since there is no authentication.
 */
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { log } from "./log";
import { createServer } from "./server";
import { VERSION } from "./version";

export interface HttpOptions {
  host: string;
  port: number;
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function hostnameOf(value: string | undefined, withScheme: boolean): string | null {
  if (!value) return null;
  try {
    return new URL(withScheme ? value : `http://${value}`).hostname;
  } catch {
    return null;
  }
}

function jsonError(res: ServerResponse, status: number, message: string) {
  if (res.headersSent) return;
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message }, id: null }));
}

export async function startHttp(opts: HttpOptions): Promise<{ url: string; port: number; close: () => Promise<void> }> {
  const loopbackOnly = LOOPBACK.has(opts.host);

  const handler = async (req: IncomingMessage, res: ServerResponse) => {
    const path = (req.url ?? "/").split("?")[0];

    if (loopbackOnly) {
      const host = hostnameOf(req.headers.host, false);
      if (!host || !LOOPBACK.has(host)) return jsonError(res, 403, "Forbidden host");
      const origin = req.headers.origin;
      if (origin && !LOOPBACK.has(hostnameOf(origin, true) ?? "")) return jsonError(res, 403, "Forbidden origin");
    }

    if (path === "/healthz" && req.method === "GET") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, name: "intruva-mcp", version: VERSION }));
      return;
    }
    if (path !== "/mcp") return jsonError(res, 404, "Not found. The MCP endpoint is /mcp");
    if (req.method !== "POST") {
      res.setHeader("allow", "POST");
      return jsonError(res, 405, "Method not allowed (stateless server: use POST /mcp)");
    }

    const server = createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (err) {
      log(`HTTP request failed: ${err instanceof Error ? err.name : typeof err}`);
      jsonError(res, 500, "Internal server error");
    }
  };

  const http = createHttpServer((req, res) => void handler(req, res));
  await new Promise<void>((resolve, reject) => {
    http.once("error", reject);
    http.listen(opts.port, opts.host, () => {
      http.off("error", reject);
      resolve();
    });
  });
  const port = (http.address() as AddressInfo).port;
  const shownHost = opts.host.includes(":") && !opts.host.startsWith("[") ? `[${opts.host}]` : opts.host;
  const url = `http://${shownHost}:${port}/mcp`;
  if (!loopbackOnly)
    log(`WARNING: listening on ${opts.host} without authentication. Anyone who can reach this port can call the tools.`);
  return {
    url,
    port,
    close: () =>
      new Promise<void>((resolve) => {
        http.closeAllConnections?.();
        http.close(() => resolve());
      }),
  };
}
