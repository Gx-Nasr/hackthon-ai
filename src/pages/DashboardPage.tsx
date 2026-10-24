import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BellPlus, CalendarDays, CircleAlert, Compass, MessageCircle, Sparkles, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { eventsService } from '../services/eventsService';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { EventCard } from '../components/dashboard/EventCard';
import { AddAnnouncementModal } from '../components/radar/AddAnnouncementModal';
import { EventDetailModal } from '../components/radar/EventDetailModal';
import { Button, DemoLabel } from '../components/ui/Controls';
import { LoadingState } from '../components/ui/States';
import type { CampusEvent } from '../types';
import { formatEventDate } from '../lib/utils';

export function DashboardPage() {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<CampusEvent | null>(null);
  const events = useQuery({ queryKey: ['events'], queryFn: eventsService.list });
  const date = new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
  const data = events.data ?? [];
  const metrics = [
    { label: t('relevantEvents'), value: data.filter((event) => event.statuses.includes('relevant')).length, icon: Sparkles, note: language === 'fr' ? 'Selon vos intérêts démo' : 'Based on demo interests' },
    { label: t('upcomingEvents'), value: data.length, icon: CalendarDays, note: language === 'fr' ? 'Dans ce fil d’exemple' : 'In this sample feed' },
    { label: t('scheduleConflicts'), value: data.filter((event) => event.statuses.includes('conflict')).length, icon: CircleAlert, note: language === 'fr' ? 'Aucune API d’emploi du temps' : 'No schedule API connected' },
    { label: t('crossCampusAlerts'), value: data.filter((event) => event.statuses.includes('cross-campus')).length, icon: Compass, note: language === 'fr' ? 'Sur les campus démo' : 'Across demo campuses' },
  ];

  return <div className="dashboard-page">
    <section className="welcome-panel">
      <div className="welcome-copy"><div className="welcome-kicker"><span className="pulse-dot" /> {t('yourCampusInFocus')} <DemoLabel small /></div><p className="welcome-date">{date}</p><h2>{t('goodToSeeYou')} {user?.name.split(' ')[0] ?? 'there'}.</h2><p>{t('tagline')}</p><div className="welcome-actions"><Link className="button button-primary button-lg" to="/app/chat"><MessageCircle size={17} />{t('askUniRadar')}<ArrowRight size={15} /></Link><Button variant="outline" size="lg" leadingIcon={<BellPlus size={17} />} onClick={() => setAddOpen(true)}>{t('addAnnouncement')}</Button></div></div>
      <div className="welcome-orbit" aria-hidden="true"><div className="orbit orbit-outer"><div className="orbit orbit-inner"><span className="orbit-center" /><i className="orbit-ping ping-one" /><i className="orbit-ping ping-two" /></div></div><span className="orbit-caption">RABAT · BEN GUERIR</span></div>
    </section>

    <section className="section-block">
      <div className="section-heading"><div><p className="eyebrow">{t('atAGlance')}</p><h2>{t('campusPulse')}</h2></div><DemoLabel /></div>
      {events.isLoading ? <LoadingState label="Loading demo event signals…" /> : events.error ? <div className="inline-error">We couldn’t load the event feed. <button onClick={() => void events.refetch()}>Try again</button></div> : <div className="metric-grid">{metrics.map(({ label, value, icon: Icon, note }) => <article className="metric-card" key={label}><div className="metric-top"><span className="metric-icon"><Icon size={17} /></span><span className="metric-caption">DEMO</span></div><strong className="metric-value">{value.toString().padStart(2, '0')}</strong><span className="metric-label">{label}</span><small>{note}</small></article>)}</div>}
    </section>

    <section className="section-block event-section">
      <div className="section-heading"><div><p className="eyebrow">{language === 'fr' ? 'DEPUIS VOTRE RADAR CAMPUS' : 'FROM YOUR CAMPUS RADAR'}</p><h2>{t('comingUp')}</h2></div><Link className="text-link" to="/app/radar">{t('exploreAllEvents')} <ArrowRight size={15} /></Link></div>
      {events.isLoading ? <div className="event-grid">{[1, 2].map((i) => <div className="skeleton-card" key={i}><div className="skeleton-line short" /><div className="skeleton-line title" /><div className="skeleton-line" /></div>)}</div> : events.error ? <div className="empty-state"><p>Events aren’t available right now.</p><button onClick={() => void events.refetch()}>Retry</button></div> : data.length ? <div className="event-grid">{data.slice(0, 2).map((event) => <EventCard key={event.id} event={event} onDetails={setSelected} />)}</div> : <div className="empty-state"><span className="empty-icon"><CalendarDays size={20} /></span><strong>{t('noUpcomingEvents')}</strong><p>{language === 'fr' ? 'Les événements pertinents apparaîtront lorsqu’un fil du campus sera connecté.' : 'When a campus feed is connected, relevant events will appear here.'}</p></div>}
    </section>

    <section className="quick-actions-panel"><div><p className="eyebrow">{t('makeItYours')}</p><h2>{t('smallActions')}</h2><p>{t('keepDetailsClose')}</p></div><div className="quick-actions"><button onClick={() => setAddOpen(true)}><span><Upload size={17} /></span><strong>{t('uploadPoster')}</strong><small>{t('imageOrPdf')}</small></button><Link to="/app/radar?compose=1"><span><BellPlus size={17} /></span><strong>{t('pasteAnnouncement')}</strong><small>{t('startHandoff')}</small></Link><Link to="/app/chat"><span><MessageCircle size={17} /></span><strong>{t('askQuestion')}</strong><small>{t('openAssistant')}</small></Link><Link to="/app/calendar"><span><CalendarDays size={17} /></span><strong>{t('openCalendar')}</strong><small>{t('seeNext')}</small></Link></div></section>
    <p className="demo-disclaimer">{language === 'fr' ? 'Les données démo sont illustratives et ne constituent pas des informations vérifiées de l’université.' : 'Demo data is illustrative only and is not verified university information.'} {data[0]?.startAt ? `${language === 'fr' ? 'Prochaine date démo' : 'Next sample date'}: ${formatEventDate(data[0].startAt, language === 'fr' ? 'fr-FR' : 'en-US').replace(/\.+$/, '')}.` : ''}</p>

    <AddAnnouncementModal open={addOpen} onOpenChange={setAddOpen} />
    <EventDetailModal event={selected} onOpenChange={(open) => { if (!open) setSelected(null); }} />
  </div>;
}
