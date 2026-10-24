import { useNavigate } from 'react-router-dom';
import { Monitor, Moon, Sun, Languages, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme, type ThemeChoice } from '../contexts/ThemeContext';
import { Button, DemoLabel } from '../components/ui/Controls';

export function SettingsPage() {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const themeOptions: Array<{ value: ThemeChoice; title: string; desc: string; icon: typeof Sun }> = [
    { value: 'light', title: t('lightTheme'), desc: t('brightAndCalm'), icon: Sun },
    { value: 'dark', title: t('darkTheme'), desc: t('lowLightWorkspace'), icon: Moon },
    { value: 'system', title: t('systemTheme'), desc: t('followDevice'), icon: Monitor },
  ];

  async function logout() {
    try { await signOut(); toast.success('You’re signed out.'); navigate('/login', { replace: true }); }
    catch { toast.error('Sign-out failed. Please try again.'); }
  }

  return <div className="settings-page">
    <section className="page-intro"><div><p className="eyebrow">{language === 'fr' ? 'VOTRE ESPACE' : 'YOUR WORKSPACE'}</p><h2>{t('settingsTitle')}</h2><p>{language === 'fr' ? 'Le thème et la langue sont enregistrés dans ce navigateur. Les intégrations IA du campus attendent l’API de l’équipe.' : 'Theme and language are saved in this browser. Campus AI settings await the team API.'}</p></div><DemoLabel /></section>
    <section className="settings-card appearance-card"><div className="card-heading"><div className="settings-card-icon"><Sun size={18} /></div><div><h3>{t('appearance')}</h3><p>{language === 'fr' ? 'Choisissez l’apparence de votre espace sur toutes les pages.' : 'Choose how the workspace looks across pages.'}</p></div></div><div className="theme-options" role="radiogroup" aria-label={language === 'fr' ? 'Préférence de thème' : 'Theme preference'}>{themeOptions.map(({ value, title, desc, icon: Icon }) => <button key={value} className={`theme-option${theme === value ? ' selected' : ''}`} role="radio" aria-checked={theme === value} onClick={() => setTheme(value)}><span className="theme-preview"><Icon size={18} /></span><strong>{title}</strong><small>{desc}</small>{theme === value && <span className="theme-selected-mark" />}</button>)}</div></section>
    <section className="settings-card language-card"><div className="card-heading"><div className="settings-card-icon"><Languages size={18} /></div><div><h3>{language === 'fr' ? 'Langue' : 'Language'}</h3><p>{language === 'fr' ? 'Les principaux libellés, titres et filtres de l’interface sont disponibles en français. Les données des événements restent dans la langue de leur source.' : 'Core navigation, page headings and filters are available in French. Event content remains in its source language.'}</p></div></div><label className="language-select"><span>{t('interfaceLanguage')}</span><select className="select-input" value={language} onChange={(event) => setLanguage(event.target.value as 'en' | 'fr')}><option value="en">English</option><option value="fr">Français</option></select></label><p className="field-hint">{language === 'fr' ? 'La capacité linguistique de l’assistant dépend du service IA connecté ; aucune capacité n’est revendiquée en mode démo.' : 'The assistant’s language capability depends on the connected AI backend; no language support is claimed in demo mode.'}</p></section>
    <section className="settings-card account-settings-card"><div className="card-heading"><div className="settings-card-icon"><UserRound size={18} /></div><div><h3>{t('accountDetails')}</h3><p>{language === 'fr' ? 'L’authentification est gérée par le serveur UniRadar.' : 'Authentication is handled by the UniRadar server.'}</p></div></div><div className="settings-account-row"><div className="avatar large-avatar">{user?.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</div><div><strong>{user?.name}</strong><span>{user?.email}</span></div><ShieldCheck size={17} className="verified-icon" /></div></section>
    <section className="settings-card integrations-card"><div className="card-heading"><div className="settings-card-icon"><Monitor size={18} /></div><div><h3>{t('connectedServices')}</h3><p>{language === 'fr' ? 'Les intégrations restent des espaces réservés jusqu’à leur connexion par l’équipe.' : 'Backend integrations are explicit placeholders until your teammates connect them.'}</p></div></div><div className="integration-row"><span className="integration-status demo-status" /><div><strong>Campus events & AI assistant</strong><span>{language === 'fr' ? 'Fournisseurs démo actifs · aucune donnée vérifiée' : 'Demo providers active · no verified campus data'}</span></div><DemoLabel small /></div><div className="integration-row"><span className="integration-status active-status" /><div><strong>UniRadar authentication</strong><span>{language === 'fr' ? 'API de session fonctionnelle' : 'Working local session API'}</span></div><span className="connected-label">{language === 'fr' ? 'Connecté' : 'Connected'}</span></div></section>
    <section className="signout-card"><div><strong>{language === 'fr' ? 'Se déconnecter de UniRadar' : 'Sign out of UniRadar'}</strong><p>{language === 'fr' ? 'Votre session serveur actuelle sera révoquée.' : 'Your current server session will be revoked.'}</p></div><Button variant="outline" leadingIcon={<LogOut size={16} />} onClick={() => void logout()}>{t('signOut')}</Button></section>
  </div>;
}
