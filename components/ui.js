'use client';

import { useEffect, useId } from 'react';
import { Loader2, X } from 'lucide-react';

const VARIANTS = {
  primary: 'bg-brand text-on-brand hover:opacity-90',
  soft: 'bg-brand-soft text-brand hover:opacity-85 dark:text-ink',
  ghost: 'text-ink hover:bg-surface-2',
  outline: 'border border-line text-ink hover:bg-surface-2',
  danger: 'bg-danger-soft text-danger hover:opacity-85',
};

export function Button({ variant = 'primary', loading, className = '', children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || loading}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
    >
      {loading && <Loader2 size={16} className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function IconButton({ label, className = '', children, ...props }) {
  return (
    <button type="button" aria-label={label} title={label} {...props} className={`grid size-11 shrink-0 place-items-center rounded-xl text-ink hover:bg-surface-2 ${className}`}>
      {children}
    </button>
  );
}

export function Card({ className = '', children, ...props }) {
  return (
    <section {...props} className={`min-w-0 rounded-2xl border border-line bg-surface p-4 sm:p-5 ${className}`}>
      {children}
    </section>
  );
}

export function SectionTitle({ children, action }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="font-display text-base font-bold">{children}</h2>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

const fieldClass = 'w-full min-h-11 rounded-xl border border-line bg-surface px-3 py-2 text-ink placeholder:text-muted focus:border-brand focus:outline-none';

export function Field({ label, hint, error, children, className = '' }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      {label && <span className="mb-1 block text-sm font-semibold">{label}</span>}
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}

export function Input({ className = '', ...props }) {
  return <input {...props} className={`${fieldClass} ${className}`} />;
}

export function Select({ className = '', children, ...props }) {
  return (
    <select {...props} className={`${fieldClass} ${className}`}>
      {children}
    </select>
  );
}

export function Textarea({ className = '', ...props }) {
  return <textarea rows={2} {...props} className={`${fieldClass} ${className}`} />;
}

/** Bottom sheet on phones, centred dialog on larger screens. */
export function Sheet({ open, onClose, title, children, footer }) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button type="button" aria-label="Close" onClick={onClose} className="fade-in absolute inset-0 bg-black/50" />
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="sheet-in relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-surface sm:max-w-lg sm:rounded-3xl">
        <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-3">
          <h2 id={titleId} className="font-display text-lg font-bold">
            {title}
          </h2>
          <IconButton label="Close" onClick={onClose}>
            <X size={20} aria-hidden />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="pb-safe border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Empty({ icon: Icon, title, text, action }) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      {Icon && <Icon size={32} className="text-muted" aria-hidden />}
      <h3 className="mt-3 font-display font-bold">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-xl bg-surface-2 ${className}`} />;
}

export function Badge({ tone = 'neutral', children }) {
  const tones = {
    neutral: 'bg-surface-2 text-muted',
    good: 'bg-good-soft text-income',
    warn: 'bg-warn-soft text-warn',
    danger: 'bg-danger-soft text-danger',
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function Progress({ percent, status = 'ok', planned }) {
  const color = { ok: 'var(--income)', warning: '#c98500', danger: 'var(--expense)', over: 'var(--danger)' }[status];
  return (
    <div className="relative h-2.5 rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, percent)}%`, background: color }} />
      {planned != null && <span className="absolute -top-0.5 h-3.5 w-0.5 bg-ink" style={{ left: `${Math.min(100, planned)}%` }} title="Planned by today" />}
    </div>
  );
}

export function Segmented({ value, onChange, options, label }) {
  return (
    <div role="tablist" aria-label={label} className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-xl bg-surface-2 p-1">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={value === v}
          onClick={() => onChange(v)}
          className={`min-h-9 flex-1 whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition ${value === v ? 'bg-surface text-ink shadow-sm' : 'text-muted'}`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

export function Avatar({ name, image, size = 32 }) {
  const initials = (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt={name} width={size} height={size} referrerPolicy="no-referrer" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span aria-label={name} className="grid shrink-0 place-items-center rounded-full bg-brand-soft font-bold text-brand dark:text-ink" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials}
    </span>
  );
}
