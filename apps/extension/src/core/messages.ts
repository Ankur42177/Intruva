/** Messages exchanged between content script, popup, options and background. */
import type { ComposerHealth } from "../adapters/types";
import type { OptimizeRequest, OptimizeResult } from "@intruva/engine";

export const COMMAND_TOGGLE = "toggle-intruva";

export type ContentMessage = { type: "intruva:toggle" } | { type: "intruva:ping" };

export interface PingResponse {
  ok: true;
  site: ComposerHealth["site"];
  siteName: string;
  health: ComposerHealth;
  panelOpen: boolean;
}

export type BackgroundMessage =
  | { type: "intruva:open-webapp" }
  | { type: "intruva:remote-optimize"; request: OptimizeRequest };

export type OpenWebAppResponse = { ok: boolean; error?: string };

export type RemoteOptimizeResponse =
  | { ok: true; result: OptimizeResult; redacted: number; host: string }
  | { ok: false; error: string };
