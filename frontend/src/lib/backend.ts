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
  AiChatResponse,
  AiSystem,
  ApiErrorResponse,
  AuthTokenResponse,
  BirthData,
  BirthProfileResponse,
  CompareChartResponse,
  JournalEntry,
  JournalEntryListResponse,
  ReadingPeriod,
  ReadingResponse,
  TransitReportResponse,
  UserResponse,
  VedicChartResponse,
  VimshottariResponse,
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

async function request(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<Response> {
  const { token, headers, ...rest } = init;

  const response = await fetch(`${backendUrl()}${path}`, {
    ...rest,
    headers: {
      ...(rest.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
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

  return response;
}

async function post<T>(
  path: string,
  body: unknown,
  token?: string,
): Promise<T> {
  const response = await request(path, {
    method: "POST",
    body: JSON.stringify(body),
    token,
  });
  return response.json() as Promise<T>;
}

async function put<T>(path: string, body: unknown, token?: string): Promise<T> {
  const response = await request(path, {
    method: "PUT",
    body: JSON.stringify(body),
    token,
  });
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

export async function calculateVimshottariDasha(
  birth: BirthData,
): Promise<VimshottariResponse> {
  return post<VimshottariResponse>("/api/v1/dashas/vimshottari", { birth });
}

export async function calculateTransitReport(
  birth: BirthData,
): Promise<TransitReportResponse> {
  return post<TransitReportResponse>("/api/v1/transits/vedic", { birth });
}

export async function registerUser(
  email: string,
  password: string,
): Promise<UserResponse> {
  return post<UserResponse>("/api/v1/auth/register", { email, password });
}

export async function loginUser(
  email: string,
  password: string,
): Promise<AuthTokenResponse> {
  return post<AuthTokenResponse>("/api/v1/auth/login", { email, password });
}

/** No request body and a 204 response - doesn't go through `post()`, which
 * always sends a JSON body and expects one back. */
export async function logoutSession(token: string): Promise<void> {
  await request("/api/v1/auth/logout", { method: "POST", token });
}

/** `null` means "nothing saved yet" (the backend's 404), not an error -
 * product spec §8's "absence is a valid state, not a failure" applies here
 * just as it does to an unknown birth time. */
export async function getProfile(
  token: string,
): Promise<BirthProfileResponse | null> {
  try {
    const response = await request("/api/v1/profile", { method: "GET", token });
    return (await response.json()) as BirthProfileResponse;
  } catch (error) {
    if (error instanceof BackendError && error.code === "NOT_FOUND") {
      return null;
    }
    throw error;
  }
}

export async function saveProfile(
  token: string,
  birth: BirthData,
): Promise<BirthProfileResponse> {
  const response = await request("/api/v1/profile", {
    method: "PUT",
    body: JSON.stringify({ birth }),
    token,
  });
  return response.json() as Promise<BirthProfileResponse>;
}

export async function listJournalEntries(token: string): Promise<JournalEntry[]> {
  const response = await request("/api/v1/journal", { method: "GET", token });
  const body = (await response.json()) as JournalEntryListResponse;
  return body.entries;
}

export async function createJournalEntry(
  token: string,
  title: string,
  body: string,
): Promise<JournalEntry> {
  return post<JournalEntry>("/api/v1/journal", { title, body }, token);
}

export async function updateJournalEntry(
  token: string,
  id: number,
  title: string,
  body: string,
): Promise<JournalEntry> {
  return put<JournalEntry>(`/api/v1/journal/${id}`, { title, body }, token);
}

/** 204 response, no body - doesn't go through `post()`/`put()`, which both
 * expect a JSON body back. */
export async function deleteJournalEntry(
  token: string,
  id: number,
): Promise<void> {
  await request(`/api/v1/journal/${id}`, { method: "DELETE", token });
}

/** No auth required - product spec §28: the AI Guide, like chart
 * calculation, is explorable without an account. */
export async function askAiGuide(
  birth: BirthData,
  system: AiSystem,
  question: string,
): Promise<AiChatResponse> {
  return post<AiChatResponse>("/api/v1/ai/chat", { birth, system, question });
}

/** No auth required, same as `askAiGuide` - and always grounded in today's
 * transits, recalculated on every call (product spec §13: never a static
 * template). All three periods share one request/response shape; only the
 * path differs. */
export async function getReading(
  birth: BirthData,
  period: ReadingPeriod,
): Promise<ReadingResponse> {
  return post<ReadingResponse>(`/api/v1/readings/${period}`, { birth });
}
