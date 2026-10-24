import { getDemoChatResponse } from '../mocks/chat';
import { apiRequest, USE_MOCKS } from '../lib/api';
import type { ChatResponse } from '../types';

export interface ChatInput { message: string; conversationId?: string; images: File[] }

export const chatService = {
  async send(input: ChatInput): Promise<ChatResponse> {
    if (USE_MOCKS) return getDemoChatResponse(input.message, input.images);
    const form = new FormData();
    form.set('message', input.message);
    if (input.conversationId) form.set('conversationId', input.conversationId);
    input.images.forEach((image) => form.append('images', image));
    // TODO(team-ai): Return grounded answers and source citations from the campus index.
    return apiRequest<ChatResponse>('/api/chat', { method: 'POST', body: form });
  },
};
