import type { ApiResponse, PaginationMeta } from './types';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, status: number, code: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Server: call NestJS directly. Browser: same-origin, proxied by Next.js rewrites. */
function baseUrl(): string {
  return typeof window === 'undefined' ? (process.env.BACKEND_URL ?? 'http://localhost:4000') : '';
}

interface SuccessEnvelope<T> {
  data: T;
  meta?: PaginationMeta;
}

/** Auth endpoints never trigger a refresh: a 401 there is a real answer, not an expired session. */
const NO_REFRESH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

/**
 * Refresh tokens rotate, and reusing one invalidates the whole session family.
 * All requests that hit a 401 at the same time must therefore share ONE refresh call.
 */
let refreshInFlight: Promise<boolean> | null = null;

function refreshSessionOnce(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

async function send<T>(path: string, init: RequestInit): Promise<{ response: Response; body: ApiResponse<T> | null }> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  // FormData: the browser must set the multipart boundary itself, so no JSON header.
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (init.body && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl()}/api/v1${path}`, {
      ...init,
      headers,
      credentials: 'include',
    });
  } catch {
    throw new ApiError('Unable to reach the server', 0, 'NETWORK_ERROR');
  }

  let body: ApiResponse<T> | null;
  try {
    body = (await response.json()) as ApiResponse<T>;
  } catch {
    body = null;
  }
  return { response, body };
}

/** Shared request + error handling for the versioned REST API. Returns the success envelope. */
async function request<T>(path: string, init: RequestInit = {}): Promise<SuccessEnvelope<T>> {
  let result = await send<T>(path, init);

  const canRefresh =
    typeof window !== 'undefined' &&
    result.response.status === 401 &&
    !NO_REFRESH_PATHS.some((p) => path.startsWith(p));

  if (canRefresh && (await refreshSessionOnce())) {
    result = await send<T>(path, init);
  }

  const { response, body } = result;
  if (!response.ok || body === null || body.success === false) {
    const failure = body && body.success === false ? body : null;
    throw new ApiError(
      failure?.message ?? 'Unexpected server response',
      response.status,
      failure?.code ?? 'UNKNOWN_ERROR',
      failure?.details,
    );
  }

  return { data: body.data, meta: body.meta };
}

/** Typed fetch for the versioned REST API. Returns `data` from the response envelope. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await request<T>(path, init);
  return data;
}

/** Typed fetch for paginated endpoints. Returns the items together with the pagination meta. */
export async function apiFetchPage<T>(
  path: string,
  init: RequestInit = {},
): Promise<{ items: T[]; meta: PaginationMeta }> {
  const { data, meta } = await request<T[]>(path, init);
  if (!meta) {
    throw new ApiError('Unexpected server response', 500, 'MISSING_PAGINATION_META');
  }
  return { items: data, meta };
}