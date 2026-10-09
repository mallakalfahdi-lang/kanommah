import React, { useMemo, useState } from 'react';
import { Mail, Send, BellRing, UserCog, KeyRound, CheckCheck, Loader2, Plus, Inbox, ShieldCheck } from 'lucide-react';
import { api, fmtDateTime } from '../api.js';
import { useAsync } from '../hooks.js';
import { useAuth } from '../store.jsx';
import { useToast } from '../toast.jsx';
import { Card, Table, EmptyState, Skeleton, Modal, Field, Row, Badge, Tabs, Avatar, Loading } from '../ui.jsx';

const AUDIENCES = {
  student: [['admin', 'الإدارة العامة'], ['teacher', 'معلماتي'], ['supervisor', 'المشرفة']],
  teacher: [['students', 'طالباتي'], ['admin', 'الإدارة العامة'], ['supervisor', 'المشرفة'], ['teachers', 'المعلمات']],
  supervisor: [['teachers', 'معلمات الفرع'], ['students', 'طالبات الفرع'], ['admin', 'الإدارة العامة'], ['all', 'الجميع']],
  admin: [['all', 'الجميع'], ['teachers', 'المعلمات'], ['students', 'الطالبات'], ['supervisor', 'المشرفات']]
};

export function Messages() {
  const { user } = useAuth();
  const toast = useToast();
  const [box, setBox] = useState('inbox');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const list = useAsync(() => api.get(`common/messages?box=${box}`), [box]);
  const people = useAsync(async () => (user.role === 'student' ? [] : api.get('common/people')), []);
  const [form, setForm] = useState({ audience: (AUDIENCES[user.role] || AUDIENCES.student)[0][0], to_user_id: '', subject: '', body: '' });

  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post('common/messages', {
        audience: form.audience, to_user_id: form.audience === 'user' ? Number(form.to_user_id) : undefined,
        subject: form.subject, body: form.body
      });
      toast.ok(res.message || 'تم إرسال الرسالة.');
      setOpen(false); setForm({ ...form, subject: '', body: '', to_user_id: '' });
      if (box === 'sent') list.reload();
    } catch (err) { toast.err(err.message); } finally { setBusy(false); }
  };

  const markRead = async (m) => {
    try { await api.post(`common/messages/${m.id}/read`, {}); list.reload(); } catch (e) { toast.err(e.message); }
  };

  const rows = list.data || [];

  return (
    <>
      <div className="page-head">
        <Tabs tabs={[{ key: 'inbox', label: 'الوارد' }, { key: 'sent', label: 'الصادر' }]} active={box} onChange={setBox} />
        <div className="ph-actions">
          <button className="btn" onClick={() => setOpen(true)}><Plus size={16} strokeWidth={1.75} /> رسالة جديدة</button>
        </div>
      </div>

      <Card title="صندوق الرسائل" sub={`${rows.length} رسالة`} icon={Mail}>
        {list.loading ? <Skeleton rows={4} /> : !rows.length ? <EmptyState text="لا توجد رسائل في هذا الصندوق." icon={Inbox} /> : rows.map((m) => (
          <div key={m.id} className={`msg-row ${!m.read_at && box === 'inbox' ? 'unread' : ''}`}>
            <Avatar name={box === 'sent' ? (m.to_name || 'عام') : m.from_name} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="inline" style={{ justifyContent: 'space-between' }}>
                <strong className="sm">{box === 'sent' ? `إلى: ${m.to_name || m.audience}` : m.from_name}{m.from_role ? <span className="muted xs"> — ${m.from_role}</span> : null}</strong>
                <span className="muted xs">{fmtDateTime(m.created_at)}</span>
              </div>
              {m.subject && <div className="sm" style={{ fontWeight: 600 }}>{m.subject}</div>}
              <p className="sm" style={{ color: 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>{m.body}</p>
            </div>
            {box === 'inbox' && !m.read_at && (
              <button className="btn btn-soft btn-sm" onClick={() => markRead(m)}><CheckCheck size={14} strokeWidth={1.75} /> تمّت القراءة</button>
            )}
          </div>
        ))}
      </Card>

      <Modal open={open} title="رسالة جديدة" onClose={() => setOpen(false)}
        footer={<><button className="btn" form="msg-form" type="submit" disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <Send size={16} strokeWidth={1.75} />} إرسال</button><button className="btn btn-ghost" onClick={() => setOpen(false)}>إلغاء</button></>}>
        <form id="msg-form" className="form-stack" onSubmit={send}>
          <Row>
            <Field label="الجهة" required>
              <select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
                {(AUDIENCES[user.role] || AUDIENCES.student).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            {user.role !== 'student' && (
              <Field label="مستخدم محدّد (اختياري)" hint="اختيار مستخدم يوجّه الرسالة إليه وحده.">
                <select value={form.to_user_id} onChange={(e) => setForm({ ...form, to_user_id: e.target.value, audience: e.target.value ? 'user' : form.audience })}>
                  <option value="">— عام —</option>
                  {(people.data || []).map((p) => <option key={p.id} value={p.id}>{p.name} ({p.role_label || p.role})</option>)}
                </select>
              </Field>
            )}
          </Row>
          <Field label="الموضوع"><input type="text" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></Field>
          <Field label="نص الرسالة" required><textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required /></Field>
        </form>
      </Modal>
    </>
  );
}

export function Notifications() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const list = useAsync(() => api.get('common/notifications'), []);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ audience: 'all', title: '', body: '' });
  const canSend = ['admin', 'supervisor'].includes(user.role);
  const rows = list.data || [];

  const send = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const r = await api.post('common/notifications', form);
      toast.ok(r.message); setOpen(false); setForm({ audience: 'all', title: '', body: '' }); list.reload(); refresh();
    } catch (err) { toast.err(err.message); } finally { setBusy(false); }
  };
  const mark = async (n) => { try { await api.post(`common/notifications/${n.id}/read`, {}); list.reload(); refresh(); } catch (e) { toast.err(e.message); } };

  return (
    <>
      <div className="page-head">
        <div><strong>{rows.filter((r) => !r.is_read).length}</strong> <span className="muted sm">إشعار غير مقروء من أصل {rows.length}</span></div>
        {canSend && <div className="ph-actions"><button className="btn" onClick={() => setOpen(true)}><Plus size={16} strokeWidth={1.75} /> إشعار جديد</button></div>}
      </div>

      <Card title="التعميمات والإشعارات" icon={BellRing}>
        {list.loading ? <Skeleton rows={4} /> : !rows.length ? <EmptyState text="لا توجد إشعارات بعد." icon={BellRing} /> : (
          <div className="timeline">
            {rows.map((n) => (
              <div key={n.id} className="tl-item">
                <span className="tl-dot" style={{ background: n.is_read ? 'var(--line)' : 'var(--brand)', boxShadow: n.is_read ? 'none' : '0 0 0 4px var(--brand-soft)' }} />
                <div className="tl-body">
                  <div className="inline" style={{ justifyContent: 'space-between' }}>
                    <strong className="sm">{n.title} {!n.is_read && <Badge tone="brand">جديد</Badge>}</strong>
                    <span className="muted xs">{fmtDateTime(n.created_at)}{n.author ? ` — ${n.author}` : ''}</span>
                  </div>
                  {n.body && <p className="sm" style={{ color: 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>{n.body}</p>}
                  <div className="inline" style={{ marginTop: 4 }}>
                    <Badge>{n.audience === 'all' ? 'الجميع' : n.audience}</Badge>
                    {!n.is_read && <button className="btn btn-ghost btn-sm" onClick={() => mark(n)}><CheckCheck size={13} strokeWidth={1.75} /> تعليم كمقروء</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={open} title="إرسال إشعار" onClose={() => setOpen(false)}
        footer={<><button className="btn" type="submit" form="notif-form" disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <Send size={16} strokeWidth={1.75} />} إرسال</button><button className="btn btn-ghost" onClick={() => setOpen(false)}>إلغاء</button></>}>
        <form id="notif-form" className="form-stack" onSubmit={send}>
          <Row>
            <Field label="الجهة المستهدفة" required>
              <select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
                <option value="all">الجميع</option><option value="students">الطالبات</option>
                <option value="teachers">المعلمات</option><option value="supervisor">المشرفات</option>
              </select>
            </Field>
            <Field label="العنوان" required><input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></Field>
          </Row>
          <Field label="النص"><textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></Field>
        </form>
      </Modal>
    </>
  );
}

export function Profile() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [busy, setBusy] = useState(false);

  const change = async (e) => {
    e.preventDefault();
    if (pw.next !== pw.confirm) return toast.err('كلمتا المرور غير متطابقتين.');
    setBusy(true);
    try { const r = await api.post('auth/password', { current: pw.current, next: pw.next }); toast.ok(r.message); setPw({ current: '', next: '', confirm: '' }); refresh(); }
    catch (err) { toast.err(err.message); } finally { setBusy(false); }
  };

  if (!user) return <Loading />;

  return (
    <div className="grid grid-2">
      <Card title="بيانات الحساب" icon={UserCog}>
        <div className="kv"><span>الاسم</span><span>{user.name}</span></div>
        <div className="kv"><span>اسم المستخدم</span><span>{user.username}</span></div>
        <div className="kv"><span>الصفة</span><span>{({ student: 'طالبة', teacher: 'معلمة', supervisor: 'مشرفة', admin: 'إدارة عامة' })[user.role]}</span></div>
        <div className="kv"><span>الفرع</span><span>{user.branch_name || 'كل الفروع'}</span></div>
        {user.stage && <div className="kv"><span>المستوى</span><span>{user.stage}</span></div>}
        <div className="kv"><span>البريد</span><span>{user.email || '—'}</span></div>
        <div className="kv"><span>الهاتف</span><span>{user.phone || '—'}</span></div>
        <div className="kv"><span>الحالة</span><span><Badge tone={user.active ? 'ok' : 'bad'}>{user.active ? 'نشط' : 'موقوف'}</Badge></span></div>
        {user.must_change_password ? <div className="alert alert-warn" style={{ marginTop: 12 }}><ShieldCheck size={17} strokeWidth={1.75} /><span>يُنصح بتغيير كلمة المرور الافتراضية لأمان حسابك.</span></div> : null}
      </Card>

      <Card title="تغيير كلمة المرور" sub="8 أحرف على الأقل" icon={KeyRound}>
        <form className="form-stack" onSubmit={change}>
          <Field label="كلمة المرور الحالية" required><input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required /></Field>
          <Field label="كلمة المرور الجديدة" required><input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required /></Field>
          <Field label="تأكيد كلمة المرور" required><input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required /></Field>
          <button className="btn" disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <KeyRound size={16} strokeWidth={1.75} />} حفظ كلمة المرور</button>
        </form>
      </Card>
    </div>
  );
}
