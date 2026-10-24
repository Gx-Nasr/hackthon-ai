import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { USE_MOCKS } from '../../lib/api';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
  leadingIcon?: ReactNode;
}

export function Button({ variant = 'secondary', size = 'md', loading, leadingIcon, className, children, disabled, ...props }: ButtonProps) {
  return <button className={cn('button', `button-${variant}`, `button-${size}`, className)} disabled={disabled || loading} {...props}>
    {loading ? <LoaderCircle className="spin" size={16} aria-hidden="true" /> : leadingIcon}
    {children}
  </button>;
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  trailing?: ReactNode;
}

export function Field({ label, error, hint, trailing, id, className, ...props }: FieldProps) {
  const inputId = id ?? props.name;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  return <div className="field">
    <label htmlFor={inputId} className="field-label">{label}</label>
    <div className="input-wrap">
      <input id={inputId} className={cn('text-input', error && 'input-error', className)} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : hint ? hintId : undefined} {...props} />
      {trailing && <span className="input-trailing">{trailing}</span>}
    </div>
    {error ? <p className="field-error" id={errorId}>{error}</p> : hint ? <p className="field-hint" id={hintId}>{hint}</p> : null}
  </div>;
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'brand' | 'warning' | 'success' | 'danger'; className?: string }) {
  return <span className={cn('badge', `badge-${tone}`, className)}>{children}</span>;
}

export function DemoLabel({ small = false }: { small?: boolean }) {
  return <span className={cn('demo-label', small && 'demo-label-small')}><span className="demo-dot" />{USE_MOCKS ? 'Demo data' : 'Campus data'}</span>;
}
