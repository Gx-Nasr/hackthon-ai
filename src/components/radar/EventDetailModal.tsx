import { CalendarDays, ExternalLink, MapPin, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import type { CampusEvent } from '../../types';
import { canExportEvent, downloadIcs } from '../../utils/calendar';
import { formatEventDate, formatEventTime } from '../../lib/utils';
import { Badge, Button, DemoLabel } from '../ui/Controls';
import { Modal } from '../ui/Modal';

export function EventDetailModal({ event, onOpenChange }: { event: CampusEvent | null; onOpenChange: (open: boolean) => void }) {
  const available = event ? canExportEvent(event) : false;
  return <Modal open={Boolean(event)} onOpenChange={onOpenChange} title={event?.title ?? 'Event details'} description={event?.category} size="lg">
    {event && <div className="modal-body event-detail-body">
      <div className="event-detail-flags">{event.isDemo && <DemoLabel />}{event.statuses.map((status) => <Badge key={status} tone={status === 'conflict' ? 'warning' : status === 'relevant' ? 'brand' : 'neutral'}>{status === 'conflict' ? 'Schedule conflict' : status === 'relevant' ? 'Relevant for you' : 'Cross-campus'}</Badge>)}</div>
      <p className="event-detail-summary">{event.summary}</p>
      <div className="event-detail-grid"><div><span>Date & time</span><strong>{formatEventDate(event.startAt)} · {formatEventTime(event.startAt)}</strong></div><div><span>Campus</span><strong><MapPin size={15} />{event.campus}</strong></div><div><span>Category</span><strong>{event.category}</strong></div><div><span>Relevance</span><strong>{event.relevanceScore == null ? 'Not provided' : `${event.relevanceScore}%`}</strong></div></div>
      <section className="source-preview"><div className="source-preview-icon"><ShieldAlert size={17} /></div><div><strong>Source preview</strong><p>{event.sourceUrl ? `Source supplied by ${event.sourceName ?? 'campus feed'}.` : 'No live source is attached to this sample. Connect a campus feed to show verified source announcements.'}</p>{event.sourceUrl && <a href={event.sourceUrl} target="_blank" rel="noreferrer">Open source <ExternalLink size={13} /></a>}</div></section>
      {!available && <p className="field-hint">Calendar export is disabled because this event does not include valid start/end timestamps and timezone data.</p>}
      <div className="modal-actions">
        <Button variant="outline" disabled={!available} title={!available ? 'Valid start, end and timezone are required.' : 'Download calendar event'} onClick={() => { if (event && downloadIcs(event)) toast.success('Calendar file downloaded.'); }}>{<CalendarDays size={16} />} Add to calendar</Button>
        {event.actionUrl && <a className="button button-primary" href={event.actionUrl} target="_blank" rel="noreferrer">Register <ExternalLink size={14} /></a>}
      </div>
    </div>}
  </Modal>;
}
