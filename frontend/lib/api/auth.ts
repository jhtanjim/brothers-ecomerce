import { apiFetch } from './client';
import type { AuthUser, LoginInput, RegisterInput, UserProfile } from './types';

/** Sets the HTTP-only session cookies and returns the signed-in user. */
export function login(input: LoginInput): Promise<AuthUser> {
  return apiFetch<AuthUser>('/auth/login', { method: 'POST', body: JSON.stringify(input) });
}

/** Creates a customer account and signs it in. */
export function register(input: RegisterInput): Promise<AuthUser> {
  return apiFetch<AuthUser>('/auth/register', { method: 'POST', body: JSON.stringify(input) });
}

/** Revokes the refresh token and clears the cookies. */
export function logout(): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/auth/logout', { method: 'POST' });
}

/** Rotates the session cookies. Used by the API client, not by components. */
export function refreshSession(): Promise<AuthUser> {
  return apiFetch<AuthUser>('/auth/refresh', { method: 'POST' });
}

/** The current user, or an ApiError with status 401 when signed out. */
export function getMe(): Promise<UserProfile> {
  return apiFetch<UserProfile>('/auth/me');
}