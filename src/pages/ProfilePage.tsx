import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, GraduationCap, MapPin, Plus, Save, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { profileService } from '../services/profileService';
import type { AvailabilityBlock, HomeCampus, ProfileUpdate, StudentProfile } from '../types';
import { WeeklyAvailabilityCalendar } from '../components/profile/WeeklyAvailabilityCalendar';
import { Button, Field } from '../components/ui/Controls';
import { LoadingState } from '../components/ui/States';

const INTERESTS = ['Open Source', 'Artificial Intelligence', 'Low-Level Systems', 'Competitive Programming', 'Python', 'Robotics', 'Sports', 'Entrepreneurship'];
export function ProfilePage() {
  const { user, refresh } = useAuth(); const { language, t } = useLanguage(); const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['profile'], queryFn: profileService.get });
  const [profile, setProfile] = useState<StudentProfile | null>(null); const [customInterest, setCustomInterest] = useState(''); const [saving, setSaving] = useState(false);
  useEffect(() => { if (query.data) setProfile(query.data); }, [query.data]);
  function toggleInterest(value: string) { if (!profile) return; setProfile({ ...profile, interests: profile.interests.includes(value) ? profile.interests.filter((item) => item !== value) : [...profile.interests, value] }); }
  function addInterest() { if (!profile) return; const value = customInterest.trim().slice(0, 60); if (value && !profile.interests.some((item) => item.toLowerCase() === value.toLowerCase())) setProfile({ ...profile, interests: [...profile.interests, value] }); setCustomInterest(''); }
  async function save() {
    if (!profile || !profile.homeCampus || !profile.fullName.trim() || !profile.school.trim() || !profile.interests.length) { toast.error('Name, home campus, school and at least one interest are required.'); return; }
    setSaving(true);
    try {
      const update: ProfileUpdate = { fullName: profile.fullName.trim(), homeCampus: profile.homeCampus as HomeCampus, school: profile.school.trim(), interests: profile.interests, unavailableBlocks: profile.unavailableBlocks as AvailabilityBlock[] };
      const saved = await profileService.save(update); setProfile(saved); queryClient.setQueryData(['profile'], saved); await refresh(); toast.success('Your profile and weekly availability were saved to your account.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save your profile.'); }
    finally { setSaving(false); }
  }
  function cancel() { setProfile(query.data ?? null); }
  if (query.isLoading) return <LoadingState label="Loading your profile…" />;
  if (query.error) return <div className="empty-state"><strong>Profile could not load.</strong><button onClick={() => void query.refetch()}>Retry</button></div>;
  if (!profile) return <LoadingState label="Loading your profile…" />;
  const french = language === 'fr';
  return <div className="profile-page">
    <section className="page-intro"><div><p className="eyebrow">{french ? 'À VOTRE IMAGE' : 'MAKE IT PERSONAL'}</p><h2>{french ? 'Un campus adapté à vos envies.' : 'A campus view that fits you.'}</h2><p>{french ? 'Vos préférences et créneaux indisponibles sont enregistrés dans votre compte.' : 'Your preferences and unavailable times are saved to your account and restored when you return.'}</p></div><span className="student-id-pill">Student ID · {profile.studentId}</span></section>
    <div className="profile-layout">
      <section className="settings-card account-card"><div className="card-heading"><div className="settings-card-icon"><UserRound size={18} /></div><div><h3>{t('account')}</h3><p>{french ? 'Identité étudiante liée au serveur.' : 'Student identity stored on the UniRadar server.'}</p></div></div><div className="profile-form-grid"><Field label={french ? 'Nom complet' : 'Full name'} required value={profile.fullName} onChange={(event) => setProfile({ ...profile, fullName: event.target.value })} /><div className="account-detail"><span>{t('universityEmail')}</span><strong>{user?.email}</strong></div></div><div className="account-detail"><span>Student ID</span><strong>{profile.studentId}</strong></div></section>
      <section className="settings-card profile-form-card"><div className="card-heading"><div className="settings-card-icon"><MapPin size={18} /></div><div><h3>{t('campusAndInterests')}</h3><p>{french ? 'Informations modifiables et enregistrées dans votre compte.' : 'Editable details saved to your account.'}</p></div></div>
        <div className="profile-form-grid"><label className="field"><span className="field-label">{t('campus')}</span><select className="select-input" value={profile.homeCampus ?? ''} onChange={(event) => setProfile({ ...profile, homeCampus: (event.target.value || null) as HomeCampus | null })}><option value="">Choose your campus</option><option value="Rabat">Rabat</option><option value="Ben Guerir">Ben Guerir</option></select></label><Field label={t('schoolProgram')} value={profile.school} onChange={(event) => setProfile({ ...profile, school: event.target.value })} placeholder="e.g. College of Computing" /></div>
        <fieldset className="interest-fieldset"><legend>{t('interests')}</legend><div className="interest-chips">{INTERESTS.map((interest) => <label key={interest} className={`interest-chip${profile.interests.includes(interest) ? ' selected' : ''}`}><input type="checkbox" checked={profile.interests.includes(interest)} onChange={() => toggleInterest(interest)} /><span>{profile.interests.includes(interest) && <Check size={12} />}{interest}</span></label>)}</div><div className="custom-interest-row"><input className="text-input" value={customInterest} onChange={(event) => setCustomInterest(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addInterest(); } }} placeholder="Add a custom interest" /><Button type="button" variant="secondary" leadingIcon={<Plus size={14} />} onClick={addInterest}>Add</Button></div><div className="custom-interest-list">{profile.interests.filter((item) => !INTERESTS.includes(item)).map((item) => <button type="button" key={item} onClick={() => setProfile({ ...profile, interests: profile.interests.filter((value) => value !== item) })}>{item} ×</button>)}</div></fieldset>
      </section>
      <section className="settings-card profile-availability-card"><div className="card-heading"><div className="settings-card-icon"><GraduationCap size={18} /></div><div><h3>{french ? 'Disponibilités hebdomadaires' : 'Weekly unavailable times'}</h3><p>{french ? 'Les blocs orange indiquent les périodes où vous êtes occupé, pas vos heures libres.' : 'Orange blocks mean you are busy/unavailable — not free. This schedule is stored with your account.'}</p></div></div><WeeklyAvailabilityCalendar value={profile.unavailableBlocks} onChange={(unavailableBlocks) => setProfile({ ...profile, unavailableBlocks })} /></section>
    </div>
    <div className="sticky-actions"><span>{french ? 'Enregistré dans votre compte UniRadar.' : 'Saved to your UniRadar account. Only you can access this profile.'}</span><div><Button variant="ghost" leadingIcon={<X size={15} />} onClick={cancel}>{t('cancel')}</Button><Button variant="primary" loading={saving} leadingIcon={<Save size={15} />} onClick={() => void save()}>{t('saveChanges')}</Button></div></div>
  </div>;
}
