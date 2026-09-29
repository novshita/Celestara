/**
 * Server-only HTTP client for the Celestara backend.
 *
 * Imported only from Server Functions (`app/actions.ts`), never from a
 * Client Component. Keeping the fetch server-side means the browser never
 * talks to FastAPI directly - no CORS configuration needed on the backend,
 * and `BACKEND_URL` (unlike `NEXT_PUBLIC_*` variables) is never bundled into
 * client JavaScript, so nothing here specifies the backend's location either.
 */

import "server-only";

import type {
  ApiErrorResponse,
  BirthData,
  CompareChartResponse,
  VedicChartResponse,
  WesternChartResponse,
} from "./types";

const DEFAULT_BACKEND_URL = "http://127.0.0.1:8000";

function backendUrl(): string {
  return process.env.BACKEND_URL ?? DEFAULT_BACKEND_URL;
}

/** Raised for both validation failures (422) and calculation errors (4xx/5xx)
 * the backend reports - callers show `message` as-is, per `app/api/errors.py`'s
 * guarantee that it is always safe to display. */
export class BackendError extends Error {
  readonly code: string;
  readonly fieldErrors: ApiErrorResponse["field_errors"];

  constructor(body: ApiErrorResponse) {
    super(body.message);
    this.code = body.code;
    this.fieldErrors = body.field_errors;
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${backendUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    // Chart calculation is deterministic per input (engineering spec §10),
    // but "no store" keeps this route trivially correct while the caching
    // story for authenticated, per-user data is worked out; correctness
    // over speed matches the project's own stated priority order.
    cache: "no-store",
  });

  if (!response.ok) {
    const errorBody = (await response.json()) as ApiErrorResponse;
    throw new BackendError(errorBody);
  }

  return response.json() as Promise<T>;
}

export async function calculateVedicChart(
  birth: BirthData,
): Promise<VedicChartResponse> {
  return post<VedicChartResponse>("/api/v1/charts/vedic", { birth });
}

export async function calculateWesternChart(
  birth: BirthData,
): Promise<WesternChartResponse> {
  return post<WesternChartResponse>("/api/v1/charts/western", { birth });
}

export async function calculateComparison(
  birth: BirthData,
): Promise<CompareChartResponse> {
  return post<CompareChartResponse>("/api/v1/charts/compare", { birth });
}
