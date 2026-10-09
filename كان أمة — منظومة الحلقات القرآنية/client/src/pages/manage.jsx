import React, { useMemo, useState } from 'react';
import {
  LayoutDashboard, Users, GraduationCap, BookOpenText, CalendarCheck, Award, AlertTriangle,
  Wallet, FileText, UserCog, Building2, Plus, Loader2, CheckCheck, Trash2, Save, Printer,
  LineChart, Sparkles, ClipboardList, Link2, Send, Pencil, Search, KeyRound, X
} from 'lucide-react';
import { api, fmtDate, fmtDateTime, fileUrl, today, monthNow, pct } from '../api.js';
import { useAsync } from '../hooks.js';
import { useAuth, ROLE_LABEL } from '../store.jsx';
import { useToast } from '../toast.jsx';
import {
  Card, Stat, Table, Badge, StatusBadge, Skeleton, EmptyState, Modal, Field, Row, Avatar,
  Tabs, Donut, Bar, Loading
} from '../ui.jsx';

export function ManageHome() {
  const { user, meta } = useAuth();
  const { data, loading, error } = useAsync(() => api.get('admin/dashboard'), []);
  if (loading) return <Skeleton rows={7} />;
  if (error) return <div className="alert alert-bad"><AlertTriangle size={17} /><span>{error}</span></div>;
  const att = data.attendance_counts || {};
  const stages = data.by_stage || [];

  return (
    <>
      <Card>
        <div className="inline" style={{ justifyContent: 'space-between', gap: 14 }}>
          <div className="inline" style={{ gap: 13 }}>
            <Avatar name={user.name} />
            <div>
              <h2>{user.role === 'admin' ? 'لوحة الإدارة العامة' : `لوحة مشرفة ${user.branch_name || ''}`}</h2>
              <p className="muted sm">{user.role === 'admin' ? 'متابعة جميع الفروع والحلقات والطالبات' : 'نطاق العرض مقيّد بفرعك فقط'}</p>
            </div>
          </div>
          <a className="btn btn-ghost" href="#/manage/reports"><FileText size={16} strokeWidth={1.75} /> التقارير</a>
        </div>
      </Card>

      <div className="stats-row">
        <Stat label="الطالبات النشطات" value={data.students} icon={GraduationCap} tone="ok" />
        <Stat label="المعلمات" value={data.teachers} icon={Users} />
        <Stat label="الحلقات النشطة" value={data.halqas} icon={BookOpenText} tone="gold" />
        <Stat label="نسبة الحضور العامة" value={`${data.attendance_rate}%`} hint={`${data.attendance_total} تسجيل`} icon={CalendarCheck} tone="brand" />
        <Stat label="مواعيد معلّقة" value={data.pending_appointments} icon={CalendarCheck} tone="warn" />
        <Stat label="طلبات معلّقة" value={data.pending_requests} icon={ClipboardList} tone="warn" />
        <Stat label="رسوم غير مسددة" value={data.unpaid_payments} icon={Wallet} tone="bad" />
      </div>

      <div className="grid grid-2">
        <Card title="توزيع الحضور" sub="حسب حالات التحضير" icon={CalendarCheck}>
          <div className="inline" style={{ gap: 22, alignItems: 'center' }}>
            <Donut value={data.attendance_rate} label="نسبة الحضور" />
            <div className="legend" style={{ flexDirection: 'column', gap: 8 }}>
              {Object.entries((meta && meta.attendance_status) || {}).map(([k, label]) => (
                <span key={k} className="legend-item"><i className="dot" /> {label}: <strong>{att[k] || 0}</strong></span>
              ))}
            </div>
          </div>
        </Card>

        <Card title="توزيع الطالبات على المستويات" sub="عدد الطالبات في كل مستوى" icon={GraduationCap}>
          {stages.length ? stages.map((s) => (
            <div key={s.stage} style={{ marginBottom: 8 }}>
              <div className="inline" style={{ justifyContent: 'space-between' }}><span className="sm">{s.stage}</span><strong className="sm">{s.c}</strong></div>
              <Bar value={s.c} max={Math.max(...stages.map((x) => x.c))} />
            </div>
          )) : <EmptyState text="لا توجد بيانات مستويات." icon={GraduationCap} />}
        </Card>
      </div>

      {user.role === 'admin' && (
        <Card title="ملخّص الفروع" sub="الطالبات والحلقات في كل فرع" icon={Building2}>
          <Table head={['الفرع', 'الطالبات', 'الحلقات']}>
            {(data.branch_breakdown || []).map((b) => (
              <tr key={b.id}><td><strong>{b.name}</strong></td><td>{b.students}</td><td>{b.halqas}</td></tr>
            ))}
          </Table>
        </Card>
      )}
    </>
  );
}
function UserManager({ role, title, icon }) {
  const toast = useToast();
  const { meta } = useAuth();
  const lists = useAsync(() => Promise.all([
    api.get(`admin/users?role=${role}`),
    api.get('admin/halqas'),
    api.get('admin/branches')
  ]), []);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', username: '', email: '', phone: '', stage: '', halqa_id: '', branch_id: '' });

  const [users, halqas, branches] = lists.data || [[], [], []];
  const rows = (users || []).filter((u) => !q || u.name.includes(q) || String(u.username).includes(q) || String(u.stage || '').includes(q));

  const create = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const r = await api.post('admin/users', { ...form, role, halqa_id: form.halqa_id || undefined, branch_id: form.branch_id || undefined });
      toast.ok(`${r.message} كلمة المرور الافتراضية: ${r.default_password}`);
      setOpen(false); setForm({ name: '', username: '', email: '', phone: '', stage: '', halqa_id: '', branch_id: '' }); lists.reload();
    } catch (err) { toast.err(err.message); } finally { setBusy(false); }
  };

  const patch = async (u, body, msg) => {
    try { const r = await api.patch(`admin/users/${u.id}`, body); toast.ok(msg || r.message); if (r.new_password) toast.info(`كلمة المرور الجديدة: ${r.new_password}`); lists.reload(); }
    catch (e) { toast.err(e.message); }
  };

  const saveEdit = async () => {
    setBusy(true);
    try {
      await api.patch(`admin/users/${edit.id}`, { name: edit.name, email: edit.email, phone: edit.phone, stage: edit.stage || null, halqa_id: edit.halqa_id || null });
      toast.ok('تم تحديث البيانات.'); setEdit(null); lists.reload();
    } catch (e) { toast.err(e.message); } finally { setBusy(false); }
  };

  return (
    <>
      <Card title={title} sub={`${rows.length} سجل`} icon={icon}
        actions={<div className="inline">
          <input type="text" placeholder="بحث…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 200 }} />
          <button className="btn" onClick={() => setOpen(true)}><Plus size={16} strokeWidth={1.75} /> إضافة</button>
        </div>}>
        {lists.loading ? <Skeleton /> : lists.error ? <div className="alert alert-bad"><span>{lists.error}</span></div> : (
          <Table head={['الاسم', 'اسم المستخدم', 'المستوى', 'الحلقة', 'الفرع', 'التواصل', 'الحالة', 'إجراءات']} empty="لا توجد سجلات.">
            {rows.map((u) => (
              <tr key={u.id}>
                <td><div className="inline" style={{ gap: 9 }}><Avatar name={u.name} /><strong>{u.name}</strong></div></td>
                <td className="sm muted">{u.username}</td>
                <td>{u.stage ? <Badge tone="brand">{u.stage}</Badge> : '—'}</td>
                <td className="sm">{u.halqa_name || '—'}</td>
                <td className="sm muted">{u.branch_name || '—'}</td>
                <td className="sm muted">{u.phone || u.email || '—'}</td>
                <td><Badge tone={u.active ? 'ok' : 'bad'}>{u.active ? 'نشط' : 'موقوف'}</Badge></td>
                <td className="cell-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => setEdit({ ...u })}><Pencil size={13} strokeWidth={1.75} /></button>
                  <button className="btn btn-ghost btn-sm" onClick={() => patch(u, { reset_password: true }, 'تمت إعادة تعيين كلمة المرور.')} title="إعادة تعيين كلمة المرور"><KeyRound size={13} strokeWidth={1.75} /></button>
                  <button className={`btn btn-sm ${u.active ? 'btn-danger' : 'btn-ok'}`} onClick={() => patch(u, { active: !u.active }, u.active ? 'تم إيقاف الحساب.' : 'تم تنشيط الحساب.')}>
                    {u.active ? 'إيقاف' : 'تنشيط'}
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={open} title={`إضافة ${title}`} onClose={() => setOpen(false)}
        footer={<><button className="btn" type="submit" form="user-form" disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <Plus size={16} strokeWidth={1.75} />} حفظ</button><button className="btn btn-ghost" onClick={() => setOpen(false)}>إلغاء</button></>}>
        <form id="user-form" className="form-stack" onSubmit={create}>
          <Row>
            <Field label="الاسم الكامل" required><input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
            <Field label="اسم المستخدم" required hint="3–30 حرفًا إنجليزيًا أو أرقامًا"><input type="text" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required /></Field>
          </Row>
          <Row>
            <Field label="البريد الإلكتروني"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="الهاتف"><input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          </Row>
          <Row>
            <Field label="المستوى">
              <select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
                <option value="">— بدون —</option>
                {((meta && meta.stages) || []).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            {role === 'student' && (
              <Field label="الحلقة">
                <select value={form.halqa_id} onChange={(e) => setForm({ ...form, halqa_id: e.target.value })}>
                  <option value="">— بدون —</option>
                  {(halqas || []).map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </Field>
            )}
            {role !== 'student' && (
              <Field label="الفرع">
                <select value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })}>
                  <option value="">— فرع الحساب —</option>
                  {(branches || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </Field>
            )}
          </Row>
          <div className="alert"><span>سيتم إنشاء الحساب بكلمة مرور افتراضية، ويُطلب تغييرها عند أول دخول.</span></div>
        </form>
      </Modal>

      <Modal open={Boolean(edit)} title="تعديل البيانات" onClose={() => setEdit(null)}
        footer={<><button className="btn" onClick={saveEdit} disabled={busy}>حفظ</button><button className="btn btn-ghost" onClick={() => setEdit(null)}>إلغاء</button></>}>
        {edit && (
          <div className="form-stack">
            <Field label="الاسم"><input type="text" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Row>
              <Field label="البريد"><input type="email" value={edit.email || ''} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
              <Field label="الهاتف"><input type="tel" value={edit.phone || ''} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
            </Row>
            <Field label="المستوى"><input type="text" value={edit.stage || ''} onChange={(e) => setEdit({ ...edit, stage: e.target.value })} /></Field>
            {role === 'student' && (
              <Field label="الحلقة المثبّتة">
                <select value={edit.halqa_id || ''} onChange={(e) => setEdit({ ...edit, halqa_id: e.target.value })}>
                  <option value="">— بدون —</option>
                  {(halqas || []).map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </Field>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

export function ManageStudents() { return <UserManager role="student" title="ملف الطالبات" icon={GraduationCap} />; }
export function ManageTeachers() { return <UserManager role="teacher" title="ملف المعلمات" icon={Users} />; }
export function ManageHalqas() {
  const toast = useToast();
  const { meta, user } = useAuth();
  const lists = useAsync(() => Promise.all([
    api.get('admin/halqas'), api.get('admin/users?role=teacher'), api.get('admin/users?role=student'), api.get('admin/branches')
  ]), []);
  const [halqas, teachers, students, branches] = lists.data || [[], [], [], []];
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [roster, setRoster] = useState(null);
  const [addStudent, setAddStudent] = useState('');
  const [busy, setBusy] = useState(false);
  const days = (meta && meta.days) || ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
  const blank = { name: '', stage: '', link: '', teacher_id: '', branch_id: '', published: true, sessions: [{ day: days[0], time: '16:00' }] };
  const [form, setForm] = useState(blank);

  const setSession = (i, key, v) => setForm((f) => ({ ...f, sessions: f.sessions.map((s, idx) => (idx === i ? { ...s, [key]: v } : s)) }));
  const addSession = () => setForm((f) => ({ ...f, sessions: [...f.sessions, { day: days[0], time: '16:00' }] }));
  const dropSession = (i) => setForm((f) => ({ ...f, sessions: f.sessions.filter((_, idx) => idx !== i) }));

  const create = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const sessions = form.sessions.filter((s) => s.day && s.time).map((s) => ({ day: s.day, time: s.time }));
      if (!sessions.length) throw new Error('أضيفي موعدًا واحدًا على الأقل.');
      const r = await api.post('admin/halqas', { ...form, teacher_id: form.teacher_id || null, branch_id: form.branch_id || undefined, sessions });
      toast.ok(r.message); setOpen(false); setForm(blank); lists.reload();
    } catch (err) { toast.err(err.message); } finally { setBusy(false); }
  };

  const saveEdit = async () => {
    setBusy(true);
    try {
      const r = await api.patch(`admin/halqas/${edit.id}`, {
        name: edit.name, stage: edit.stage || null, link: edit.link || null, teacher_id: edit.teacher_id || null,
        published: edit.published, sessions: edit.sessions || []
      });
      toast.ok(r.message); setEdit(null); lists.reload();
    } catch (e) { toast.err(e.message); } finally { setBusy(false); }
  };

  const openRoster = async (h) => {
    setRoster({ halqa: h, loading: true, items: [] });
    try { const items = await api.get(`admin/halqas/${h.id}/students`); setRoster({ halqa: h, loading: false, items }); }
    catch (e) { toast.err(e.message); setRoster({ halqa: h, loading: false, items: [] }); }
  };
  const enroll = async () => {
    if (!addStudent) return;
    try { const r = await api.post(`admin/halqas/${roster.halqa.id}/students`, { student_id: Number(addStudent) }); toast.ok(r.message); setAddStudent(''); openRoster(roster.halqa); lists.reload(); }
    catch (e) { toast.err(e.message); }
  };
  const remove = async (h) => {
    if (!window.confirm(`إيقاف الحلقة «${h.name}»؟`)) return;
    try { const r = await api.del(`admin/halqas/${h.id}`); toast.ok(r.message); lists.reload(); } catch (e) { toast.err(e.message); }
  };

  return (
    <>
      <Card title="الحلقات والشعب" sub={`${(halqas || []).length} حلقة`} icon={BookOpenText}
        actions={<button className="btn" onClick={() => { setForm(blank); setOpen(true); }}><Plus size={16} strokeWidth={1.75} /> إنشاء شعبة / حلقة</button>}>
        {lists.loading ? <Skeleton /> : (
          <Table head={['الحلقة', 'المستوى', 'المعلمة', 'الفرع', 'الطالبات', 'المواعيد', 'الحالة', 'إجراءات']} empty="لا توجد حلقات.">
            {(halqas || []).map((h) => (
              <tr key={h.id}>
                <td><strong>{h.name}</strong>{h.link && <a className="muted xs" href={h.link} target="_blank" rel="noreferrer" style={{ display: 'block' }}>رابط البث</a>}</td>
                <td>{h.stage ? <Badge tone="brand">{h.stage}</Badge> : '—'}</td>
                <td className="sm">{h.teacher_name || <Badge tone="warn">بدون معلمة</Badge>}</td>
                <td className="sm muted">{h.branch_name || '—'}</td>
                <td>{h.students_count}</td>
                <td className="sm">{h.schedule || '—'}</td>
                <td><StatusBadge status={h.active ? (h.published ? 'accepted' : 'pending') : 'rejected'} label={!h.active ? 'موقوفة' : h.published ? 'منشورة' : 'مسودة'} /></td>
                <td className="cell-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => openRoster(h)}><Users size={13} strokeWidth={1.75} /> الطالبات</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEdit({ ...h, sessions: [] })}><Pencil size={13} strokeWidth={1.75} /> تعديل</button>
                  <button className="btn btn-danger btn-sm" onClick={() => remove(h)}><Trash2 size={13} strokeWidth={1.75} /></button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={open} wide title="إنشاء شعبة / حلقة" onClose={() => setOpen(false)}
        footer={<><button className="btn" type="submit" form="halqa-form" disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <Save size={16} strokeWidth={1.75} />} حفظ</button><button className="btn btn-ghost" onClick={() => setOpen(false)}>إلغاء</button></>}>
        <form id="halqa-form" className="form-stack" onSubmit={create}>
          <Row>
            <Field label="اسم الشعبة/الحلقة" required><input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
            <Field label="المستوى">
              <select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
                <option value="">— بدون —</option>
                {((meta && meta.stages) || []).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="المعلمة">
              <select value={form.teacher_id} onChange={(e) => setForm({ ...form, teacher_id: e.target.value })}>
                <option value="">— بدون —</option>
                {(teachers || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            {user.role === 'admin' && (
              <Field label="الفرع">
                <select value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })}>
                  <option value="">— فرع الحساب —</option>
                  {(branches || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </Field>
            )}
          </Row>
          <Field label="رابط البث / الحلقة"><input type="url" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://…" /></Field>
          <Field label="المواعيد" hint="اليوم والوقت لكل جلسة" required>
            <div className="form-stack">
              {form.sessions.map((s, i) => (
                <div className="inline" key={i}>
                  <select value={s.day} onChange={(e) => setSession(i, 'day', e.target.value)} style={{ maxWidth: 150 }}>
                    {days.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <input type="time" value={s.time} onChange={(e) => setSession(i, 'time', e.target.value)} style={{ maxWidth: 140 }} />
                  {form.sessions.length > 1 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => dropSession(i)}><Trash2 size={13} strokeWidth={1.75} /></button>}
                </div>
              ))}
              <button type="button" className="btn btn-soft btn-sm" onClick={addSession}><Plus size={13} strokeWidth={1.75} /> إضافة موعد</button>
            </div>
          </Field>
          <label className="check"><input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} /> نشر الشعبة للطالبات</label>
        </form>
      </Modal>
      <Modal open={Boolean(edit)} wide title={edit ? `تعديل: ${edit.name}` : ''} onClose={() => setEdit(null)}
        footer={<><button className="btn" onClick={saveEdit} disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <Save size={16} strokeWidth={1.75} />} حفظ التعديلات</button><button className="btn btn-ghost" onClick={() => setEdit(null)}>إلغاء</button></>}>
        {edit && (
          <div className="form-stack">
            <Row>
              <Field label="اسم الحلقة"><input type="text" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
              <Field label="المستوى">
                <select value={edit.stage || ''} onChange={(e) => setEdit({ ...edit, stage: e.target.value })}>
                  <option value="">— بدون —</option>
                  {((meta && meta.stages) || []).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </Row>
            <Row>
              <Field label="المعلمة">
                <select value={edit.teacher_id || ''} onChange={(e) => setEdit({ ...edit, teacher_id: e.target.value })}>
                  <option value="">— بدون —</option>
                  {(teachers || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Field>
              <Field label="رابط البث"><input type="url" value={edit.link || ''} onChange={(e) => setEdit({ ...edit, link: e.target.value })} /></Field>
            </Row>
            <Field label="تحديث المواعيد" hint="إضافة مواعيد هنا تستبدل المواعيد الحالية للحلقة">
              <div className="form-stack">
                {(edit.sessions || []).map((s, i) => (
                  <div className="inline" key={i}>
                    <select value={s.day} onChange={(e) => setEdit({ ...edit, sessions: edit.sessions.map((x, idx) => (idx === i ? { ...x, day: e.target.value } : x)) })} style={{ maxWidth: 150 }}>
                      {days.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <input type="time" value={s.time} onChange={(e) => setEdit({ ...edit, sessions: edit.sessions.map((x, idx) => (idx === i ? { ...x, time: e.target.value } : x)) })} style={{ maxWidth: 140 }} />
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdit({ ...edit, sessions: edit.sessions.filter((_, idx) => idx !== i) })}><Trash2 size={13} strokeWidth={1.75} /></button>
                  </div>
                ))}
                <button type="button" className="btn btn-soft btn-sm" onClick={() => setEdit({ ...edit, sessions: [...(edit.sessions || []), { day: days[0], time: '16:00' }] })}><Plus size={13} strokeWidth={1.75} /> إضافة موعد</button>
              </div>
            </Field>
            <label className="check"><input type="checkbox" checked={Boolean(edit.published)} onChange={(e) => setEdit({ ...edit, published: e.target.checked ? 1 : 0 })} /> منشورة للطالبات</label>
          </div>
        )}
      </Modal>

      <Modal open={Boolean(roster)} wide title={roster ? `طالبات ${roster.halqa.name}` : ''} onClose={() => setRoster(null)}
        footer={<div className="inline" style={{ width: '100%' }}>
          <select value={addStudent} onChange={(e) => setAddStudent(e.target.value)} style={{ minWidth: 230 }}>
            <option value="">— اختاري طالبة لإضافتها —</option>
            {(students || []).filter((s) => !((roster && roster.items) || []).some((r) => r.id === s.id)).map((s) => <option key={s.id} value={s.id}>{s.name} — {s.stage || ''}</option>)}
          </select>
          <button className="btn" onClick={enroll} disabled={!addStudent}><Plus size={16} strokeWidth={1.75} /> إضافة للحلقة</button>
        </div>}>
        {roster && (roster.loading ? <Skeleton /> : (
          <Table head={['الطالبة', 'اسم المستخدم', 'المستوى', 'مثبّتة']} empty="لا توجد طالبات في هذه الحلقة.">
            {roster.items.map((s) => (
              <tr key={s.id}><td>{s.name}</td><td className="sm muted">{s.username}</td><td>{s.stage ? <Badge tone="brand">{s.stage}</Badge> : '—'}</td><td>{s.pinned ? <Badge tone="ok">نعم</Badge> : <Badge>لا</Badge>}</td></tr>
            ))}
          </Table>
        ))}
      </Modal>
    </>
  );
}


export function ManageGrades() {
  const toast = useToast();
  const lists = useAsync(() => Promise.all([api.get('admin/halqas'), api.get('admin/grades')]), []);
  const [halqas, grades] = lists.data || [[], []];
  const [halqaId, setHalqaId] = useState('');
  const [maxT, setMaxT] = useState(50);
  const [maxP, setMaxP] = useState(50);
  const [marks, setMarks] = useState({});
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const roster = useAsync(async () => (halqaId ? api.get(`admin/halqas/${halqaId}/students`) : []), [halqaId]);
  const students = roster.data || [];
  const rows = (grades || []).filter((g) => !q || g.student_name.includes(q) || String(g.stage || '').includes(q));

  const send = async () => {
    const records = students.map((s) => ({
      student_id: s.id, stage: (halqas || []).find((h) => String(h.id) === String(halqaId))?.stage || null,
      theory_score: marks[`th_${s.id}`] ?? '', practical_score: marks[`pr_${s.id}`] ?? '',
      notes: marks[`nt_${s.id}`] || '', max_theory: maxT, max_practical: maxP
    })).filter((r) => r.theory_score !== '' || r.practical_score !== '');
    if (!records.length) return toast.err('أدخلي درجة واحدة على الأقل.');
    setBusy(true);
    try { const r = await api.post('admin/grades', { records, max_theory: maxT, max_practical: maxP }); toast.ok(r.message); setMarks({}); lists.reload(); }
    catch (e) { toast.err(e.message); } finally { setBusy(false); }
  };

  return (
    <>
      <Card title="إدخال وإرسال الدرجات" sub="اختيار الحلقة ثم إدخال درجات الطالبات" icon={LineChart}
        actions={<div className="inline">
          <select value={halqaId} onChange={(e) => { setHalqaId(e.target.value); setMarks({}); }} style={{ minWidth: 200 }}>
            <option value="">— اختاري الحلقة —</option>
            {(halqas || []).map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <label className="check">نظري من <input type="number" style={{ maxWidth: 74 }} value={maxT} onChange={(e) => setMaxT(Number(e.target.value))} /></label>
          <label className="check">عملي من <input type="number" style={{ maxWidth: 74 }} value={maxP} onChange={(e) => setMaxP(Number(e.target.value))} /></label>
        </div>}>
        {!halqaId ? <EmptyState text="اختاري الحلقة لبدء إدخال الدرجات." icon={LineChart} />
          : roster.loading ? <Skeleton /> : !students.length ? <EmptyState text="لا توجد طالبات في هذه الحلقة." icon={Users} />
            : (
              <Table head={['الطالبة', `النظري / ${maxT}`, `العملي / ${maxP}`, 'ملاحظة']}>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.name}</strong><div className="muted xs">{s.stage || '—'}</div></td>
                    <td><input type="number" min="0" max={maxT} value={marks[`th_${s.id}`] ?? ''} onChange={(e) => setMarks({ ...marks, [`th_${s.id}`]: e.target.value })} style={{ maxWidth: 110 }} /></td>
                    <td><input type="number" min="0" max={maxP} value={marks[`pr_${s.id}`] ?? ''} onChange={(e) => setMarks({ ...marks, [`pr_${s.id}`]: e.target.value })} style={{ maxWidth: 110 }} /></td>
                    <td><input type="text" value={marks[`nt_${s.id}`] || ''} onChange={(e) => setMarks({ ...marks, [`nt_${s.id}`]: e.target.value })} placeholder="ملاحظة…" /></td>
                  </tr>
                ))}
              </Table>
            )}
      </Card>
      {halqaId && students.length > 0 && <div className="inline"><button className="btn" onClick={send} disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <Send size={16} strokeWidth={1.75} />} إرسال الدرجات</button></div>}

      <Card title="كشف الدرجات" sub={`${rows.length} نتيجة`} icon={LineChart}
        actions={<input type="text" placeholder="بحث بالطالبة أو المستوى…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 230 }} />}>
        {lists.loading ? <Skeleton /> : (
          <Table head={['التاريخ', 'الطالبة', 'المستوى', 'نظري', 'عملي', 'المجموع', 'سجّلها', 'ملاحظة']} empty="لا توجد درجات مرصودة.">
            {rows.map((g) => (
              <tr key={g.id}>
                <td>{fmtDate(g.created_at)}</td>
                <td><strong>{g.student_name}</strong><div className="muted xs">{g.username}</div></td>
                <td>{g.stage ? <Badge tone="brand">{g.stage}</Badge> : '—'}</td>
                <td>{g.theory_score ?? '—'} / {g.max_theory}</td>
                <td>{g.practical_score ?? '—'} / {g.max_practical}</td>
                <td><strong>{g.total}</strong></td>
                <td className="sm muted">{g.teacher_name || '—'}</td>
                <td className="sm">{g.notes || '—'}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
export function ManageAppointments() {
  const toast = useToast();
  const [status, setStatus] = useState('pending');
  const { data, loading, error, reload } = useAsync(() => api.get(`admin/appointments?status=${status}`), [status]);
  const decide = async (row, decision) => {
    try {
      const note = window.prompt(decision === 'accepted' ? 'ملاحظة القبول (اختياري):' : 'سبب الرفض (اختياري):') || '';
      const r = await api.patch(`admin/appointments/${row.id}`, { status: decision, note });
      toast.ok(r.message); reload();
    } catch (e) { toast.err(e.message); }
  };
  return (
    <>
      <div className="page-head">
        <Tabs tabs={[{ key: 'pending', label: 'قيد المراجعة' }, { key: 'accepted', label: 'المقبولة' }, { key: 'rejected', label: 'المرفوضة' }]} active={status} onChange={setStatus} />
      </div>
      <Card title="طلبات العيادات والمواعيد" sub="عيادة نظرية وعيادة مخارج" icon={CalendarCheck}>
        {loading ? <Skeleton /> : error ? <div className="alert alert-bad"><span>{error}</span></div> : (
          <Table head={['الطالبة', 'الحلقة', 'العيادة', 'التاريخ', 'الوقت', 'الملاحظة', 'الحالة', 'إجراء']} empty="لا توجد طلبات في هذه القائمة.">
            {(data || []).map((a) => (
              <tr key={a.id}>
                <td><strong>{a.student_name}</strong><div className="muted xs">{a.username} — {a.stage || ''}</div></td>
                <td className="sm">{a.halqa_name || '—'}</td>
                <td><Badge tone="brand">{a.clinic_label}</Badge></td>
                <td>{fmtDate(a.date)}</td>
                <td>{a.time}</td>
                <td className="sm">{a.note || '—'}</td>
                <td><StatusBadge status={a.status} label={a.status === 'pending' ? 'قيد المراجعة' : a.status === 'accepted' ? 'مقبول' : 'مرفوض'} /></td>
                <td className="cell-actions">
                  {a.status === 'pending' ? <>
                    <button className="btn btn-ok btn-sm" onClick={() => decide(a, 'accepted')}><CheckCheck size={13} strokeWidth={1.75} /> قبول</button>
                    <button className="btn btn-danger btn-sm" onClick={() => decide(a, 'rejected')}>رفض</button>
                  </> : <span className="muted xs">{a.decided_by_name || ''} {a.decision_note ? `— ${a.decision_note}` : ''}</span>}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}

export function ManageRewards() {
  const toast = useToast();
  const { meta } = useAuth();
  const types = (meta && meta.reward_types) || { attendance: 'تعزيزات الحضور', academic: 'تعزيزات التميز الدراسي', other: 'تعزيزات أخرى' };
  const lists = useAsync(() => Promise.all([api.get('admin/rewards'), api.get('admin/users?role=student')]), []);
  const [rewards, students] = lists.data || [[], []];
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ student_id: '', type: 'academic', title: '', points: 5, note: '' });
  const totals = (rewards || []).reduce((acc, r) => { acc[r.type_label] = (acc[r.type_label] || 0) + (r.points || 0); return acc; }, {});

  const send = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const r = await api.post('admin/rewards', { ...form, student_id: Number(form.student_id), points: Number(form.points) }); toast.ok(r.message); setOpen(false); setForm({ ...form, note: '', title: '' }); lists.reload(); }
    catch (err) { toast.err(err.message); } finally { setBusy(false); }
  };

  return (
    <>
      <div className="stats-row">
        <Stat label="إجمالي التعزيزات" value={(rewards || []).length} icon={Award} tone="gold" />
        {Object.entries(totals).slice(0, 3).map(([k, v]) => <Stat key={k} label={k} value={v} hint="نقطة" icon={Sparkles} />)}
      </div>
      <Card title="سجل التعزيز" sub="التعزيزات الممنوحة في نطاقك" icon={Award}
        actions={<button className="btn btn-gold" onClick={() => setOpen(true)}><Plus size={16} strokeWidth={1.75} /> منح تعزيز</button>}>
        {lists.loading ? <Skeleton /> : (
          <Table head={['التاريخ', 'الطالبة', 'النوع', 'العنوان', 'النقاط', 'منحه', 'ملاحظة']} empty="لا توجد تعزيزات.">
            {(rewards || []).map((r) => (
              <tr key={r.id}>
                <td>{fmtDate(r.created_at)}</td>
                <td>{r.student_name}</td>
                <td><Badge tone="gold">{r.type_label}</Badge></td>
                <td className="sm">{r.title}</td>
                <td><strong>{r.points}</strong></td>
                <td className="sm muted">{r.given_by_name || '—'}</td>
                <td className="sm">{r.note || '—'}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <Modal open={open} title="منح تعزيز" onClose={() => setOpen(false)}
        footer={<><button className="btn" type="submit" form="rw-form" disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} strokeWidth={1.75} />} منح</button><button className="btn btn-ghost" onClick={() => setOpen(false)}>إلغاء</button></>}>
        <form id="rw-form" className="form-stack" onSubmit={send}>
          <Field label="الطالبة" required>
            <select value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} required>
              <option value="">— اختاري الطالبة —</option>
              {(students || []).map((s) => <option key={s.id} value={s.id}>{s.name} — {s.stage || ''}</option>)}
            </select>
          </Field>
          <Row>
            <Field label="النوع" required>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {Object.entries(types).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="النقاط"><input type="number" min="0" max="100" value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })} /></Field>
          </Row>
          <Field label="العنوان"><input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="ملاحظة"><textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
        </form>
      </Modal>
    </>
  );
}
export function ManageAlerts() {
  const toast = useToast();
  const lists = useAsync(() => Promise.all([api.get('admin/alerts'), api.get('admin/users?role=student')]), []);
  const [alerts, students] = lists.data || [[], []];
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ student_id: '', level: 'notice', title: '', note: '' });

  const send = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const r = await api.post('admin/alerts', { ...form, student_id: Number(form.student_id) }); toast.ok(r.message); setOpen(false); setForm({ ...form, title: '', note: '' }); lists.reload(); }
    catch (err) { toast.err(err.message); } finally { setBusy(false); }
  };

  return (
    <>
      <Card title="تنبيهات المتابعة" sub="تنبيهات إدارية مرتبطة بالطالبات" icon={AlertTriangle}
        actions={<button className="btn" onClick={() => setOpen(true)}><Plus size={16} strokeWidth={1.75} /> تنبيه جديد</button>}>
        {lists.loading ? <Skeleton /> : (
          <Table head={['التاريخ', 'الطالبة', 'المستوى', 'النوع', 'العنوان', 'التفصيل', 'أنشأه']} empty="لا توجد تنبيهات.">
            {(alerts || []).map((a) => (
              <tr key={a.id}>
                <td>{fmtDate(a.created_at)}</td>
                <td>{a.student_name}<div className="muted xs">{a.username}</div></td>
                <td><Badge tone="brand">{a.level === 'warning' ? 'تحذير' : 'ملاحظة'}</Badge></td>
                <td><Badge tone={a.level === 'warning' ? 'bad' : 'info'}>{a.level === 'warning' ? 'تحذيري' : 'متابعة'}</Badge></td>
                <td><strong className="sm">{a.title}</strong></td>
                <td className="sm">{a.note || '—'}</td>
                <td className="sm muted">{a.created_by_name || '—'}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <Modal open={open} title="إرسال تنبيه" onClose={() => setOpen(false)}
        footer={<><button className="btn" type="submit" form="al-form" disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <Send size={16} strokeWidth={1.75} />} إرسال</button><button className="btn btn-ghost" onClick={() => setOpen(false)}>إلغاء</button></>}>
        <form id="al-form" className="form-stack" onSubmit={send}>
          <Row>
            <Field label="الطالبة" required>
              <select value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} required>
                <option value="">— اختاري الطالبة —</option>
                {(students || []).map((s) => <option key={s.id} value={s.id}>{s.name} — {s.stage || ''}</option>)}
              </select>
            </Field>
            <Field label="النوع" required>
              <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
                <option value="notice">ملاحظة متابعة</option><option value="warning">تحذير</option>
              </select>
            </Field>
          </Row>
          <Field label="العنوان" required><input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></Field>
          <Field label="التفصيل"><textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
        </form>
      </Modal>
    </>
  );
}

export function ManageRequests() {
  const toast = useToast();
  const [status, setStatus] = useState('pending');
  const { data, loading, error, reload } = useAsync(() => api.get(`admin/requests?status=${status}`), [status]);
  const decide = async (row, decision) => {
    try {
      const note = window.prompt(decision === 'accepted' ? 'ملاحظة القبول (اختياري):' : 'سبب الرفض (اختياري):') || '';
      const r = await api.patch(`admin/requests/${row.id}`, { status: decision, note });
      toast.ok(r.message); reload();
    } catch (e) { toast.err(e.message); }
  };
  return (
    <>
      <div className="page-head">
        <Tabs tabs={[{ key: 'pending', label: 'قيد المراجعة' }, { key: 'accepted', label: 'المقبولة' }, { key: 'rejected', label: 'المرفوضة' }, { key: '', label: 'الكل' }]} active={status} onChange={setStatus} />
      </div>
      <Card title="الطلبات الواردة" sub="طلبات التسجيل والنقل والإعفاء وغيرها" icon={ClipboardList}>
        {loading ? <Skeleton /> : error ? <div className="alert alert-bad"><span>{error}</span></div> : (
          <Table head={['التاريخ', 'مقدّمة الطلب', 'الصفة', 'النوع', 'التفاصيل', 'الحالة', 'إجراء']} empty="لا توجد طلبات في هذه القائمة.">
            {(data || []).map((r) => (
              <tr key={r.id}>
                <td>{fmtDate(r.created_at)}</td>
                <td>{r.requester_name}<div className="muted xs">{r.username}</div></td>
                <td><Badge>{ROLE_LABEL[r.requester_role] || r.requester_role}</Badge></td>
                <td><Badge tone="brand">{r.type}</Badge></td>
                <td className="sm">{r.details}</td>
                <td><StatusBadge status={r.status} label={r.status === 'pending' ? 'قيد المراجعة' : r.status === 'accepted' ? 'مقبول' : 'مرفوض'} /></td>
                <td className="cell-actions">
                  {r.status === 'pending' ? <>
                    <button className="btn btn-ok btn-sm" onClick={() => decide(r, 'accepted')}><CheckCheck size={13} strokeWidth={1.75} /> قبول</button>
                    <button className="btn btn-danger btn-sm" onClick={() => decide(r, 'rejected')}>رفض</button>
                  </> : <span className="muted xs">{r.decision_note || ''}</span>}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
export function ManageEvaluations() {
  const toast = useToast();
  const lists = useAsync(() => Promise.all([api.get('admin/halqas'), api.get('admin/evaluations')]), []);
  const [halqas, evals] = lists.data || [[], []];
  const [halqaId, setHalqaId] = useState('');
  const roster = useAsync(async () => (halqaId ? api.get(`admin/halqas/${halqaId}/students`) : []), [halqaId]);
  const [form, setForm] = useState({ student_id: '', theory_score: '', practical_score: '', tasmi_score: '', jazari_score: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const total = ['theory_score', 'practical_score', 'tasmi_score', 'jazari_score'].reduce((s, k) => s + (Number(form[k]) || 0), 0);

  const send = async (e) => {
    e.preventDefault();
    if (!halqaId) return toast.err('اختاري الحلقة أولًا.');
    setBusy(true);
    try {
      const r = await api.post('admin/evaluations', { ...form, halqa_id: Number(halqaId), student_id: form.student_id ? Number(form.student_id) : null });
      toast.ok(r.message); setForm({ student_id: '', theory_score: '', practical_score: '', tasmi_score: '', jazari_score: '', notes: '' }); lists.reload();
    } catch (err) { toast.err(err.message); } finally { setBusy(false); }
  };

  return (
    <>
      <Card title="تسجيل تقييم عملي" sub="كل بند من 25 — المجموع من 100" icon={Sparkles}
        actions={<select value={halqaId} onChange={(e) => setHalqaId(e.target.value)} style={{ minWidth: 200 }}>
          <option value="">— اختاري الحلقة —</option>
          {(halqas || []).map((h) => <option key={h.id} value={h.id}>{h.name} — {h.teacher_name || 'بدون معلمة'}</option>)}
        </select>}>
        <form className="form-stack" onSubmit={send}>
          <Row cols={3}>
            <Field label="الطالبة (اختياري)">
              <select value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })}>
                <option value="">— تقييم عام للحلقة —</option>
                {(roster.data || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="النظري / 25"><input type="number" min="0" max="25" value={form.theory_score} onChange={(e) => setForm({ ...form, theory_score: e.target.value })} /></Field>
            <Field label="العملي / 25"><input type="number" min="0" max="25" value={form.practical_score} onChange={(e) => setForm({ ...form, practical_score: e.target.value })} /></Field>
            <Field label="التسميع / 25"><input type="number" min="0" max="25" value={form.tasmi_score} onChange={(e) => setForm({ ...form, tasmi_score: e.target.value })} /></Field>
            <Field label="الجزرية / 25"><input type="number" min="0" max="25" value={form.jazari_score} onChange={(e) => setForm({ ...form, jazari_score: e.target.value })} /></Field>
            <Field label="المجموع"><input type="text" value={`${total} / 100`} readOnly /></Field>
          </Row>
          <Field label="ملاحظات"><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <div className="inline">
            <button className="btn" disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <Save size={16} strokeWidth={1.75} />} حفظ التقييم</button>
            <Badge tone={total >= 80 ? 'ok' : total >= 60 ? 'gold' : 'bad'}>التقدير: {total >= 90 ? 'ممتاز' : total >= 80 ? 'جيد جدًا' : total >= 70 ? 'جيد' : total >= 60 ? 'مقبول' : 'يحتاج تحسين'}</Badge>
          </div>
        </form>
      </Card>

      <Card title="سجل التقييمات" sub={`${(evals || []).length} تقييم`} icon={Sparkles}>
        {lists.loading ? <Skeleton /> : (
          <Table head={['التاريخ', 'الحلقة', 'الطالبة', 'المعلمة', 'نظري', 'عملي', 'تسميع', 'جزرية', 'المجموع', 'النتيجة']} empty="لا توجد تقييمات.">
            {(evals || []).map((e) => (
              <tr key={e.id}>
                <td>{fmtDate(e.created_at)}</td>
                <td className="sm">{e.halqa_name || '—'}</td>
                <td>{e.student_name || <span className="muted sm">تقييم حلقة</span>}</td>
                <td className="sm muted">{e.teacher_name || '—'}</td>
                <td>{e.theory_score ?? '—'}</td><td>{e.practical_score ?? '—'}</td>
                <td>{e.tasmi_score ?? '—'}</td><td>{e.jazari_score ?? '—'}</td>
                <td><strong>{e.total}</strong></td>
                <td><Badge tone={(e.total || 0) >= 80 ? 'ok' : (e.total || 0) >= 60 ? 'gold' : 'bad'}>{e.result || '—'}</Badge></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
export function ManagePayments() {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [month, setMonth] = useState('');
  const { data, loading, error, reload } = useAsync(() => api.get(`admin/payments?status=${status}&month=${month}`), [status, month]);
  const settings = useAsync(() => api.get('common/settings'), []);
  const [form, setForm] = useState({ org_name: '', tadabbur_lesson: '', monthly_payment: '' });
  const [busy, setBusy] = useState(false);
  const [gen, setGen] = useState({ month: monthNow(), amount: 25 });
  const rows = data || [];
  const paid = rows.filter((r) => r.status === 'paid').length;

  React.useEffect(() => { if (settings.data) setForm({ ...form, ...settings.data }); /* eslint-disable-next-line */ }, [settings.data]);

  const saveSettings = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const res = await api.put('common/settings', form);
      toast.ok(res.message || 'تم حفظ الإعدادات.'); settings.reload();
    } catch (err) { toast.err(err.message || 'تعذّر حفظ الإعدادات.'); } finally { setBusy(false); }
  };

  const mark = async (row, next) => {
    try { const r = await api.patch(`admin/payments/${row.id}`, { status: next }); toast.ok(r.message); reload(); }
    catch (e) { toast.err(e.message); }
  };

  const generate = async () => {
    try { const r = await api.post('admin/payments/generate', { month: gen.month, amount: Number(gen.amount) }); toast.ok(r.message); reload(); }
    catch (e) { toast.err(e.message); }
  };

  return (
    <>
      <div className="stats-row">
        <Stat label="سجلات الدفع" value={rows.length} icon={Wallet} />
        <Stat label="مسدَّدة" value={paid} tone="ok" icon={CheckCheck} />
        <Stat label="غير مسدَّدة" value={rows.length - paid} tone="bad" icon={Wallet} />
      </div>

      <Card title="متابعة الرسوم" sub="تأكيد السداد ومراجعة الإيصالات" icon={Wallet}
        actions={<div className="inline">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">كل الحالات</option><option value="paid">مسدَّد</option>
            <option value="pending">بالمراجعة</option><option value="unpaid">غير مسدَّد</option>
          </select>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>}>
        {loading ? <Skeleton /> : error ? <div className="alert alert-bad"><span>{error}</span></div> : (
          <Table head={['الشهر', 'الطالبة', 'المستوى', 'المبلغ', 'الحالة', 'الإيصال', 'تحقّق', 'إجراء']} empty="لا توجد سجلات دفع.">
            {rows.map((p) => (
              <tr key={p.id}>
                <td>{p.month}</td>
                <td>{p.student_name}<div className="muted xs">{p.username}</div></td>
                <td>{p.stage ? <Badge tone="brand">{p.stage}</Badge> : '—'}</td>
                <td>{p.amount != null ? `${p.amount} ر.ع` : '—'}</td>
                <td><StatusBadge status={p.status} label={p.status === 'paid' ? 'مسدَّد' : p.status === 'pending' ? 'بالمراجعة' : 'غير مسدَّد'} /></td>
                <td>{p.receipt_path ? <a className="btn btn-ghost btn-sm" href={fileUrl(p.receipt_path)} target="_blank" rel="noreferrer">عرض</a> : <span className="muted sm">—</span>}</td>
                <td className="sm muted">{p.checked_by_name || '—'}</td>
                <td className="cell-actions">
                  {p.status !== 'paid'
                    ? <button className="btn btn-ok btn-sm" onClick={() => mark(p, 'paid')}><CheckCheck size={13} strokeWidth={1.75} /> تأكيد السداد</button>
                    : <button className="btn btn-ghost btn-sm" onClick={() => mark(p, 'unpaid')}>إلغاء التأكيد</button>}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <div className="grid grid-2">
        <Card title="توليد سجلات شهرية" sub="إنشاء سجل دفع لكل طالبة في نطاقك" icon={Plus}>
          <div className="form-stack">
            <Row>
              <Field label="الشهر"><input type="month" value={gen.month} onChange={(e) => setGen({ ...gen, month: e.target.value })} /></Field>
              <Field label="المبلغ الافتراضي (ر.ع)"><input type="number" min="0" step="0.5" value={gen.amount} onChange={(e) => setGen({ ...gen, amount: e.target.value })} /></Field>
            </Row>
            <button className="btn btn-block" onClick={generate}><Wallet size={16} strokeWidth={1.75} /> توليد السجلات</button>
          </div>
        </Card>

        <Card title="إعدادات المنظومة" sub="تظهر للطالبات في لوحاتهن" icon={FileText}>
          <form className="form-stack" onSubmit={saveSettings}>
            <Field label="اسم المنظومة"><input type="text" value={form.org_name || ''} onChange={(e) => setForm({ ...form, org_name: e.target.value })} /></Field>
            <Field label="موعد درس التدبّر"><input type="text" value={form.tadabbur_lesson || ''} onChange={(e) => setForm({ ...form, tadabbur_lesson: e.target.value })} /></Field>
            <Field label="سياسة الدفع الشهري"><input type="text" value={form.monthly_payment || ''} onChange={(e) => setForm({ ...form, monthly_payment: e.target.value })} /></Field>
            <button className="btn btn-ghost" disabled={busy}><Save size={16} strokeWidth={1.75} /> حفظ الإعدادات</button>
          </form>
        </Card>
      </div>
    </>
  );
}
export function ManageReports() {
  const { data, loading, error } = useAsync(() => api.get('admin/reports/summary'), []);
  if (loading) return <Skeleton rows={7} />;
  if (error) return <div className="alert alert-bad"><span>{error}</span></div>;
  const students = data.students || [];
  const attendance = data.attendance || [];
  const grades = data.grades || [];
  const payments = data.payments || [];
  const topAttendance = attendance.slice(0, 10);
  const lowAttendance = [...attendance].reverse().slice(0, 10);
  const gradeAvg = (sid) => {
    const gs = grades.filter((g) => g.id === sid);
    return gs.length ? Math.round(gs.reduce((s, g) => s + (g.total || 0), 0) / gs.length) : null;
  };

  return (
    <>
      <div className="page-head">
        <div><strong>{students.length}</strong> <span className="muted sm">طالبة في نطاقك</span></div>
        <div className="ph-actions">
          <button className="btn btn-ghost" onClick={() => window.print()}><Printer size={16} strokeWidth={1.75} /> طباعة التقرير</button>
        </div>
      </div>

      <div className="stats-row">
        <Stat label="عدد الطالبات" value={students.length} icon={GraduationCap} tone="ok" />
        <Stat label="نتائج مرصودة" value={grades.length} icon={LineChart} />
        <Stat label="أشهر مدفوعات" value={payments.length} icon={Wallet} tone="gold" />
        <Stat label="متوسط الحضور" value={`${attendance.length ? Math.round(attendance.reduce((s, a) => s + a.rate, 0) / attendance.length) : 0}%`} icon={CalendarCheck} tone="brand" />
      </div>

      <Card title="سجل الطالبات ومعدل الدرجات" sub="آخر النتائج المرصودة" icon={GraduationCap}>
        <Table head={['الطالبة', 'المستوى', 'عدد النتائج', 'المعدل', 'نسبة الحضور']} empty="لا توجد بيانات.">
          {students.map((s) => {
            const att = attendance.find((a) => a.id === s.id);
            return (
              <tr key={s.id}>
                <td><strong>{s.name}</strong><div className="muted xs">{s.username}</div></td>
                <td>{s.stage ? <Badge tone="brand">{s.stage}</Badge> : '—'}</td>
                <td>{grades.filter((g) => g.id === s.id).length}</td>
                <td>{gradeAvg(s.id) != null ? <><strong>{gradeAvg(s.id)}</strong><Bar value={gradeAvg(s.id)} tone={gradeAvg(s.id) >= 80 ? 'ok' : gradeAvg(s.id) >= 60 ? 'gold' : 'bad'} /></> : '—'}</td>
                <td>{att ? <><strong>{att.rate}%</strong><Bar value={att.rate} tone={att.rate >= 80 ? 'ok' : att.rate >= 60 ? 'gold' : 'bad'} /></> : '—'}</td>
              </tr>
            );
          })}
        </Table>
      </Card>

      <div className="grid grid-2">
        <Card title="الأعلى في الحضور" sub="أفضل 10 طالبات" icon={Award}>
          <Table head={['الطالبة', 'حضور', 'إجمالي', 'النسبة']} empty="لا توجد تسجيلات حضور.">
            {topAttendance.map((a) => (
              <tr key={a.id}><td>{a.name}</td><td>{a.present}</td><td>{a.total}</td><td><Badge tone="ok">{a.rate}%</Badge></td></tr>
            ))}
          </Table>
        </Card>
        <Card title="بحاجة إلى متابعة" sub="أقل نسبة حضور" icon={AlertTriangle}>
          <Table head={['الطالبة', 'حضور', 'إجمالي', 'النسبة']} empty="لا توجد تسجيلات حضور.">
            {lowAttendance.map((a) => (
              <tr key={a.id}><td>{a.name}</td><td>{a.present}</td><td>{a.total}</td><td><Badge tone={a.rate >= 60 ? 'warn' : 'bad'}>{a.rate}%</Badge></td></tr>
            ))}
          </Table>
        </Card>
      </div>

      <Card title="ملخّص المدفوعات الشهرية" sub="عدد السجلات ونسبة السداد" icon={Wallet}>
        <Table head={['الشهر', 'السجلات', 'المسدَّدة', 'النسبة']} empty="لا توجد سجلات دفع.">
          {payments.map((p) => (
            <tr key={p.month}>
              <td>{p.month}</td><td>{p.total}</td><td>{p.paid}</td>
              <td><Badge tone={pct(p.paid, p.total) >= 80 ? 'ok' : 'warn'}>{pct(p.paid, p.total)}%</Badge></td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
export function ManageUsers() {
  const toast = useToast();
  const lists = useAsync(() => Promise.all([api.get('admin/users'), api.get('admin/branches'), api.get('admin/halqas')]), []);
  const [users, branches, halqas] = lists.data || [[], [], []];
  const [role, setRole] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', username: '', email: '', phone: '', role: 'teacher', stage: '', branch_id: '', halqa_id: '' });
  const { meta } = useAuth();
  const roles = (meta && meta.roles) || { student: 'طالبة', teacher: 'معلمة', supervisor: 'مشرفة', admin: 'الإدارة العامة' };
  const rows = (users || []).filter((u) => (!role || u.role === role) && (!q || u.name.includes(q) || String(u.username).includes(q)));

  const create = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const r = await api.post('admin/users', { ...form, branch_id: form.branch_id || undefined, halqa_id: form.halqa_id || undefined });
      toast.ok(`${r.message} كلمة المرور الافتراضية: ${r.default_password}`);
      setOpen(false); lists.reload();
    } catch (err) { toast.err(err.message); } finally { setBusy(false); }
  };

  const patch = async (u, body, msg) => {
    try { const r = await api.patch(`admin/users/${u.id}`, body); toast.ok(msg || r.message); if (r.new_password) toast.info(`كلمة المرور الجديدة: ${r.new_password}`); lists.reload(); }
    catch (e) { toast.err(e.message); }
  };

  return (
    <>
      <Card title="المستخدمون" sub={`${rows.length} حساب`} icon={UserCog}
        actions={<div className="inline">
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">كل الصفات</option>
            {Object.entries(roles).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input type="text" placeholder="بحث…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 180 }} />
          <button className="btn" onClick={() => setOpen(true)}><Plus size={16} strokeWidth={1.75} /> مستخدم جديد</button>
        </div>}>
        {lists.loading ? <Skeleton /> : lists.error ? <div className="alert alert-bad"><span>{lists.error}</span></div> : (
          <Table head={['الاسم', 'اسم المستخدم', 'الصفة', 'المستوى', 'الحلقة', 'الفرع', 'الحالة', 'إجراءات']} empty="لا يوجد مستخدمون.">
            {rows.map((u) => (
              <tr key={u.id}>
                <td><div className="inline" style={{ gap: 9 }}><Avatar name={u.name} /><strong>{u.name}</strong></div></td>
                <td className="sm muted">{u.username}</td>
                <td><Badge tone={u.role === 'admin' ? 'gold' : u.role === 'supervisor' ? 'info' : 'brand'}>{ROLE_LABEL[u.role] || u.role}</Badge></td>
                <td className="sm">{u.stage || '—'}</td>
                <td className="sm">{u.halqa_name || '—'}</td>
                <td className="sm muted">{u.branch_name || 'كل الفروع'}</td>
                <td><Badge tone={u.active ? 'ok' : 'bad'}>{u.active ? 'نشط' : 'موقوف'}</Badge></td>
                <td className="cell-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => patch(u, { reset_password: true }, 'تمت إعادة تعيين كلمة المرور.')} title="إعادة تعيين كلمة المرور"><KeyRound size={13} strokeWidth={1.75} /></button>
                  <button className={`btn btn-sm ${u.active ? 'btn-danger' : 'btn-ok'}`} onClick={() => patch(u, { active: !u.active })}>{u.active ? 'إيقاف' : 'تنشيط'}</button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={open} wide title="إضافة مستخدم" onClose={() => setOpen(false)}
        footer={<><button className="btn" type="submit" form="nu-form" disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <Plus size={16} strokeWidth={1.75} />} إنشاء الحساب</button><button className="btn btn-ghost" onClick={() => setOpen(false)}>إلغاء</button></>}>
        <form id="nu-form" className="form-stack" onSubmit={create}>
          <Row>
            <Field label="الاسم الكامل" required><input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
            <Field label="اسم المستخدم" required><input type="text" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required /></Field>
            <Field label="الصفة" required>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {Object.entries(roles).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
          </Row>
          <Row>
            <Field label="البريد"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="الهاتف"><input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="المستوى">
              <select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
                <option value="">— بدون —</option>
                {((meta && meta.stages) || []).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </Row>
          <Row>
            <Field label="الفرع"><select value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })}>
              <option value="">— فرع الحساب —</option>
              {(branches || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select></Field>
            <Field label="الحلقة (للطالبات)"><select value={form.halqa_id} onChange={(e) => setForm({ ...form, halqa_id: e.target.value })}>
              <option value="">— بدون —</option>
              {(halqas || []).map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select></Field>
          </Row>
          <div className="alert alert-warn"><span>الحساب سيعمل بكلمة مرور افتراضية حسب الصفة، وتُطلب تغييرها عند أول دخول.</span></div>
        </form>
      </Modal>
    </>
  );
}

export function ManageBranches() {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => api.get('admin/branches'), []);
  const [form, setForm] = useState({ name: '', city: '' });
  const [busy, setBusy] = useState(false);
  const add = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const r = await api.post('admin/branches', form); toast.ok(r.message); setForm({ name: '', city: '' }); reload(); }
    catch (err) { toast.err(err.message); } finally { setBusy(false); }
  };
  return (
    <div className="grid grid-2">
      <Card title="إضافة فرع" sub="متاح للإدارة العامة فقط" icon={Building2}>
        <form className="form-stack" onSubmit={add}>
          <Field label="اسم الفرع" required><input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
          <Field label="المدينة"><input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
          <button className="btn btn-block" disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <Plus size={16} strokeWidth={1.75} />} إضافة الفرع</button>
        </form>
      </Card>
      <Card title="الفروع" sub={`${(data || []).length} فرع`} icon={Building2}>
        {loading ? <Skeleton /> : error ? <div className="alert alert-bad"><span>{error}</span></div> : (
          <Table head={['الفرع', 'المدينة']} empty="لا توجد فروع.">
            {(data || []).map((b) => <tr key={b.id}><td><strong>{b.name}</strong></td><td className="sm muted">{b.city || '—'}</td></tr>)}
          </Table>
        )}
      </Card>
    </div>
  );
}
