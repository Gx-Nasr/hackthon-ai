import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { CalendarDays, ChevronDown, Command, LayoutDashboard, LogOut, Menu, MessageCircle, Radar, Settings, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { initials } from '../../lib/utils';
import { BrandMark, Wordmark } from '../ui/Brand';
import { DemoLabel } from '../ui/Controls';
import { ThemeToggle } from '../ui/ThemeToggle';

const items = [
  { to: '/app', key: 'dashboard' as const, icon: LayoutDashboard, end: true },
  { to: '/app/radar', key: 'radar' as const, icon: Radar },
  { to: '/app/chat', key: 'assistant' as const, icon: MessageCircle },
  { to: '/app/calendar', key: 'calendar' as const, icon: CalendarDays },
  { to: '/app/profile', key: 'profile' as const, icon: UserRound },
  { to: '/app/settings', key: 'settings' as const, icon: Settings },
];

function Navigation({ close }: { close?: () => void }) {
  const { t } = useLanguage();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [accountOpen, setAccountOpen] = useState(false);

  async function logout() {
    await signOut();
    toast.success('You’re signed out. See you soon.');
    navigate('/login', { replace: true });
    close?.();
  }

  return <>
    <div className="sidebar-brand"><Wordmark link /></div>
    <div className="sidebar-section-label">{t('workspace')}</div>
    <nav className="side-nav" aria-label="Main navigation">
      {items.map(({ to, key, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={close} className={({ isActive }) => `nav-link${isActive ? ' nav-link-active' : ''}`}>
        <Icon size={18} strokeWidth={1.8} aria-hidden="true" /><span>{t(key)}</span>{location.pathname === to && <span className="nav-active-mark" />}
      </NavLink>)}
    </nav>
    <div className="sidebar-bottom">
      <div className="demo-sidebar"><span className="signal-icon"><Command size={15} /></span><div><strong>{t('campusSignals')}</strong><span>{t('integrationPreview')}</span></div><DemoLabel small /></div>
      <div className="sidebar-tools"><span className="tool-label">{t('appearance')}</span><ThemeToggle /></div>
      <div className="account-wrap">
        {accountOpen && <div className="account-menu" role="menu"><Link to="/app/profile" onClick={() => { setAccountOpen(false); close?.(); }} role="menuitem"><UserRound size={16} /> {t('profile')}</Link><Link to="/app/settings" onClick={() => { setAccountOpen(false); close?.(); }} role="menuitem"><Settings size={16} /> {t('settings')}</Link><button onClick={() => void logout()} role="menuitem"><LogOut size={16} /> {t('signOut')}</button></div>}
        <button className="account-button" aria-expanded={accountOpen} onClick={() => setAccountOpen((open) => !open)}>
          <span className="avatar">{initials(user?.name ?? 'Student')}</span><span className="account-meta"><strong>{user?.name ?? 'Student'}</strong><small>{user?.email ?? 'UM6P student'}</small></span><ChevronDown size={15} className="account-chevron" />
        </button>
      </div>
    </div>
  </>;
}

const routeTitles = {
  '/app': 'dashboardTitle', '/app/radar': 'radar', '/app/chat': 'assistant', '/app/calendar': 'calendar', '/app/profile': 'studentProfile', '/app/settings': 'settings',
} as const;

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { t } = useLanguage();
  const pageTitle = t(routeTitles[location.pathname as keyof typeof routeTitles] ?? 'dashboardTitle');
  const { resolvedTheme } = useTheme();
  return <div className={`app-shell theme-${resolvedTheme}`}>
    <aside className="sidebar desktop-sidebar"><Navigation /></aside>
    <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
      <header className="mobile-header"><Dialog.Trigger asChild><button className="icon-button" aria-label="Open navigation menu"><Menu size={20} /></button></Dialog.Trigger><Link className="mobile-brand" to="/app"><BrandMark compact /><span>UniRadar</span></Link><ThemeToggle /></header>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay mobile-nav-overlay" />
        <Dialog.Content className="mobile-nav-panel" aria-describedby={undefined}>
          <Dialog.Title className="sr-only">UniRadar navigation</Dialog.Title>
          <div className="mobile-nav-top"><Wordmark link /><Dialog.Close asChild><button className="icon-button" aria-label="Close navigation"><X size={19} /></button></Dialog.Close></div>
          <Navigation close={() => setMobileOpen(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
    <main className="main-column">
      <header className="topbar"><div><p className="eyebrow">{t('campusIntelligence')}</p><h1>{pageTitle}</h1></div><div className="topbar-actions"><DemoLabel /><ThemeToggle /></div></header>
      <div className="page-content"><Outlet /></div>
      <footer className="app-footer"><span>UniRadar · {t('tagline')}</span><span>Early access · <Link to="/app/settings">{t('preferences')}</Link></span></footer>
    </main>
  </div>;
}
