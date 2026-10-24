import type { ChatResponse } from '../types';

// Demo-only interaction. No model, campus index, OCR or image understanding runs here.
export async function getDemoChatResponse(message: string, images: File[]): Promise<ChatResponse> {
  await new Promise((resolve) => window.setTimeout(resolve, 520));
  const attachmentNote = images.length
    ? ` I received ${images.length} image attachment${images.length === 1 ? '' : 's'} in the interface, but demo mode does not analyze images.`
    : '';
  const promptNote = message.trim()
    ? 'Your message is ready for a connected campus assistant.'
    : 'Your attachments are ready for a connected campus assistant.';

  return {
    conversationId: crypto.randomUUID(),
    message: `${promptNote}${attachmentNote}\n\nThis is a demo response. No live campus data or AI processing is connected yet.`,
    demo: true,
  };
}
