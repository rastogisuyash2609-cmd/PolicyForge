export type ApiErrorKind =
  | "network"
  | "timeout"
  | "cancelled"
  | "http"
  | "invalid-json"
  | "contract"
  | "validation"
  | "disabled";
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly kind: ApiErrorKind,
    public readonly status?: number,
    public readonly diagnostics?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export type Decoder<T> = (value: unknown, path?: string) => T;
export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
)
  .trim()
  .replace(/\/+$/, "");
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
export function normalizeHttpError(status: number, body: unknown): ApiError {
  const detail = object(body) ? body.detail : undefined;
  if (object(detail) && typeof detail.code === "string" && typeof detail.message === "string")
    return new ApiError(detail.message.slice(0, 400), "http", status, detail);
  const fields = Array.isArray(detail)
    ? detail
        .filter(object)
        .map((entry) => ({
          loc: Array.isArray(entry.loc)
            ? entry.loc
                .filter((x) => typeof x === "string" || typeof x === "number")
                .join(".")
            : "Request",
          msg:
            typeof entry.msg === "string"
              ? entry.msg.slice(0, 250)
              : "Invalid value",
          type: entry.type,
        }))
        .slice(0, 12)
    : [];
  const message =
    status === 422
      ? fields.length
        ? fields.map((f) => `${f.loc}: ${f.msg}`).join("; ")
        : "The API rejected this input. Review rules and journey values."
      : status >= 500
        ? `The backend could not complete this request (HTTP ${status}). Retry, or inspect the server logs.`
        : status === 404
          ? "This API endpoint was not found. Check the backend URL and version."
          : typeof detail === "string" &&
              detail.length < 400 &&
              !/traceback|exception|file \"|\bat 0x/i.test(detail)
            ? detail
            : `The API rejected this request (HTTP ${status}).`;
  return new ApiError(message, "http", status, fields.length ? fields : body);
}
export interface HttpConfig {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}
export function createTransport(config: HttpConfig = {}) {
  const base = (config.baseUrl ?? API_BASE_URL).replace(/\/+$/, "");
  return async function request<T>(
    endpoint: string,
    decode: Decoder<T>,
    options: { body?: unknown; signal?: AbortSignal; timeoutMs?: number; headers?: Record<string, string> } = {},
  ): Promise<T> {
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort();
    if (options.signal?.aborted)
      throw new ApiError("Request cancelled.", "cancelled");
    options.signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(
      () => {
        timedOut = true;
        controller.abort();
      },
      options.timeoutMs ?? config.timeoutMs ?? 30_000,
    );
    try {
      const response = await (config.fetchImpl ?? fetch)(`${base}${endpoint}`, {
        method: options.body === undefined ? "GET" : "POST",
        headers:
          options.body === undefined
            ? { Accept: "application/json" }
            : {
                Accept: "application/json",
                "Content-Type": "application/json",
                ...options.headers,
              },
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });
      const text = await response.text();
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        if (!response.ok)
          throw normalizeHttpError(response.status, {
            diagnostic_body: text.slice(0, 2000),
          });
        throw new ApiError(
          text.trim()
            ? "The API returned invalid JSON. Check the backend URL and server logs."
            : "The API returned an empty response where analysis data was expected.",
          "invalid-json",
          response.status,
        );
      }
      if (!response.ok) throw normalizeHttpError(response.status, body);
      if (controller.signal.aborted)
        throw new ApiError("Request cancelled.", "cancelled");
      try {
        return decode(body);
      } catch (cause: unknown) {
        throw new ApiError(
          "The API response does not match the expected contract. Check the backend version before retrying.",
          "contract",
          response.status,
          cause instanceof Error ? cause.message : cause,
        );
      }
    } catch (cause: unknown) {
      if (timedOut)
        throw new ApiError(
          "The request timed out. The backend may still be processing it. Retry when ready.",
          "timeout",
        );
      if (controller.signal.aborted)
        throw new ApiError("Request cancelled.", "cancelled");
      if (cause instanceof ApiError) throw cause;
      throw new ApiError(
        `Unable to connect to PolicyForge at ${base}. Check that FastAPI is running, then retry.`,
        "network",
        undefined,
        cause instanceof Error ? cause.message : cause,
      );
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
    }
  };
}
