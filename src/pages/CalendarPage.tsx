import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Download, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '../contexts/LanguageContext';
import { eventsService } from '../services/eventsService';
import type { CampusEvent } from '../types';
import { formatEventDate, formatEventTime } from '../lib/utils';
import { canExportEvent, downloadIcs } from '../utils/calendar';
import { EventDetailModal } from '../components/radar/EventDetailModal';
import { Badge, Button, DemoLabel } from '../components/ui/Controls';
import { LoadingState } from '../components/ui/States';

export function CalendarPage() {
  const { language, t } = useLanguage();
  const query = useQuery({ queryKey: ['events'], queryFn: eventsService.list });
  const [campus, setCampus] = useState('all');
  const [category, setCategory] = useState('all');
  const [selected, setSelected] = useState<CampusEvent | null>(null);
  const categories = [...new Set((query.data ?? []).map((event) => event.category))];
  const filtered = useMemo(() => (query.data ?? []).filter((event) => (campus === 'all' || event.campus === campus) && (category === 'all' || event.category === category)).sort((a, b) => new Date(a.startAt ?? '9999-12-31').getTime() - new Date(b.startAt ?? '9999-12-31').getTime()), [query.data, campus, category]);

  return <div className="calendar-page">
    <section className="page-intro"><div><p className="eyebrow">{language === 'fr' ? 'VOS PROCHAINS RENDEZ-VOUS' : 'YOUR UPCOMING MOMENTS'}</p><h2>{t('calendarTitle')}</h2><p>{t('calendarDescription')}</p></div><DemoLabel /></section>
    <section className="calendar-controls"><div className="calendar-controls-icon"><CalendarDays size={19} /></div><div className="calendar-controls-copy"><strong>{t('upcomingEvents')}</strong><span>{filtered.length} {t('eventsInView')}</span></div><label><span className="sr-only">{language === 'fr' ? 'Filtrer par campus' : 'Filter by campus'}</span><select value={campus} onChange={(event) => setCampus(event.target.value)}><option value="all">{t('allCampuses')}</option><option>Rabat</option><option>Ben Guerir</option><option value="Cross-campus">{language === 'fr' ? 'Inter-campus' : 'Cross-campus'}</option></select></label><label><span className="sr-only">{language === 'fr' ? 'Filtrer par catégorie' : 'Filter by category'}</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">{t('allCategories')}</option>{categories.map((value) => <option key={value}>{value}</option>)}</select></label></section>
    {query.isLoading ? <LoadingState label="Loading calendar events…" /> : query.error ? <div className="empty-state"><strong>Calendar data isn’t available.</strong><p>Retry the event service or connect a campus feed.</p><button onClick={() => void query.refetch()}>Retry</button></div> : filtered.length ? <div className="calendar-list">{filtered.map((event) => {
      const exportable = canExportEvent(event);
      return <article className="calendar-row" key={event.id}>
        <div className="calendar-date"><span>{event.startAt ? new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' }).format(new Date(event.startAt)).toUpperCase() : language === 'fr' ? 'À DÉFINIR' : 'TBD'}</span><strong>{event.startAt ? new Date(event.startAt).getDate().toString().padStart(2, '0') : '—'}</strong></div>
        <div className="calendar-row-content"><div className="calendar-row-top"><Badge tone="neutral">{event.category}</Badge>{event.isDemo && <DemoLabel small />}</div><button className="calendar-event-title" onClick={() => setSelected(event)}>{event.title}</button><div className="event-meta"><span>{formatEventDate(event.startAt, language === 'fr' ? 'fr-FR' : 'en-US')} · {formatEventTime(event.startAt, language === 'fr' ? 'fr-FR' : 'en-US')}</span><span><MapPin size={13} />{event.campus === 'Cross-campus' && language === 'fr' ? 'Inter-campus' : event.campus}</span></div></div>
        <div className="calendar-row-actions"><Button variant="outline" size="sm" leadingIcon={<Download size={14} />} disabled={!exportable} title={exportable ? t('addToCalendar') : language === 'fr' ? 'Export indisponible : une date, une heure de fin et un fuseau horaire valides sont requis.' : 'Export unavailable: valid date, end time and timezone are required.'} onClick={() => { if (downloadIcs(event)) toast.success(`${event.isDemo ? 'Demo ' : ''}calendar file downloaded.`); }}>{t('addToCalendar')}</Button><button className="text-link" onClick={() => setSelected(event)}>{t('details')}</button>{!exportable && <span className="field-hint">{language === 'fr' ? 'Date/heure incomplète' : 'Date/time details incomplete'}</span>}</div>
      </article>;
    })}</div> : <div className="empty-state"><span className="empty-icon"><CalendarDays size={20} /></span><strong>No events to show</strong><p>Connected campus events will appear here when available.</p></div>}
    <div className="calendar-footer"><span className="demo-dot" />{language === 'fr' ? 'Les événements démo sont des exemples ; leurs dates ne sont pas confirmées.' : 'Demo events are examples only. Do not rely on them as confirmed campus dates.'}</div>
    <EventDetailModal event={selected} onOpenChange={(open) => { if (!open) setSelected(null); }} />
  </div>;
}
