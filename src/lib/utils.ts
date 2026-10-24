import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...values: ClassValue[]) { return twMerge(clsx(values)); }

// Browser-local item identifiers, including HTTP previews on the campus LAN.
// randomUUID is secure-context-only; getRandomValues also works over HTTP.
export function createLocalId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function formatEventDate(value?: string, locale?: string): string {
  if (!value) return 'Date not provided';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date not provided';
  return new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric' }).format(date);
}

export function formatEventTime(value?: string, locale?: string): string {
  if (!value) return 'Time not provided';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time not provided';
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(date);
}

export function initials(value: string): string {
  return value.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'U';
}
