import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Clock3, MessageSquarePlus, PanelLeftClose, PanelLeftOpen, RotateCcw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '../contexts/LanguageContext';
import { chatService } from '../services/chatService';
import { USE_MOCKS } from '../lib/api';
import { createLocalId } from '../lib/utils';
import type { ChatMessage as MessageType } from '../types';
import { ChatComposer } from '../components/chat/ChatComposer';
import { ChatMessage } from '../components/chat/ChatMessage';
import { DemoLabel } from '../components/ui/Controls';
import { Button } from '../components/ui/Controls';

interface Conversation { id: string; serverId?: string; title: string; updatedAt: string; messages: MessageType[] }
interface FailedRequest { localId: string; serverId?: string; text: string; files: File[] }
const suggested = [
  'Find AI events happening at Rabat campus.',
  'Do I have any schedule conflicts this week?',
  'Where can I register for the robotics workshop?',
  'wach kayn chi hackathon f rabat had weekend?',
];

export function ChatPage() {
  const { language, t } = useLanguage();
  const [firstId] = useState(() => createLocalId());
  const [conversations, setConversations] = useState<Conversation[]>([{ id: firstId, title: 'New conversation', updatedAt: new Date().toISOString(), messages: [] }]);
  const [activeId, setActiveId] = useState<string>(firstId);
  const [sending, setSending] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [failed, setFailed] = useState<FailedRequest | null>(null);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const objectUrls = useRef<string[]>([]);
  const active = useMemo(() => conversations.find((conversation) => conversation.id === activeId) ?? conversations[0], [conversations, activeId]);
  const messages = active?.messages ?? [];

  useEffect(() => { messagesEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, sending]);
  useEffect(() => () => objectUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  function createConversation() {
    const id = createLocalId();
    setConversations((current) => [{ id, title: 'New conversation', updatedAt: new Date().toISOString(), messages: [] }, ...current]);
    setActiveId(id);
    setFailed(null);
    setHistoryOpen(false);
  }

  async function send(text: string, files: File[], retry = false, conversationId = active?.id ?? firstId, serverId = active?.serverId) {
    if (sending) return;
    const conversation = conversations.find((item) => item.id === conversationId);
    if (!conversation) return;
    setSending(true);
    setFailed(null);
    if (!retry) {
      const userMessage: MessageType = {
        id: createLocalId(), role: 'user', text, createdAt: new Date().toISOString(),
        attachments: files.map((file) => {
          const url = URL.createObjectURL(file);
          objectUrls.current.push(url);
          return { name: file.name, mimeType: file.type, size: file.size, url };
        }),
      };
      setConversations((current) => current.map((item) => item.id === conversationId ? {
        ...item,
        title: item.title === 'New conversation' ? (text.trim().slice(0, 34) || 'Image question') : item.title,
        updatedAt: new Date().toISOString(), messages: [...item.messages, userMessage],
      } : item));
    }
    try {
      const response = await chatService.send({ message: text, conversationId: serverId, images: files });
      const answer: MessageType = {
        id: createLocalId(), role: 'assistant', text: response.message, createdAt: new Date().toISOString(),
        sources: response.sources, attachments: response.attachments, isDemo: response.demo ?? USE_MOCKS,
      };
      setConversations((current) => current.map((item) => item.id === conversationId ? {
        ...item, serverId: response.conversationId, updatedAt: new Date().toISOString(), messages: [...item.messages, answer],
      } : item));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'We couldn’t send that message.';
      setFailed({ localId: conversationId, serverId, text, files });
      toast.error(message);
    } finally { setSending(false); }
  }

  return <div className={`chat-workspace${historyOpen ? ' history-open' : ''}`}>
    <aside className="chat-history">
      <div className="chat-history-head"><div><p className="eyebrow">{t('yourSpace')}</p><h2>{t('conversations')}</h2></div><button className="icon-button" onClick={createConversation} aria-label={language === 'fr' ? 'Démarrer une nouvelle conversation' : 'Start a new conversation'} title={t('newConversation')}><MessageSquarePlus size={18} /></button></div>
      <div className="conversation-list" role="list" aria-label={language === 'fr' ? 'Historique des conversations' : 'Conversation history'}>
        {conversations.map((conversation) => <button key={conversation.id} className={`conversation-item${conversation.id === activeId ? ' active' : ''}`} onClick={() => { setActiveId(conversation.id); setFailed(null); setHistoryOpen(false); }}>
          <span className="conversation-icon"><Bot size={15} /></span><span className="conversation-copy"><strong>{conversation.messages.length === 0 ? t('newConversation') : conversation.title}</strong><small>{conversation.messages.length ? `${conversation.messages.length} ${language === 'fr' ? 'messages' : 'messages'}` : t('noMessagesYet')}</small></span>
        </button>)}
      </div>
      <div className="chat-history-foot"><Clock3 size={14} /><span>{t('historyInBrowser')}</span></div>
    </aside>
    <section className="chat-main">
      <header className="chat-header"><div className="chat-title-wrap"><button className="icon-button history-toggle" onClick={() => setHistoryOpen((open) => !open)} aria-label={historyOpen ? (language === 'fr' ? 'Masquer l’historique des conversations' : 'Hide conversation history') : (language === 'fr' ? 'Afficher l’historique des conversations' : 'Show conversation history')}>{historyOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}</button><div className="chat-agent-mark"><Sparkles size={17} /></div><div><strong>{t('campusAssistant')}</strong><span><i className="status-dot" /> {t('apiIntegrationPreview')}</span></div></div><DemoLabel /></header>
      <div className="chat-scroll" role="log" aria-live="polite" aria-relevant="additions text">
        {messages.length === 0 ? <div className="chat-welcome"><div className="chat-welcome-icon"><Sparkles size={22} /></div><p className="eyebrow">{t('clearerCampusStarts')}</p><h2>{t('whatsOnYourMind')}</h2><p>{language === 'fr' ? 'Posez naturellement votre question. Connectez le service IA du campus pour obtenir des réponses contextualisées.' : t('askNaturally')}</p><div className="prompt-grid">{suggested.map((prompt) => <button key={prompt} className="prompt-card" onClick={() => void send(prompt, [], false, active.id, active.serverId)}>{prompt}<span>↗</span></button>)}</div><DemoLabel /></div> : <div className="message-stack">{messages.map((message) => <ChatMessage key={message.id} message={message} />)}{sending && <div className="assistant-thinking" role="status"><span className="thinking-dots"><i /><i /><i /></span><span>{USE_MOCKS ? (language === 'fr' ? 'Préparation d’une réponse démo…' : 'Preparing a demo reply…') : (language === 'fr' ? 'En attente de l’assistant du campus…' : 'Waiting for the campus assistant…')}</span></div>}{failed && failed.localId === active.id && <div className="chat-error"><p>{language === 'fr' ? 'Le message n’a pas été transmis à l’assistant.' : 'That message didn’t reach the assistant.'}</p><Button size="sm" variant="outline" leadingIcon={<RotateCcw size={14} />} onClick={() => void send(failed.text, failed.files, true, failed.localId, failed.serverId)}>{language === 'fr' ? 'Réessayer' : 'Retry'}</Button></div>}<div ref={messagesEnd} /></div>}
      </div>
      {USE_MOCKS && <div className="chat-demo-banner"><span className="demo-dot" />{t('demoChatDisclosure')}</div>}
      <ChatComposer disabled={sending} onSend={(text, files) => void send(text, files)} />
    </section>
  </div>;
}
