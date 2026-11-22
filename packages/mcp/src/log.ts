/**
 * stderr-only logging. stdout carries JSON-RPC in stdio mode and must stay clean.
 * Privacy rule: never pass prompt text, answers, findings, or evidence here —
 * only startup, shutdown, and error-class information.
 */
export function log(message: string): void {
  process.stderr.write(`[intruva-mcp] ${message}\n`);
}
