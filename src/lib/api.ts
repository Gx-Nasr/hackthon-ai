import type { ApiErrorShape } from '../types';

const configuredBase = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '');
export const API_BASE = configuredBase ?? '';
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

export class ApiError extends Error {
  status: number;
  code?: string;
  fieldErrors?: Record<string, string>;

  constructor(message: string, status: number, extra: Partial<ApiErrorShape> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = extra.code;
    this.fieldErrors = extra.fieldErrors;
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
      credentials: 'include',
    });
  } catch {
    throw new ApiError('Could not reach the UniRadar service. Check your connection and try again.', 0);
  }

  const payload = (await response.json().catch(() => ({}))) as ApiErrorShape;
  if (!response.ok) {
    throw new ApiError(payload.message || 'Something went wrong. Please try again.', response.status, payload);
  }
  return payload as T;
}

export function readableError(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
