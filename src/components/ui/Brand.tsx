import { Link } from 'react-router-dom';

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return <span className={`brand-mark${compact ? ' brand-mark-compact' : ''}`} aria-hidden="true">
    <img src="/uniradar-mark.webp" alt="" width="36" height="36" />
  </span>;
}

export function Wordmark({ link = false }: { link?: boolean }) {
  const content = <><BrandMark /><span className="brand-name">Uni<span>Radar</span></span></>;
  return link ? <Link to="/app" className="brand-lockup" aria-label="UniRadar home">{content}</Link> : <div className="brand-lockup">{content}</div>;
}
