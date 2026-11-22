/**
 * Intruva Developer API — Cloudflare Worker entry point.
 * One engine for every surface: this imports `@intruva/engine` directly.
 */
import "./warmup";
import { handle } from "./app";
import type { Ctx, Env } from "./env";

export default {
  fetch(request: Request, env: Env, ctx: Ctx): Promise<Response> {
    return handle(request, env, ctx);
  },
};
