import { Link } from 'react-router-dom';

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return <span className={`brand-mark${compact ? ' brand-mark-compact' : ''}`} aria-hidden="true">
    <svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="15" stroke="currentColor" strokeOpacity=".27" strokeWidth="1.6" /><path d="M20 5a15 15 0 0 1 14.1 10L20 20V5Z" fill="currentColor" /><path d="m20 20 9 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><circle cx="20" cy="20" r="2.7" fill="currentColor" /></svg>
  </span>;
}

export function Wordmark({ link = false }: { link?: boolean }) {
  const content = <><BrandMark /><span className="brand-name">Uni<span>Radar</span></span></>;
  return link ? <Link to="/app" className="brand-lockup" aria-label="UniRadar home">{content}</Link> : <div className="brand-lockup">{content}</div>;
}
