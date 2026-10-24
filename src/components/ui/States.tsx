import { CircleAlert, LoaderCircle } from 'lucide-react';

export function LoadingState({ label = 'Loading your workspace…' }: { label?: string }) {
  return <div className="state-panel" role="status"><LoaderCircle className="spin" size={20} /><span>{label}</span></div>;
}

export function ErrorState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return <section className="state-panel state-error"><CircleAlert size={20} /><div><strong>{title}</strong><p>{body}</p>{action}</div></section>;
}
