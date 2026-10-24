import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { Filter, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { eventsService } from '../services/eventsService';
import type { CampusEvent } from '../types';
import { EventCard } from '../components/dashboard/EventCard';
import { AddAnnouncementModal } from '../components/radar/AddAnnouncementModal';
import { EventDetailModal } from '../components/radar/EventDetailModal';
import { Button, DemoLabel } from '../components/ui/Controls';
import { LoadingState } from '../components/ui/States';

export function RadarPage() {
  const { language, t } = useLanguage();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [campus, setCampus] = useState('all');
  const [category, setCategory] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [relevance, setRelevance] = useState('all');
  const [sort, setSort] = useState('soonest');
  const [announcementOpen, setAnnouncementOpen] = useState(params.get('compose') === '1');
  const [selected, setSelected] = useState<CampusEvent | null>(null);
  const query = useQuery({ queryKey: ['events'], queryFn: eventsService.list });

  useEffect(() => {
    if (params.get('compose') === '1') {
      setAnnouncementOpen(true);
      params.delete('compose');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  const categories = useMemo(() => [...new Set((query.data ?? []).map((event) => event.category))], [query.data]);
  const filtered = useMemo(() => {
    const now = Date.now();
    const events = (query.data ?? []).filter((event) => {
      const terms = `${event.title} ${event.summary} ${event.category} ${event.campus}`.toLowerCase();
      if (search && !terms.includes(search.toLowerCase())) return false;
      if (campus !== 'all' && event.campus !== campus) return false;
      if (category !== 'all' && event.category !== category) return false;
      if (relevance === 'high' && (event.relevanceScore ?? 0) < 80) return false;
      if (dateRange !== 'all' && event.startAt) {
        const time = new Date(event.startAt).getTime();
        const max = dateRange === 'week' ? 7 : 30;
        if (time < now || time > now + max * 86_400_000) return false;
      } else if (dateRange !== 'all' && !event.startAt) return false;
      return true;
    });
    return events.sort((a, b) => sort === 'relevance'
      ? (b.relevanceScore ?? -1) - (a.relevanceScore ?? -1)
      : new Date(a.startAt ?? '9999-12-31').getTime() - new Date(b.startAt ?? '9999-12-31').getTime());
  }, [query.data, search, campus, category, dateRange, relevance, sort]);

  return <div className="radar-page">
    <section className="page-intro"><div><p className="eyebrow">{language === 'fr' ? 'DÉCOUVREZ CE QUI COMPTE' : 'DISCOVER WHAT MATTERS'}</p><h2>{t('radarTitle')}</h2><p>{t('radarDescription')}</p></div><Button variant="primary" leadingIcon={<Plus size={17} />} onClick={() => setAnnouncementOpen(true)}>{t('addAnnouncement')}</Button></section>
    <section className="filter-panel" aria-label={language === 'fr' ? 'Recherche et filtres des événements' : 'Event search and filters'}>
      <label className="search-box"><Search size={17} /><span className="sr-only">{t('search')}</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={language === 'fr' ? 'Rechercher un événement, un sujet, un campus…' : 'Search events, topics, campus…'} /></label>
      <div className="filter-row"><span className="filter-label"><SlidersHorizontal size={15} /> {t('filters')}</span>
        <label><span className="sr-only">Campus</span><select value={campus} onChange={(event) => setCampus(event.target.value)}><option value="all">{t('allCampuses')}</option><option>Rabat</option><option>Ben Guerir</option><option value="Cross-campus">{language === 'fr' ? 'Inter-campus' : 'Cross-campus'}</option></select></label>
        <label><span className="sr-only">{language === 'fr' ? 'Catégorie' : 'Category'}</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">{t('allCategories')}</option>{categories.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span className="sr-only">{language === 'fr' ? 'Date' : 'Date'}</span><select value={dateRange} onChange={(event) => setDateRange(event.target.value)}><option value="all">{t('anyDate')}</option><option value="week">{t('next7Days')}</option><option value="month">{t('next30Days')}</option></select></label>
        <label><span className="sr-only">{language === 'fr' ? 'Pertinence' : 'Relevance'}</span><select value={relevance} onChange={(event) => setRelevance(event.target.value)}><option value="all">{t('anyRelevance')}</option><option value="high">{t('highMatch')}</option></select></label>
        <label className="sort-select"><span className="sr-only">{language === 'fr' ? 'Trier les événements' : 'Sort events'}</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="soonest">{t('soonestFirst')}</option><option value="relevance">{t('bestMatch')}</option></select></label>
      </div>
    </section>
    <div className="results-heading"><div><strong>{filtered.length} {filtered.length === 1 ? 'signal' : language === 'fr' ? 'signaux' : 'signals'}</strong><span> {t('currentView')}</span></div><DemoLabel /></div>
    {query.isLoading ? <LoadingState label="Loading event signals…" /> : query.error ? <div className="empty-state"><strong>Radar couldn’t reach the event feed.</strong><p>Try again, or check that the teammate service is configured.</p><button onClick={() => void query.refetch()}>Retry</button></div> : filtered.length ? <div className="event-grid radar-grid">{filtered.map((event) => <EventCard key={event.id} event={event} onDetails={setSelected} />)}</div> : <div className="empty-state"><span className="empty-icon"><Filter size={20} /></span><strong>{language === 'fr' ? 'Aucun signal ne correspond à ces filtres' : 'No signals match those filters'}</strong><p>{language === 'fr' ? 'Élargissez le campus, la catégorie ou la période.' : 'Try a broader campus, category, or date range.'}</p><button onClick={() => { setSearch(''); setCampus('all'); setCategory('all'); setDateRange('all'); setRelevance('all'); }}>{t('clearFilters')}</button></div>}
    <div className="radar-note"><span className="demo-dot" /><span>Demo data only · No verified live campus feed is connected.</span></div>
    <AddAnnouncementModal open={announcementOpen} onOpenChange={setAnnouncementOpen} />
    <EventDetailModal event={selected} onOpenChange={(open) => { if (!open) setSelected(null); }} />
  </div>;
}
