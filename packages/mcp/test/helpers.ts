import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { createServer } from "../src/server";

/** Raw secret values planted in the engine's "secret" demo sample (all fake). */
export const RAW_SECRETS = ["sk-proj-EXAMPLEdoNotUse4f9a2cB71d0e", "Hunter2pass", "admin:Hunter2pass"];

export async function connectInMemory() {
  const server = createServer();
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "intruva-test", version: "0.0.0" });
  await Promise.all([server.connect(serverT), client.connect(clientT)]);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

export async function call(client: Client, name: string, args: Record<string, unknown>) {
  return (await client.callTool({ name, arguments: args })) as CallToolResult;
}

export function textOf(r: CallToolResult): string {
  return r.content
    .filter((c): c is { type: "text"; text: string } => c.type === "text")
    .map((c) => c.text)
    .join("\n");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function structured(r: CallToolResult): any {
  if (r.isError) throw new Error(`tool returned isError: ${textOf(r)}`);
  if (!r.structuredContent) throw new Error("missing structuredContent");
  return r.structuredContent;
}

/** Serialise everything a client could see from a tool result. */
export function everything(r: unknown): string {
  return JSON.stringify(r);
}
