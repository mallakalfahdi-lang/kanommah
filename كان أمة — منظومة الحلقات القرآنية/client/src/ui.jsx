import React from 'react';
import { Loader2, X, Inbox, Sparkles } from 'lucide-react';

export function Card({ title, sub, icon: Icon, actions, children, className = '', pad = true }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-head">
          <div className="card-title">
            {Icon && <span className="card-ico"><Icon size={18} strokeWidth={1.75} /></span>}
            <div>
              <h3>{title}</h3>
              {sub && <p className="muted sm">{sub}</p>}
            </div>
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      <div className={pad ? 'card-body' : ''}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, icon: Icon, tone = 'brand' }) {
  return (
    <div className={`stat stat-${tone}`}>
      <div className="stat-top">
        <span className="muted sm">{label}</span>
        {Icon && <span className="stat-ico"><Icon size={17} strokeWidth={1.75} /></span>}
      </div>
      <div className="stat-value">{value}</div>
      {hint && <div className="muted xs">{hint}</div>}
    </div>
  );
}

export function Badge({ children, tone = 'neutral' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

const STATUS_TONE = {
  present: 'ok', late10: 'warn', absent: 'bad', excused: 'info',
  paid: 'ok', unpaid: 'bad', pending: 'warn', accepted: 'ok', rejected: 'bad',
  submitted: 'info', graded: 'ok', warning: 'bad', notice: 'info', review: 'warn'
};

export function StatusBadge({ status, label }) {
  return <Badge tone={STATUS_TONE[status] || 'neutral'}>{label || status || '—'}</Badge>;
}

export function Table({ head, children, empty = 'لا توجد بيانات لعرضها.' }) {
  const rows = React.Children.toArray(children).filter(Boolean);
  if (!rows.length) return <EmptyState text={empty} />;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
}

export function EmptyState({ text, icon: Icon = Inbox }) {
  return (
    <div className="empty">
      <Icon size={30} strokeWidth={1.5} />
      <p>{text}</p>
    </div>
  );
}

export function Skeleton({ rows = 4 }) {
  return (
    <div className="skel">
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="skel-line" style={{ width: `${92 - i * 7}%` }} />)}
    </div>
  );
}

export function Loading({ text = 'جارٍ التحميل…' }) {
  return (
    <div className="loading"><Loader2 size={20} className="spin" strokeWidth={1.75} /><span>{text}</span></div>
  );
}

export function Field({ label, hint, children, required }) {
  return (
    <label className="field">
      <span className="field-label">{label}{required && <em> *</em>}</span>
      {children}
      {hint && <span className="muted xs">{hint}</span>}
    </label>
  );
}

export function Row({ cols = 2, children }) {
  return <div className={`form-row cols-${cols}`}>{children}</div>;
}

export function Modal({ open, title, onClose, children, footer, wide }) {
  if (!open) return null;
  return (
    <div className="modal-back" onClick={onClose}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="إغلاق"><X size={18} strokeWidth={1.75} /></button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

export function Bar({ value, max = 100, tone = 'brand', label }) {
  const w = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="bar-wrap">
      {label && <span className="muted xs">{label}</span>}
      <div className="bar"><div className={`bar-fill bar-${tone}`} style={{ width: `${w}%` }} /></div>
    </div>
  );
}

export function Donut({ value, label, size = 132 }) {
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div className="donut" style={{ '--v': v, width: size, height: size }}>
      <div className="donut-hole">
        <strong>{v}%</strong>
        <span className="muted xs">{label}</span>
      </div>
    </div>
  );
}

export function Avatar({ name = '' }) {
  const parts = String(name).replace(/^أ\.\s*/, '').split(' ').filter(Boolean);
  const initials = (parts[0]?.[0] || '؟') + (parts[1] ? ` ${parts[1][0]}` : '');
  return <span className="avatar">{initials}</span>;
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.key} role="tab" aria-selected={active === t.key}
          className={`tab ${active === t.key ? 'is-active' : ''}`} onClick={() => onChange(t.key)}>
          {t.label}{t.count !== undefined ? <span className="tab-count">{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/* شريط الصفحة الموحّد: أيقونة + عنوان بخطّ أميري + وصف + شرائح معلومات */
export function PageHero({ icon: Icon, title, subtitle, tone = '', chips = [], actions }) {
  return (
    <section className={`page-hero ${tone}`}>
      {Icon && <span className="ph-ico"><Icon size={24} strokeWidth={1.75} /></span>}
      <div className="ph-text">
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
        {chips.length > 0 && (
          <div className="inline" style={{ marginTop: 8, gap: 7 }}>
            {chips.filter(Boolean).map((c) => (
              <span className="ph-chip" key={c}><Sparkles size={13} strokeWidth={1.75} /> {c}</span>
            ))}
          </div>
        )}
      </div>
      {actions && <div className="ph-actions">{actions}</div>}
    </section>
  );
}

/* عنوان قسم داخلي بخطّ أميري وخط ذهبي */
export function SectionTitle({ children, icon: Icon }) {
  return (
    <h3 className="section-title">
      {Icon && <Icon size={18} strokeWidth={1.75} />}
      {children}
    </h3>
  );
}
