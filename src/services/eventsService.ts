import { apiRequest, USE_MOCKS } from '../lib/api';
import { demoEvents } from '../mocks/events';
import type { CampusEvent } from '../types';

export const eventsService = {
  async list(): Promise<CampusEvent[]> {
    if (USE_MOCKS) return demoEvents;
    // TODO(team-backend): Replace this mock provider with GET /api/events.
    const result = await apiRequest<{ events: CampusEvent[] }>('/api/events');
    return result.events;
  },
  async submitAnnouncement(input: { text?: string; file?: File }): Promise<{ message: string; demo: boolean }> {
    if (USE_MOCKS) return { message: 'Received in demo mode. No OCR or extraction was run.', demo: true };
    const body = new FormData();
    if (input.text) body.set('text', input.text);
    if (input.file) body.set('file', input.file);
    // TODO(team-ai): Connect this upload to the multimodal extraction endpoint.
    return apiRequest('/api/announcements', { method: 'POST', body });
  },
};
