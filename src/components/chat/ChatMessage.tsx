import { useState } from 'react';
import { Check, Copy, ExternalLink, Sparkles, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import type { ChatMessage as MessageType } from '../../types';
import { DemoLabel } from '../ui/Controls';

export function ChatMessage({ message }: { message: MessageType }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  async function copy() {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch { toast.error('Could not copy this response.'); }
  }

  return <article className={`chat-message ${isUser ? 'message-user' : 'message-assistant'}`}>
    <div className="message-avatar">{isUser ? <UserRound size={16} /> : <Sparkles size={16} />}</div>
    <div className="message-content">
      <div className="message-meta"><strong>{isUser ? 'You' : 'UniRadar'}</strong><time dateTime={message.createdAt}>{new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(message.createdAt))}</time>{message.isDemo && !isUser && <DemoLabel small />}</div>
      {message.text && <p className="message-text" dir="auto">{message.text}</p>}
      {message.attachments?.length ? <div className="message-attachments">{message.attachments.map((attachment, index) => <div className="sent-attachment" key={`${attachment.name}-${index}`}>
        {attachment.url ? <img src={attachment.url} alt={`Attached image: ${attachment.name}`} /> : <span>{attachment.name}</span>}
      </div>)}</div> : null}
      {message.sources?.length ? <div className="citation-list"><span>Sources</span>{message.sources.map((source, index) => <a key={`${source.title}-${index}`} href={source.url ?? '#'} target={source.url ? '_blank' : undefined} rel={source.url ? 'noreferrer' : undefined}>{source.title}{source.url && <ExternalLink size={12} />}</a>)}</div> : null}
      {!isUser && <button className="copy-action" onClick={() => void copy()} aria-label="Copy response">{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? 'Copied' : 'Copy'}</button>}
    </div>
  </article>;
}
