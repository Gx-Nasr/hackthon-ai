import { apiRequest } from '../lib/api';
import type { User } from '../types';

export interface Credentials { email: string; password: string; rememberMe?: boolean }
export interface Registration { name: string; email: string; password: string }

export const authService = {
  async currentUser(): Promise<User | null> {
    try { return (await apiRequest<{ user: User }>('/api/auth/me')).user; }
    catch (error) {
      if (error instanceof Error && 'status' in error && (error as { status: number }).status === 401) return null;
      throw error;
    }
  },
  async login(data: Credentials): Promise<User> {
    return (await apiRequest<{ user: User }>('/api/auth/login', { method: 'POST', body: JSON.stringify(data) })).user;
  },
  async signup(data: Registration): Promise<User> {
    return (await apiRequest<{ user: User }>('/api/auth/signup', { method: 'POST', body: JSON.stringify({ ...data, termsAccepted: true }) })).user;
  },
  async logout(): Promise<void> { await apiRequest<{ success: boolean }>('/api/auth/logout', { method: 'POST' }); },
};
