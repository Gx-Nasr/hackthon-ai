import type { CampusEvent } from '../types';

function escapeIcs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function toUtcStamp(value?: string): string | null {
  if (!value || !/(Z|[+-]\d{2}:?\d{2})$/i.test(value)) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function canExportEvent(event: CampusEvent): boolean {
  const start = toUtcStamp(event.startAt);
  const end = toUtcStamp(event.endAt);
  return Boolean(start && end && new Date(event.endAt!).getTime() > new Date(event.startAt!).getTime() && event.timezone);
}

export function makeIcs(event: CampusEvent): string | null {
  if (!canExportEvent(event)) return null;
  const start = toUtcStamp(event.startAt)!;
  const end = toUtcStamp(event.endAt)!;
  const uid = `${event.id}@uniradar.local`;
  const label = event.isDemo ? `[DEMO] ${event.title}` : event.title;
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//UniRadar//Campus Events//EN', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`,
    `DTSTART:${start}`, `DTEND:${end}`, `SUMMARY:${escapeIcs(label)}`,
    `DESCRIPTION:${escapeIcs(`${event.summary} (Timezone: ${event.timezone})`)}`,
    `LOCATION:${escapeIcs(event.campus)}`, 'END:VEVENT', 'END:VCALENDAR', '',
  ];
  return lines.join('\r\n');
}

export function downloadIcs(event: CampusEvent): boolean {
  const content = makeIcs(event);
  if (!content) return false;
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${event.id}.ics`;
  anchor.click();
  URL.revokeObjectURL(url);
  return true;
}
