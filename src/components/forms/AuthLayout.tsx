import type { ReactNode } from 'react';
import { ArrowUpRight, Compass, Radar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Wordmark } from '../ui/Brand';

export function AuthLayout({ eyebrow, title, description, children, alternate }: { eyebrow: string; title: string; description: string; children: ReactNode; alternate: ReactNode }) {
  return <main className="auth-page">
    <section className="auth-story"><div className="auth-story-inner"><Wordmark link /><div className="auth-story-copy"><span className="auth-story-kicker"><Radar size={15} /> THE CAMPUS SIGNAL DESK</span><h1>Your campus,<br /><span>without the chaos.</span></h1><p>Less noise. More of what matters to your next class, idea, and opportunity.</p><div className="story-signal"><span className="story-signal-icon"><Compass size={19} /></span><div><strong>Clear signals, close by.</strong><small>Rabat · Ben Guerir · wherever you’re headed</small></div><ArrowUpRight size={15} /></div></div><span className="auth-story-foot">UM6P STUDENT WORKSPACE <span>·</span> EARLY ACCESS</span><div className="auth-graphic" aria-hidden="true"><div className="auth-ring ring-one" /><div className="auth-ring ring-two" /><div className="auth-ring ring-three" /><i className="auth-beacon beacon-one" /><i className="auth-beacon beacon-two" /></div></div></section>
    <section className="auth-form-panel"><div className="auth-form-wrap"><AuthBrandLink /><div className="auth-form-heading"><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p>{description}</p></div>{children}<div className="auth-alternate">{alternate}</div><p className="auth-legal">By continuing, you agree to use UniRadar responsibly. Account sessions are protected by the UniRadar server.</p></div></section>
  </main>;
}

export function AuthBrandLink() { return <Link to="/login" className="auth-mobile-brand"><Wordmark /></Link>; }
