import { ArrowUpRight, CalendarDays, MapPin, Sparkles } from 'lucide-react';
import type { CampusEvent } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatEventDate, formatEventTime } from '../../lib/utils';
import { Badge, DemoLabel } from '../ui/Controls';

export function EventCard({ event, onDetails }: { event: CampusEvent; onDetails: (event: CampusEvent) => void }) {
  const { language, t } = useLanguage();
  const locale = language === 'fr' ? 'fr-FR' : 'en-US';
  return <article className="event-card">
    <div className="event-card-top"><div className="event-category"><span className="category-mark" />{event.category}</div>{event.isDemo && <DemoLabel small />}</div>
    <button className="event-title-button" onClick={() => onDetails(event)}><h3>{event.title}</h3><ArrowUpRight size={16} aria-hidden="true" /></button>
    <p className="event-summary">{event.summary}</p>
    <div className="event-meta"><span><CalendarDays size={14} />{formatEventDate(event.startAt, locale)} · {formatEventTime(event.startAt, locale)}</span><span><MapPin size={14} />{event.campus === 'Cross-campus' && language === 'fr' ? 'Inter-campus' : event.campus}</span></div>
    <div className="event-card-bottom">
      <div className="badge-row">
        {event.statuses.includes('relevant') && <Badge tone="brand"><Sparkles size={12} /> {t('relevantBadge')}</Badge>}
        {event.statuses.includes('cross-campus') && <Badge tone="neutral">{t('crossCampusBadge')}</Badge>}
        {event.statuses.includes('conflict') && <Badge tone="warning">{t('scheduleConflictBadge')}</Badge>}
      </div>
      <div className="event-relevance">{event.relevanceScore != null && <><span>{t('matchLabel')}</span><strong>{event.relevanceScore}%</strong></>}</div>
    </div>
    <div className="event-card-actions">
      <button className="text-link" onClick={() => onDetails(event)}>{t('viewDetails')} <ArrowUpRight size={14} /></button>
      {event.actionUrl && <a className="event-register" href={event.actionUrl} target="_blank" rel="noreferrer">{t('register')} <ArrowUpRight size={13} /></a>}
    </div>
  </article>;
}
