/**
 * The one place that calls `fetch` for `/api/v1` (frontend/AGENTS.md "All HTTP calls go through src/api").
 *
 * - Same-origin relative URLs with the session cookie (architecture.md §1 "Session-cookie auth").
 * - Unsafe methods send Django's CSRF token in `X-CSRFToken`; the cookie is fetched once from
 *   `/auth/csrf` and re-read before every request, because Django rotates it on login.
 * - Every error body is `{detail, field}` (architecture.md §3 "Errors") and is thrown as `ApiError`,
 *   so forms can put the message under the right field (US-09/16).
 */
import type { ErrorOut } from "./schema";

const BASE = "/api/v1";
const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** A failed API call: HTTP status plus the backend's `{detail, field}`. */
export class ApiError extends Error {
  readonly status: number;
  readonly field: string | null;

  constructor(status: number, detail: string, field: string | null = null) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.field = field;
  }
}

type QueryValue = string | number | boolean | null | undefined | string[];

/** Builds `?a=1&sport=x&sport=y`; empty values are left out (lists repeat the key, as Ninja expects). */
function queryString(query: Record<string, QueryValue> | undefined): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === "") continue;
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
    else params.append(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

function readCookie(name: string): string | null {
  const match = document.cookie.split("; ").find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

let csrfRequest: Promise<void> | null = null;

/** Makes sure the `csrftoken` cookie exists (GET /auth/csrf sets it); runs at most once at a time. */
async function ensureCsrfCookie(): Promise<string> {
  let token = readCookie("csrftoken");
  if (token) return token;
  csrfRequest ??= fetch(`${BASE}/auth/csrf`, { credentials: "same-origin" }).then(() => undefined);
  try {
    await csrfRequest;
  } finally {
    csrfRequest = null;
  }
  token = readCookie("csrftoken");
  if (!token) throw new ApiError(0, "Could not start a secure session. Reload the page.");
  return token;
}

interface RequestOptions {
  query?: Record<string, QueryValue>;
  body?: unknown;
}

/**
 * Sends one request and returns the parsed JSON body (`undefined` for 204).
 *
 * @throws ApiError on any non-2xx answer, or status 0 when the network is down.
 */
export async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (UNSAFE.has(method)) headers["X-CSRFToken"] = await ensureCsrfCookie();

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}${queryString(options.query)}`, {
      method,
      headers,
      credentials: "same-origin",
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, "No connection. Check your network and try again.");
  }

  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (data ?? {}) as Partial<ErrorOut>;
    throw new ApiError(response.status, error.detail || "Something went wrong. Try again.", error.field ?? null);
  }
  return data as T;
}
