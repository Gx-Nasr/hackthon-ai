// Legacy browser-only preferences are retained as a compatibility/export helper.
// The active profileService no longer reads or writes this demo store; it uses authenticated SQLite-backed APIs.
export interface LegacyProfilePreferences {
  campus?: 'Rabat' | 'Ben Guerir';
  school?: string;
  interests?: string[];
  busySchedule?: Record<string, string[]>;
}
const KEY = 'uniradar-profile-demo';
export function getLegacyDemoProfile(): LegacyProfilePreferences {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as LegacyProfilePreferences; }
  catch { return {}; }
}
