/**
 * Consistent, sanitized errors: `{ "error": { "code", "message" }, "request_id" }`.
 * Messages are fixed strings written here — never exception text, stack traces,
 * or anything echoed from the request body.
 */

export type ErrorCode =
  | "not_found"
  | "method_not_allowed"
  | "missing_api_key"
  | "invalid_api_key"
  | "invalid_authorization"
  | "forbidden_origin"
  | "rate_limited"
  | "unsupported_media_type"
  | "payload_too_large"
  | "invalid_json"
  | "invalid_request"
  | "prompt_empty"
  | "prompt_too_short"
  | "prompt_too_long"
  | "internal_error";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly headers: Record<string, string> = {},
    /** Request field the error refers to, when there is one. */
    public readonly field?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  body(requestId: string) {
    return {
      error: { code: this.code, message: this.message, ...(this.field ? { field: this.field } : {}) },
      request_id: requestId,
    };
  }
}

export const invalid = (field: string, message: string) => new ApiError(400, "invalid_request", message, {}, field);
