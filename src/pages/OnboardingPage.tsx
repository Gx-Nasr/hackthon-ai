import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, GraduationCap, MapPin, Plus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { profileService } from '../services/profileService';
import { useAuth } from '../contexts/AuthContext';
import type { AvailabilityBlock, HomeCampus, ProfileUpdate } from '../types';
import { WeeklyAvailabilityCalendar } from '../components/profile/WeeklyAvailabilityCalendar';
import { Button } from '../components/ui/Controls';
import { Field } from '../components/ui/Controls';
import { LoadingState } from '../components/ui/States';
import { BrandMark } from '../components/ui/Brand';

const SUGGESTED_INTERESTS = ['Open Source', 'Artificial Intelligence', 'Low-Level Systems', 'Competitive Programming', 'Python', 'Robotics', 'Sports', 'Entrepreneurship'];
type Draft = { fullName: string; homeCampus: HomeCampus | ''; school: string; interests: string[]; unavailableBlocks: AvailabilityBlock[] };
const steps = ['Your profile', 'Weekly availability', 'Review'];
export function OnboardingPage() {
  const { user, refresh } = useAuth(); const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['profile'], queryFn: profileService.get });
  const [step, setStep] = useState(0); const [draft, setDraft] = useState<Draft>({ fullName: user?.name ?? '', homeCampus: '', school: '', interests: [], unavailableBlocks: [] });
  const [customInterest, setCustomInterest] = useState(''); const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  useEffect(() => { if (query.data) setDraft({ fullName: query.data.fullName || user?.name || '', homeCampus: query.data.homeCampus ?? '', school: query.data.school, interests: query.data.interests, unavailableBlocks: query.data.unavailableBlocks }); }, [query.data, user?.name]);
  function addInterest(value: string) { const clean = value.trim().slice(0, 60); if (clean && !draft.interests.some((item) => item.toLowerCase() === clean.toLowerCase())) setDraft((current) => ({ ...current, interests: [...current.interests, clean] })); setCustomInterest(''); }
  function continueStep() {
    if (step === 0) {
      if (draft.fullName.trim().length < 2) { setError('Enter your full name.'); return; }
      if (!draft.homeCampus) { setError('Choose your home campus.'); return; }
      if (!draft.school.trim()) { setError('Enter your school or college.'); return; }
      if (!draft.interests.length) { setError('Choose at least one interest or add your own.'); return; }
    }
    setError(''); setStep((current) => Math.min(2, current + 1));
  }
  async function finish() {
    if (!draft.homeCampus || !draft.fullName.trim() || !draft.school.trim() || !draft.interests.length) { setError('Complete each required profile field first.'); setStep(0); return; }
    setSaving(true); setError('');
    try {
      const profile: ProfileUpdate = { fullName: draft.fullName.trim(), homeCampus: draft.homeCampus, school: draft.school.trim(), interests: draft.interests, unavailableBlocks: draft.unavailableBlocks };
      const saved = await profileService.save(profile); queryClient.setQueryData(['profile'], saved); await refresh(); toast.success('Your campus profile is ready.'); navigate('/app', { replace: true });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save your onboarding. Please try again.'); }
    finally { setSaving(false); }
  }
  if (query.isLoading) return <LoadingState label="Preparing your student profile…" />;
  if (query.error) return <main className="onboarding-error"><strong>Your profile could not load.</strong><p>Please retry before continuing so your saved information is preserved.</p><button onClick={() => void query.refetch()}>Retry</button></main>;
  return <main className="onboarding-page"><header className="onboarding-header"><a href="/login" className="brand-lockup"><BrandMark /><span className="brand-name">Uni<span>Radar</span></span></a><span className="student-id-pill">Student ID · {query.data?.studentId ?? user?.studentId}</span></header>
    <div className="onboarding-frame"><section className="onboarding-title"><p className="eyebrow">YOUR UNI RADAR · SETUP</p><h1>Make room for what matters.</h1><p>Tell us a little about your campus and the times you’re unavailable. You can update this any time in My Profile.</p></section>
      <div className="onboarding-steps" aria-label="Onboarding progress">{steps.map((label, index) => <div key={label} className={`onboarding-step${step === index ? ' active' : step > index ? ' complete' : ''}`}><span>{step > index ? <Check size={14} /> : index + 1}</span><strong>{label}</strong></div>)}</div>
      <section className="onboarding-card" aria-live="polite">
        {step === 0 && <div className="onboarding-section"><div className="onboarding-section-heading"><span><Sparkles size={18} /></span><div><h2>About you</h2><p>Required details help shape your campus experience.</p></div></div>
          <div className="onboarding-form-grid"><Field label="Full name" autoComplete="name" required value={draft.fullName} onChange={(event) => setDraft({ ...draft, fullName: event.target.value })} placeholder="Your full name" /><label className="field"><span className="field-label">Home campus <i>Required</i></span><select className="select-input" required value={draft.homeCampus} onChange={(event) => setDraft({ ...draft, homeCampus: event.target.value as HomeCampus | '' })}><option value="">Choose your campus</option><option value="Rabat">Rabat</option><option value="Ben Guerir">Ben Guerir</option></select></label><Field label="School or college" required value={draft.school} onChange={(event) => setDraft({ ...draft, school: event.target.value })} placeholder="e.g. College of Computing" /></div>
          <fieldset className="onboarding-interests"><legend>What are you into? <span>Select at least one, or add your own.</span></legend><div className="interest-chips">{SUGGESTED_INTERESTS.map((interest) => <label className={`interest-chip${draft.interests.includes(interest) ? ' selected' : ''}`} key={interest}><input type="checkbox" checked={draft.interests.includes(interest)} onChange={() => setDraft({ ...draft, interests: draft.interests.includes(interest) ? draft.interests.filter((item) => item !== interest) : [...draft.interests, interest] })} /><span>{draft.interests.includes(interest) && <Check size={12} />}{interest}</span></label>)}</div><div className="custom-interest-row"><input className="text-input" value={customInterest} maxLength={60} onChange={(event) => setCustomInterest(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addInterest(customInterest); } }} placeholder="Add another interest" /><Button type="button" variant="secondary" leadingIcon={<Plus size={15} />} onClick={() => addInterest(customInterest)}>Add</Button></div>{draft.interests.filter((item) => !SUGGESTED_INTERESTS.includes(item)).length > 0 && <div className="custom-interest-list">{draft.interests.filter((item) => !SUGGESTED_INTERESTS.includes(item)).map((item) => <button key={item} type="button" onClick={() => setDraft({ ...draft, interests: draft.interests.filter((value) => value !== item) })}>{item} ×</button>)}</div>}</fieldset>
        </div>}
        {step === 1 && <div className="onboarding-section"><div className="onboarding-section-heading"><span><MapPin size={18} /></span><div><h2>When are you busy?</h2><p>Mark time you’re unavailable—not time you’re free. Leave any day blank when you have no commitments.</p></div></div><WeeklyAvailabilityCalendar value={draft.unavailableBlocks} onChange={(unavailableBlocks) => setDraft({ ...draft, unavailableBlocks })} /><div className="onboarding-week-example"><GraduationCap size={16} /><span>Example: Monday 08:00–12:00 Lectures, then 14:00–16:00 Labs.</span></div></div>}
        {step === 2 && <div className="onboarding-section"><div className="onboarding-section-heading"><span><Check size={18} /></span><div><h2>Your week, at a glance</h2><p>Review your details and unavailable periods before finishing setup.</p></div></div><div className="onboarding-review-grid"><div><span>Full name</span><strong>{draft.fullName}</strong></div><div><span>Home campus</span><strong>{draft.homeCampus}</strong></div><div><span>School / college</span><strong>{draft.school}</strong></div><div className="review-interests"><span>Interests</span><strong>{draft.interests.join(' · ')}</strong></div></div><WeeklyAvailabilityCalendar value={draft.unavailableBlocks} onChange={(unavailableBlocks) => setDraft({ ...draft, unavailableBlocks })} /><p className="onboarding-private-note">Your student profile and availability are saved to your account. Only you can access or update them.</p></div>}
        {error && <p className="field-error onboarding-error-message" role="alert">{error}</p>}
        <div className="onboarding-footer"><span>Step {step + 1} of 3 · You can update your profile later.</span><div>{step > 0 && <Button type="button" variant="ghost" leadingIcon={<ArrowLeft size={15} />} onClick={() => { setError(''); setStep((current) => current - 1); }}>Back</Button>}{step < 2 ? <Button type="button" variant="primary" leadingIcon={<ArrowRight size={15} />} onClick={continueStep}>Continue</Button> : <Button type="button" variant="primary" loading={saving} leadingIcon={<Check size={15} />} onClick={() => void finish()}>Complete setup</Button>}</div></div>
      </section><p className="onboarding-footer-note">Your schedule is private to your UniRadar account and can be changed anytime.</p>
    </div></main>;
}
