import { useMemo, useState } from 'react';
import { CalendarPlus, Clock3, Pencil, Plus, Trash2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Controls';
import type { AvailabilityBlock, Weekday } from '../../types';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
const ACTIVITY_SUGGESTIONS = ['Lectures', 'Labs', 'Studying', 'Personal Commitments'];
const HOURS = Array.from({ length: 24 }, (_, index) => index);
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const minutes = (time: string) => { const [hours, mins] = time.split(':').map(Number); return hours * 60 + mins; };
const displayTime = (time: string) => time;

export function WeeklyAvailabilityCalendar({ value, onChange }: { value: AvailabilityBlock[]; onChange: (next: AvailabilityBlock[]) => void }) {
  const [selectedDay, setSelectedDay] = useState<Weekday>(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AvailabilityBlock | null>(null);
  const [form, setForm] = useState({ dayOfWeek: 1 as Weekday, startTime: '08:00', endTime: '09:00', activityName: '' });
  const [error, setError] = useState('');
  const ordered = useMemo(() => [...value].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)), [value]);
  const totalMinutes = ordered.reduce((sum, block) => sum + Math.max(0, minutes(block.endTime) - minutes(block.startTime)), 0);
  const dayCount = new Set(ordered.map((block) => block.dayOfWeek)).size;

  function openAdd(day: Weekday = selectedDay) {
    setEditing(null); setError(''); setForm({ dayOfWeek: day, startTime: '08:00', endTime: '09:00', activityName: '' }); setDialogOpen(true);
  }
  function openEdit(block: AvailabilityBlock) {
    setEditing(block); setError(''); setForm({ dayOfWeek: block.dayOfWeek, startTime: block.startTime, endTime: block.endTime, activityName: block.activityName ?? '' }); setDialogOpen(true);
  }
  function saveBlock(event: React.FormEvent) {
    event.preventDefault(); setError('');
    if (!timePattern.test(form.startTime) || !timePattern.test(form.endTime) || minutes(form.startTime) >= minutes(form.endTime)) { setError('End time must be later than start time. Choose a valid 24-hour time range.'); return; }
    const overlaps = value.some((block) => block.dayOfWeek === form.dayOfWeek && block.id !== editing?.id && minutes(form.startTime) < minutes(block.endTime) && minutes(block.startTime) < minutes(form.endTime));
    if (overlaps) { setError(`This time overlaps another busy block on ${DAY_NAMES[form.dayOfWeek - 1]}. Adjust the start or end time.`); return; }
    const nextBlock: AvailabilityBlock = { ...form, activityName: form.activityName.trim() || null, ...(editing?.id ? { id: editing.id } : { id: crypto.randomUUID() }) };
    onChange(editing ? value.map((block) => block.id === editing.id ? nextBlock : block) : [...value, nextBlock]);
    setSelectedDay(form.dayOfWeek); setDialogOpen(false);
  }
  function deleteBlock() { if (editing) onChange(value.filter((block) => block.id !== editing.id)); setDialogOpen(false); }
  function dayBlocks(day: Weekday) { return ordered.filter((block) => block.dayOfWeek === day); }
  function blockStyle(block: AvailabilityBlock) { return { top: `${minutes(block.startTime) / 1440 * 100}%`, height: `${Math.max(1.7, (minutes(block.endTime) - minutes(block.startTime)) / 1440 * 100)}%` }; }
  function column(day: Weekday, mobile = false) {
    return <div className={`availability-day-column${mobile ? ' mobile-calendar-column' : ''}`} key={day}>
      <div className="availability-day-heading"><strong>{DAY_NAMES[day - 1]}</strong><span>{dayBlocks(day).length} {dayBlocks(day).length === 1 ? 'period' : 'periods'}</span></div>
      <div className="availability-day-track">{HOURS.map((hour) => <div key={hour} className="availability-hour-line" style={{ top: `${hour / 24 * 100}%` }}><span>{String(hour).padStart(2, '0')}:00</span></div>)}
        {dayBlocks(day).map((block) => <button key={block.id} type="button" className="availability-block" style={blockStyle(block)} onClick={() => openEdit(block)} aria-label={`Edit ${DAY_NAMES[day - 1]} ${block.startTime} to ${block.endTime}${block.activityName ? `, ${block.activityName}` : ''}`}><span className="availability-block-time">{displayTime(block.startTime)}–{displayTime(block.endTime)}</span>{block.activityName && <span className="availability-block-name">{block.activityName}</span>}<Pencil size={12} className="availability-edit-icon" aria-hidden="true" /></button>)}
        {!dayBlocks(day).length && <span className="availability-empty-day">No busy periods</span>}
      </div>
    </div>;
  }

  return <section className="availability-calendar" aria-label="Weekly unavailable-time calendar">
    <div className="availability-intro"><div><p className="availability-important"><Clock3 size={15} /> Mark when you’re busy or unavailable — not when you’re free.</p><p>Orange blocks show times UniRadar should keep clear. Add lectures, labs, studying, or personal commitments.</p></div><Button type="button" variant="primary" leadingIcon={<Plus size={15} />} onClick={() => openAdd()}><span className="desktop-add-label">Add busy time</span><span className="mobile-add-label">Add time</span></Button></div>
    <div className="availability-mobile-switcher" role="group" aria-label="Choose weekday">{DAY_NAMES.map((day, index) => <button type="button" key={day} className={selectedDay === index + 1 ? 'active' : ''} aria-pressed={selectedDay === index + 1} onClick={() => setSelectedDay((index + 1) as Weekday)}>{day.slice(0, 3)}</button>)}</div>
    <div className="availability-desktop-grid"><div className="availability-time-axis" aria-hidden="true"><div className="availability-axis-heading">TIME</div>{HOURS.map((hour) => <span key={hour}>{String(hour).padStart(2, '0')}:00</span>)}</div><div className="availability-day-grid">{DAY_NAMES.map((_, index) => column((index + 1) as Weekday))}</div></div>
    {column(selectedDay, true)}
    <div className="availability-summary"><div className="availability-summary-top"><div><span className="eyebrow">WEEKLY SUMMARY</span><strong>{ordered.length} unavailable {ordered.length === 1 ? 'period' : 'periods'}</strong></div><span>{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m busy · {dayCount} {dayCount === 1 ? 'day' : 'days'}</span></div>
      {ordered.length ? <ul>{ordered.map((block) => <li key={block.id}><span className="summary-day">{DAY_NAMES[block.dayOfWeek - 1]}</span><span className="summary-time">{block.startTime}–{block.endTime}</span><span className="summary-activity">{block.activityName || 'Busy'}</span><button type="button" onClick={() => openEdit(block)} aria-label={`Edit ${DAY_NAMES[block.dayOfWeek - 1]} ${block.startTime} block`}><Pencil size={14} /></button><button type="button" onClick={() => onChange(value.filter((item) => item.id !== block.id))} aria-label={`Delete ${DAY_NAMES[block.dayOfWeek - 1]} ${block.startTime} block`}><Trash2 size={14} /></button></li>)}</ul> : <p className="availability-none">No unavailable periods added. You can leave your week empty or add times when you’re busy.</p>}
    </div>
    <Modal open={dialogOpen} onOpenChange={setDialogOpen} title={editing ? 'Edit unavailable time' : 'Add unavailable time'} description="Choose when you are busy. The end time must be later than the start time.">
      <form className="availability-editor" onSubmit={saveBlock}>
        <label><span>Day</span><select className="select-input" value={form.dayOfWeek} onChange={(event) => setForm({ ...form, dayOfWeek: Number(event.target.value) as Weekday })}>{DAY_NAMES.map((day, index) => <option key={day} value={index + 1}>{day}</option>)}</select></label>
        <div className="availability-time-fields"><label><span>Start time</span><input className="text-input" type="time" required value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} /></label><label><span>End time</span><input className="text-input" type="time" required value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} /></label></div>
        <label><span>Activity <small>Optional</small></span><input className="text-input" list="availability-activities" maxLength={80} value={form.activityName} onChange={(event) => setForm({ ...form, activityName: event.target.value })} placeholder="e.g. Lectures, Labs, Studying" /><datalist id="availability-activities">{ACTIVITY_SUGGESTIONS.map((activity) => <option key={activity} value={activity} />)}</datalist></label>
        {error && <p className="field-error availability-error" role="alert">{error}</p>}
        <div className="modal-actions">{editing && <Button type="button" variant="danger" leadingIcon={<Trash2 size={15} />} onClick={deleteBlock}>Delete</Button>}<Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" variant="primary" leadingIcon={<CalendarPlus size={15} />}>{editing ? 'Save changes' : 'Add period'}</Button></div>
      </form>
    </Modal>
  </section>;
}
