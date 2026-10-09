import React, { useMemo, useState } from 'react';
import {
  LayoutDashboard, Users, CalendarCheck, LineChart, BookMarked, ClipboardList, Link2,
  Award, Sparkles, Loader2, Plus, CheckCheck, Save, AlertTriangle, FileUp, Send, Trash2
} from 'lucide-react';
import { api, fmtDate, fmtDateTime, fileUrl, toDataUrl, today } from '../api.js';
import { useAsync } from '../hooks.js';
import { useAuth } from '../store.jsx';
import { useToast } from '../toast.jsx';
import {
  Card, Stat, Table, Badge, StatusBadge, Skeleton, EmptyState, Modal, Field, Row, Avatar,
  Tabs, Donut, Loading
} from '../ui.jsx';

export function TeacherHome() {
  const { user } = useAuth();
  const { data, loading, error } = useAsync(() => api.get('teacher/overview'), []);
  if (loading) return <Skeleton rows={6} />;
  if (error) return <div className="alert alert-bad"><AlertTriangle size={17} /><span>{error}</span></div>;
  const halqas = data.halqas || [];

  return (
    <>
      <Card>
        <div className="inline" style={{ gap: 13 }}>
          <Avatar name={user.name} />
          <div>
            <h2>أهلًا، {user.name}</h2>
            <p className="muted sm">{halqas.length} حلقة — {data.students_count} طالبة — {user.branch_name || 'كل الفروع'}</p>
          </div>
        </div>
      </Card>

      <div className="stats-row">
        <Stat label="حلقاتي" value={halqas.length} icon={LayoutDashboard} />
        <Stat label="طالباتي" value={data.students_count} icon={Users} tone="ok" />
        <Stat label="تحضير اليوم" value={data.today_marked ? 'تم' : 'لم يُسجَّل'} hint={data.today} icon={CalendarCheck} tone={data.today_marked ? 'ok' : 'warn'} />
        <Stat label="مواعيد بانتظار القرار" value={data.pending_appointments} icon={CalendarCheck} tone="gold" />
        <Stat label="تسليمات للمراجعة" value={data.pending_submissions} icon={ClipboardList} tone="brand" />
      </div>

      <Card title="حلقاتي" sub="المواعيد وعدد الطالبات وروابط البث" icon={LayoutDashboard}>
        <Table head={['الحلقة', 'المستوى', 'الطالبات', 'المواعيد', 'الفرع', 'الرابط']}>
          {halqas.map((h) => (
            <tr key={h.id}>
              <td><strong>{h.name}</strong></td>
              <td><Badge tone="brand">{h.stage || '—'}</Badge></td>
              <td>{h.students_count}</td>
              <td className="sm">{h.schedule || '—'}</td>
              <td className="sm muted">{h.branch_name || '—'}</td>
              <td>{h.link ? <a className="btn btn-soft btn-sm" href={h.link} target="_blank" rel="noreferrer"><Link2 size={13} strokeWidth={1.75} /> فتح</a> : '—'}</td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card title="طالباتي" sub="قائمة سريعة" icon={Users}>
        <Table head={['الطالبة', 'اسم المستخدم', 'المستوى']}>
          {(data.students || []).map((s) => (
            <tr key={s.id}><td>{s.name}</td><td className="muted sm">{s.username}</td><td><Badge tone="brand">{s.stage || '—'}</Badge></td></tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
export function TeacherHalqas() {
  const { data, loading, error } = useAsync(() => api.get('teacher/halqas'), []);
  const [sel, setSel] = useState(null);
  const roster = useAsync(async () => (sel ? api.get(`teacher/halqas/${sel.id}/students`) : []), [sel && sel.id]);
  return (
    <>
      <Card title="حلقاتي" sub="بيانات الحلقة والمقرر" icon={LayoutDashboard}>
        {loading ? <Skeleton /> : error ? <div className="alert alert-bad"><span>{error}</span></div> : (
          <Table head={['الحلقة', 'المستوى', 'الطالبات', 'المواعيد', 'الفرع', 'الحالة', '']}>
            {(data || []).map((h) => (
              <tr key={h.id}>
                <td><strong>{h.name}</strong></td>
                <td><Badge tone="brand">{h.stage || '—'}</Badge></td>
                <td>{h.students_count}</td>
                <td className="sm">{h.schedule || '—'}</td>
                <td className="sm muted">{h.branch_name || '—'}</td>
                <td><StatusBadge status={h.published ? 'accepted' : 'pending'} label={h.published ? 'منشورة' : 'مسودة'} /></td>
                <td className="cell-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => setSel(h)}><Users size={13} strokeWidth={1.75} /> الطالبات</button>
                  {h.link && <a className="btn btn-soft btn-sm" href={h.link} target="_blank" rel="noreferrer"><Link2 size={13} strokeWidth={1.75} /> فتح</a>}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={Boolean(sel)} wide title={sel ? `طالبات ${sel.name}` : ''} onClose={() => setSel(null)}>
        {roster.loading ? <Skeleton /> : (
          <Table head={['الطالبة', 'اسم المستخدم', 'المستوى', 'مثبّتة']} empty="لا توجد طالبات في هذه الحلقة.">
            {(roster.data || []).map((s) => (
              <tr key={s.id}><td>{s.name}</td><td className="sm muted">{s.username}</td><td><Badge tone="brand">{s.stage || '—'}</Badge></td><td>{s.pinned ? <Badge tone="ok">نعم</Badge> : <Badge>لا</Badge>}</td></tr>
            ))}
          </Table>
        )}
      </Modal>
    </>
  );
}

export function TeacherStudents() {
  const { data, loading, error } = useAsync(() => api.get('teacher/students'), []);
  const [q, setQ] = useState('');
  const rows = (data || []).filter((s) => !q || s.name.includes(q) || String(s.username).includes(q));
  return (
    <Card title="طالباتي" sub={`${rows.length} طالبة في حلقاتك`} icon={Users}
      actions={<input type="text" placeholder="بحث بالاسم…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 220 }} />}>
      {loading ? <Skeleton /> : error ? <div className="alert alert-bad"><span>{error}</span></div> : (
        <Table head={['الطالبة', 'اسم المستخدم', 'المستوى', 'الحلقة']} empty="لا توجد طالبات.">
          {rows.map((s) => (
            <tr key={`${s.id}-${s.halqa_id}`}>
              <td><div className="inline" style={{ gap: 9 }}><Avatar name={s.name} /><strong>{s.name}</strong></div></td>
              <td className="sm muted">{s.username}</td>
              <td><Badge tone="brand">{s.stage || '—'}</Badge></td>
              <td className="sm">{s.halqa_name}</td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}
export function TeacherAttendance() {
  const toast = useToast();
  const halqas = useAsync(() => api.get('teacher/halqas'), []);
  const [halqaId, setHalqaId] = useState('');
  const [date, setDate] = useState(today());
  const [marks, setMarks] = useState({});
  const [busy, setBusy] = useState(false);

  const sheet = useAsync(async () => (halqaId ? api.get(`teacher/attendance?halqa_id=${halqaId}&date=${date}`) : null), [halqaId, date]);
  const statuses = (sheet.data && sheet.data.statuses) || [];
  const students = (sheet.data && sheet.data.students) || [];
  const current = (id) => (marks[id] !== undefined ? marks[id] : (sheet.data && (sheet.data.students.find((s) => s.student_id === id) || {}).status) || 'present');

  const save = async () => {
    if (!students.length) return toast.err('لا توجد طالبات في هذه الحلقة.');
    setBusy(true);
    try {
      const records = students.map((s) => ({ student_id: s.student_id, status: current(s.student_id), note: marks[`note_${s.student_id}`] || s.note || '' }));
      const r = await api.post('teacher/attendance', { halqa_id: Number(halqaId), date, records });
      toast.ok(r.message); setMarks({}); sheet.reload();
    } catch (e) { toast.err(e.message); } finally { setBusy(false); }
  };

  return (
    <>
      <Card title="التحضير اليومي" sub="اختاري الحلقة والتاريخ ثم سجّلي حالة كل طالبة" icon={CalendarCheck}
        actions={<div className="inline">
          <select value={halqaId} onChange={(e) => { setHalqaId(e.target.value); setMarks({}); }} style={{ minWidth: 190 }}>
            <option value="">— اختاري الحلقة —</option>
            {(halqas.data || []).map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setMarks({}); }} />
          <button className="btn btn-ghost btn-sm" onClick={() => sheet.reload()}>تحديث</button>
        </div>}>
        {!halqaId ? <EmptyState text="اختاري الحلقة للبدء في تسجيل الحضور." icon={CalendarCheck} />
          : sheet.loading ? <Skeleton /> : !students.length ? <EmptyState text="لا توجد طالبات مسجَّلات في هذه الحلقة." icon={Users} />
            : (
              <Table head={['الطالبة', 'المستوى', 'الحالة', 'دقائق التأخير', 'ملاحظة']}>
                {students.map((s) => (
                  <tr key={s.student_id}>
                    <td><strong>{s.name}</strong><div className="muted xs">{s.username}</div></td>
                    <td><Badge tone="brand">{s.stage || '—'}</Badge></td>
                    <td>
                      <select value={current(s.student_id)} onChange={(e) => setMarks({ ...marks, [s.student_id]: e.target.value })} style={{ minWidth: 150 }}>
                        {statuses.map((st) => <option key={st.value} value={st.value}>{st.label}</option>)}
                      </select>
                    </td>
                    <td>
                      {current(s.student_id) === 'late10'
                        ? <input type="number" min="1" max="60" style={{ maxWidth: 90 }} defaultValue={s.minutes_late || 10}
                            onChange={(e) => setMarks({ ...marks, [`min_${s.student_id}`]: e.target.value })} />
                        : <span className="muted sm">—</span>}
                    </td>
                    <td><input type="text" placeholder="ملاحظة…" defaultValue={s.note || ''}
                      onChange={(e) => setMarks({ ...marks, [`note_${s.student_id}`]: e.target.value })} /></td>
                  </tr>
                ))}
              </Table>
            )}
      </Card>
      {halqaId && students.length > 0 && (
        <div className="inline">
          <button className="btn" onClick={save} disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <Save size={16} strokeWidth={1.75} />} حفظ التحضير</button>
          {sheet.data && sheet.data.marked && <Badge tone="ok">يوجد تحضير محفوظ لهذا اليوم — الحفظ سيحدّثه</Badge>}
        </div>
      )}
    </>
  );
}
export function TeacherGrades() {
  const toast = useToast();
  const halqas = useAsync(() => api.get('teacher/halqas'), []);
  const [halqaId, setHalqaId] = useState('');
  const [stage, setStage] = useState('');
  const [maxTheory, setMaxTheory] = useState(50);
  const [maxPractical, setMaxPractical] = useState(50);
  const [marks, setMarks] = useState({});
  const [busy, setBusy] = useState(false);

  const roster = useAsync(async () => (halqaId ? api.get(`teacher/halqas/${halqaId}/students`) : []), [halqaId]);
  const list = useAsync(() => api.get('teacher/grades'), []);
  const students = roster.data || [];

  const val = (id, key) => {
    const key2 = `${key}_${id}`;
    return marks[key2] !== undefined ? marks[key2] : '';
  };
  const setVal = (id, key, v) => setMarks((m) => ({ ...m, [`${key}_${id}`]: v }));

  const send = async () => {
    const records = students.map((s) => ({
      student_id: s.id, stage: stage || (halqas.data || []).find((h) => String(h.id) === String(halqaId))?.stage || null,
      theory_score: val(s.id, 'th'), practical_score: val(s.id, 'pr'), max_theory: maxTheory, max_practical: maxPractical,
      notes: marks[`nt_${s.id}`] || ''
    })).filter((r) => r.theory_score !== '' || r.practical_score !== '');
    if (!records.length) return toast.err('أدخلي درجة واحدة على الأقل.');
    setBusy(true);
    try {
      const r = await api.post('teacher/grades', { records, max_theory: maxTheory, max_practical: maxPractical });
      toast.ok(r.message); setMarks({}); list.reload();
    } catch (e) { toast.err(e.message); } finally { setBusy(false); }
  };

  return (
    <>
      <Card title="إضافة وإرسال الدرجات" sub="تُرسل الدرجات للطالبات مباشرة بعد الحفظ" icon={LineChart}
        actions={<div className="inline">
          <select value={halqaId} onChange={(e) => { setHalqaId(e.target.value); const h = (halqas.data || []).find((x) => String(x.id) === e.target.value); if (h) setStage(h.stage || ''); }} style={{ minWidth: 180 }}>
            <option value="">— اختاري الحلقة —</option>
            {(halqas.data || []).map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <label className="check">نظري من <input type="number" style={{ maxWidth: 74 }} value={maxTheory} onChange={(e) => setMaxTheory(Number(e.target.value))} /></label>
          <label className="check">عملي من <input type="number" style={{ maxWidth: 74 }} value={maxPractical} onChange={(e) => setMaxPractical(Number(e.target.value))} /></label>
        </div>}>
        {!halqaId ? <EmptyState text="اختاري الحلقة ثم أدخلي الدرجات." icon={LineChart} />
          : roster.loading ? <Skeleton /> : !students.length ? <EmptyState text="لا توجد طالبات في هذه الحلقة." icon={Users} />
            : (
              <Table head={['الطالبة', `النظري / ${maxTheory}`, `العملي / ${maxPractical}`, 'ملاحظة']}>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.name}</strong><div className="muted xs">{s.stage || '—'}</div></td>
                    <td><input type="number" min="0" max={maxTheory} value={val(s.id, 'th')} onChange={(e) => setVal(s.id, 'th', e.target.value)} style={{ maxWidth: 110 }} /></td>
                    <td><input type="number" min="0" max={maxPractical} value={val(s.id, 'pr')} onChange={(e) => setVal(s.id, 'pr', e.target.value)} style={{ maxWidth: 110 }} /></td>
                    <td><input type="text" placeholder="ملاحظة…" value={marks[`nt_${s.id}`] || ''} onChange={(e) => setMarks({ ...marks, [`nt_${s.id}`]: e.target.value })} /></td>
                  </tr>
                ))}
              </Table>
            )}
      </Card>
      {halqaId && students.length > 0 && (
        <div className="inline"><button className="btn" onClick={send} disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <Send size={16} strokeWidth={1.75} />} إرسال الدرجات</button></div>
      )}

      <Card title="سجل الدرجات" sub={`${(list.data || []).length} نتيجة مرصودة`} icon={LineChart}>
        {list.loading ? <Skeleton /> : (
          <Table head={['التاريخ', 'الطالبة', 'المستوى', 'نظري', 'عملي', 'المجموع', 'ملاحظة']} empty="لا توجد درجات مرصودة بعد.">
            {(list.data || []).map((g) => (
              <tr key={g.id}>
                <td>{fmtDate(g.created_at)}</td>
                <td>{g.student_name}</td>
                <td><Badge tone="brand">{g.stage || '—'}</Badge></td>
                <td>{g.theory_score ?? '—'}</td>
                <td>{g.practical_score ?? '—'}</td>
                <td><strong>{g.total}</strong></td>
                <td className="sm">{g.notes || '—'}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
export function TeacherRecitation() {
  const toast = useToast();
  const students = useAsync(() => api.get('teacher/students'), []);
  const list = useAsync(() => api.get('teacher/recitation'), []);
  const [form, setForm] = useState({ student_id: '', surah: '', ayah_from: '', ayah_to: '', kind: 'note', note: '' });
  const [busy, setBusy] = useState(false);

  const send = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const r = await api.post('teacher/recitation', { ...form, student_id: Number(form.student_id) });
      toast.ok(r.message); setForm({ ...form, surah: '', ayah_from: '', ayah_to: '', note: '' }); list.reload();
    } catch (err) { toast.err(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="grid grid-2">
      <Card title="تسجيل ملاحظة تسميع" sub="تُرسل للطالبة فورًا" icon={BookMarked}>
        <form className="form-stack" onSubmit={send}>
          <Field label="الطالبة" required>
            <select value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} required>
              <option value="">— اختاري الطالبة —</option>
              {(students.data || []).map((s) => <option key={`${s.id}-${s.halqa_id}`} value={s.id}>{s.name} — {s.halqa_name}</option>)}
            </select>
          </Field>
          <Row>
            <Field label="السورة" required><input type="text" value={form.surah} onChange={(e) => setForm({ ...form, surah: e.target.value })} placeholder="مثال: البقرة" required /></Field>
            <Field label="من آية"><input type="number" min="1" value={form.ayah_from} onChange={(e) => setForm({ ...form, ayah_from: e.target.value })} /></Field>
            <Field label="إلى آية"><input type="number" min="1" value={form.ayah_to} onChange={(e) => setForm({ ...form, ayah_to: e.target.value })} /></Field>
          </Row>
          <Field label="نوع الملاحظة" required>
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              <option value="note">ملاحظة</option><option value="error">خطأ</option>
            </select>
          </Field>
          <Field label="نص الملاحظة" required><textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="مثال: تحتاج ضبط المدود في الآية…" required /></Field>
          <button className="btn btn-block" disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <Send size={16} strokeWidth={1.75} />} إرسال الملاحظة</button>
        </form>
      </Card>

      <Card title="ملاحظاتي المسجّلة" sub={`${(list.data || []).length} ملاحظة`} icon={BookMarked}>
        {list.loading ? <Skeleton /> : (
          <Table head={['التاريخ', 'الطالبة', 'السورة', 'النوع', 'الملاحظة']} empty="لم تسجّلي ملاحظات بعد.">
            {(list.data || []).map((r) => (
              <tr key={r.id}>
                <td>{fmtDate(r.created_at)}</td>
                <td>{r.student_name}</td>
                <td className="sm">{r.surah}{r.ayah_from ? ` (${r.ayah_from}${r.ayah_to ? `–${r.ayah_to}` : ''})` : ''}</td>
                <td><Badge tone={r.kind === 'error' ? 'bad' : 'ok'}>{r.kind_label}</Badge></td>
                <td className="sm">{r.note}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
export function TeacherActivities() {
  const toast = useToast();
  const halqas = useAsync(() => api.get('teacher/halqas'), []);
  const list = useAsync(() => api.get('teacher/activities'), []);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ halqa_id: '', title: '', description: '', kind: 'homework', due_date: '', published: true, file: null });
  const [review, setReview] = useState(null);
  const subs = useAsync(async () => (review ? api.get(`teacher/activities/${review.id}/submissions`) : null), [review && review.id]);
  const [grades, setGrades] = useState({});

  const create = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const payload = { ...form, halqa_id: Number(form.halqa_id) };
      delete payload.file;
      if (form.file) payload.attachment = await toDataUrl(form.file);
      const r = await api.post('teacher/activities', payload);
      toast.ok(r.message); setOpen(false); setForm({ ...form, title: '', description: '', due_date: '', file: null }); list.reload();
    } catch (err) { toast.err(err.message); } finally { setBusy(false); }
  };

  const saveGrade = async (s) => {
    try {
      const r = await api.patch(`teacher/submissions/${s.submission_id}`, { grade: grades[s.submission_id] !== undefined ? grades[s.submission_id] : s.grade, feedback: grades[`f_${s.submission_id}`] !== undefined ? grades[`f_${s.submission_id}`] : s.feedback });
      toast.ok(r.message); subs.reload(); list.reload();
    } catch (e) { toast.err(e.message); }
  };

  return (
    <>
      <Card title="الأنشطة" sub={`${(list.data || []).length} نشاط`} icon={ClipboardList}
        actions={<button className="btn" onClick={() => setOpen(true)}><Plus size={16} strokeWidth={1.75} /> نشاط جديد</button>}>
        {list.loading ? <Skeleton /> : (
          <Table head={['النشاط', 'الحلقة', 'النوع', 'تاريخ التسليم', 'التسليمات', 'الحالة', '']} empty="لم تنشئي أنشطة بعد.">
            {(list.data || []).map((a) => (
              <tr key={a.id}>
                <td><strong>{a.title}</strong>{a.description && <div className="muted xs">{a.description}</div>}</td>
                <td className="sm">{a.halqa_name}</td>
                <td><Badge tone="brand">{a.kind === 'homework' ? 'واجب' : a.kind === 'tadabbur' ? 'تدبّر' : a.kind === 'research' ? 'بحث' : a.kind}</Badge></td>
                <td className="sm">{fmtDate(a.due_date)}</td>
                <td>{a.submissions_count} / {a.students_count}</td>
                <td><StatusBadge status={a.published ? 'accepted' : 'pending'} label={a.published ? 'منشور' : 'مسودة'} /></td>
                <td className="cell-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => { setReview(a); setGrades({}); }}><CheckCheck size={13} strokeWidth={1.75} /> التصحيح</button>
                  {a.attachment_path && <a className="btn btn-soft btn-sm" href={fileUrl(a.attachment_path)} target="_blank" rel="noreferrer"><FileUp size={13} strokeWidth={1.75} /> المرفق</a>}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={open} title="إنشاء نشاط" onClose={() => setOpen(false)}
        footer={<><button className="btn" type="submit" form="act-form" disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <Plus size={16} strokeWidth={1.75} />} حفظ</button><button className="btn btn-ghost" onClick={() => setOpen(false)}>إلغاء</button></>}>
        <form id="act-form" className="form-stack" onSubmit={create}>
          <Row>
            <Field label="الحلقة" required>
              <select value={form.halqa_id} onChange={(e) => setForm({ ...form, halqa_id: e.target.value })} required>
                <option value="">— اختاري الحلقة —</option>
                {(halqas.data || []).map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </Field>
            <Field label="النوع" required>
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                <option value="homework">واجب</option><option value="tadabbur">تدبّر</option>
                <option value="research">بحث</option><option value="memorization">حفظ</option>
              </select>
            </Field>
          </Row>
          <Field label="العنوان" required><input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></Field>
          <Field label="الوصف"><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Row>
            <Field label="تاريخ التسليم"><input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></Field>
            <Field label="مرفق (اختياري)"><input type="file" onChange={(e) => setForm({ ...form, file: e.target.files[0] || null })} /></Field>
          </Row>
          <label className="check"><input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} /> نشر النشاط للطالبات فورًا</label>
        </form>
      </Modal>

      <Modal open={Boolean(review)} wide title={review ? `تسليمات: ${review.title}` : ''} onClose={() => setReview(null)}>
        {subs.loading ? <Skeleton /> : (
          <Table head={['الطالبة', 'الحالة', 'الملاحظة', 'المرفق', 'الدرجة / 10', 'تقييم', '']}>
            {((subs.data && subs.data.students) || []).map((s) => (
              <tr key={s.student_id}>
                <td>{s.name}</td>
                <td>{s.submission_id ? <StatusBadge status={s.status} label={s.status === 'graded' ? 'مُقيَّم' : 'مُسلَّم'} /> : <Badge tone="warn">لم يُسلَّم</Badge>}</td>
                <td className="sm">{s.note || '—'}{s.link ? <> — <a href={s.link} target="_blank" rel="noreferrer">رابط</a></> : null}</td>
                <td>{s.file_path ? <a href={fileUrl(s.file_path)} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">عرض</a> : '—'}</td>
                <td>{s.submission_id ? <input type="number" min="0" max="10" style={{ maxWidth: 84 }} value={grades[s.submission_id] !== undefined ? grades[s.submission_id] : (s.grade ?? '')} onChange={(e) => setGrades({ ...grades, [s.submission_id]: e.target.value })} /> : '—'}</td>
                <td>{s.submission_id ? <input type="text" value={grades[`f_${s.submission_id}`] !== undefined ? grades[`f_${s.submission_id}`] : (s.feedback || '')} onChange={(e) => setGrades({ ...grades, [`f_${s.submission_id}`]: e.target.value })} /> : '—'}</td>
                <td>{s.submission_id ? <button className="btn btn-sm" onClick={() => saveGrade(s)}>حفظ</button> : '—'}</td>
              </tr>
            ))}
          </Table>
        )}
      </Modal>
    </>
  );
}
export function TeacherAppointments() {
  const toast = useToast();
  const [status, setStatus] = useState('pending');
  const { data, loading, error, reload } = useAsync(() => api.get(`teacher/appointments?status=${status}`), [status]);
  const decide = async (row, decision) => {
    try {
      const note = window.prompt(decision === 'accepted' ? 'ملاحظة القبول (اختياري):' : 'سبب الرفض (اختياري):') || '';
      const r = await api.patch(`teacher/appointments/${row.id}`, { status: decision, note });
      toast.ok(r.message); reload();
    } catch (e) { toast.err(e.message); }
  };
  return (
    <>
      <div className="page-head">
        <Tabs tabs={[{ key: 'pending', label: 'قيد المراجعة' }, { key: 'accepted', label: 'المقبولة' }, { key: 'rejected', label: 'المرفوضة' }]} active={status} onChange={setStatus} />
      </div>
      <Card title="طلبات المواعيد" sub="عيادات الطالبات في حلقاتك" icon={CalendarCheck}>
        {loading ? <Skeleton /> : error ? <div className="alert alert-bad"><span>{error}</span></div> : (
          <Table head={['الطالبة', 'العيادة', 'التاريخ', 'الوقت', 'ملاحظة الطالبة', 'الحالة', 'إجراء']} empty="لا توجد طلبات في هذه القائمة.">
            {(data || []).map((a) => (
              <tr key={a.id}>
                <td><strong>{a.student_name}</strong><div className="muted xs">{a.username}</div></td>
                <td><Badge tone="brand">{a.clinic_label}</Badge></td>
                <td>{fmtDate(a.date)}</td>
                <td>{a.time}</td>
                <td className="sm">{a.note || '—'}</td>
                <td><StatusBadge status={a.status} label={a.status === 'pending' ? 'قيد المراجعة' : a.status === 'accepted' ? 'مقبول' : 'مرفوض'} /></td>
                <td className="cell-actions">
                  {a.status === 'pending' && <>
                    <button className="btn btn-ok btn-sm" onClick={() => decide(a, 'accepted')}><CheckCheck size={13} strokeWidth={1.75} /> قبول</button>
                    <button className="btn btn-danger btn-sm" onClick={() => decide(a, 'rejected')}>رفض</button>
                  </>}
                  {a.decision_note && <span className="muted xs">{a.decision_note}</span>}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}

export function TeacherRewards() {
  const toast = useToast();
  const { meta } = useAuth();
  const types = (meta && meta.reward_types) || { attendance: 'تعزيزات الحضور', academic: 'تعزيزات التميز الدراسي', other: 'تعزيزات أخرى' };
  const students = useAsync(() => api.get('teacher/students'), []);
  const list = useAsync(() => api.get('teacher/rewards'), []);
  const [form, setForm] = useState({ student_id: '', type: 'academic', title: '', points: 5, note: '' });
  const [busy, setBusy] = useState(false);

  const send = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const r = await api.post('teacher/rewards', { ...form, student_id: Number(form.student_id), points: Number(form.points) });
      toast.ok(r.message); setForm({ ...form, note: '', title: '' }); list.reload();
    } catch (err) { toast.err(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="grid grid-2">
      <Card title="منح تعزيز" sub="نقاط أو شارات تحفيزية" icon={Award}>
        <form className="form-stack" onSubmit={send}>
          <Field label="الطالبة" required>
            <select value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} required>
              <option value="">— اختاري الطالبة —</option>
              {(students.data || []).map((s) => <option key={`${s.id}-${s.halqa_id}`} value={s.id}>{s.name} — {s.halqa_name}</option>)}
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
          <Field label="العنوان" hint="يُملأ تلقائيًا بنوع التعزيز إذا تُرك فارغًا"><input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="ملاحظة"><textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
          <button className="btn btn-gold btn-block" disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} strokeWidth={1.75} />} منح التعزيز</button>
        </form>
      </Card>

      <Card title="التعزيزات الممنوحة" sub={`${(list.data || []).length} تعزيز`} icon={Award}>
        {list.loading ? <Skeleton /> : (
          <Table head={['التاريخ', 'الطالبة', 'النوع', 'النقاط', 'ملاحظة']} empty="لم تمنحي تعزيزات بعد.">
            {(list.data || []).map((r) => (
              <tr key={r.id}>
                <td>{fmtDate(r.created_at)}</td>
                <td>{r.student_name}</td>
                <td><Badge tone="gold">{r.type_label}</Badge></td>
                <td><strong>{r.points}</strong></td>
                <td className="sm">{r.note || '—'}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
export function TeacherEvaluations() {
  const toast = useToast();
  const halqas = useAsync(() => api.get('teacher/halqas'), []);
  const list = useAsync(() => api.get('teacher/evaluations'), []);
  const [halqaId, setHalqaId] = useState('');
  const roster = useAsync(async () => (halqaId ? api.get(`teacher/halqas/${halqaId}/students`) : []), [halqaId]);
  const [form, setForm] = useState({ student_id: '', theory_score: '', practical_score: '', tasmi_score: '', jazari_score: '', notes: '' });
  const [busy, setBusy] = useState(false);

  const total = ['theory_score', 'practical_score', 'tasmi_score', 'jazari_score'].reduce((s, k) => s + (Number(form[k]) || 0), 0);

  const send = async (e) => {
    e.preventDefault();
    if (!halqaId) return toast.err('اختاري الحلقة أولًا.');
    setBusy(true);
    try {
      const r = await api.post('teacher/evaluations', { ...form, halqa_id: Number(halqaId), student_id: form.student_id ? Number(form.student_id) : null });
      toast.ok(`${r.message} — النتيجة: ${r.result} (${r.total}/100)`);
      setForm({ student_id: '', theory_score: '', practical_score: '', tasmi_score: '', jazari_score: '', notes: '' });
      list.reload();
    } catch (err) { toast.err(err.message); } finally { setBusy(false); }
  };

  return (
    <>
      <Card title="اختبار عملي / تقييم حلقة" sub="كل بند من 25 درجة — المجموع من 100" icon={Sparkles}
        actions={<select value={halqaId} onChange={(e) => setHalqaId(e.target.value)} style={{ minWidth: 190 }}>
          <option value="">— اختاري الحلقة —</option>
          {(halqas.data || []).map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>}>
        <form className="form-stack" onSubmit={send}>
          <Row cols={3}>
            <Field label="الطالبة (اختياري)" hint="اتركيه فارغًا لتقييم عام للحلقة">
              <select value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })}>
                <option value="">— تقييم الحلقة —</option>
                {(roster.data || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="النظري / 25"><input type="number" min="0" max="25" value={form.theory_score} onChange={(e) => setForm({ ...form, theory_score: e.target.value })} /></Field>
            <Field label="العملي / 25"><input type="number" min="0" max="25" value={form.practical_score} onChange={(e) => setForm({ ...form, practical_score: e.target.value })} /></Field>
            <Field label="التسميع / 25"><input type="number" min="0" max="25" value={form.tasmi_score} onChange={(e) => setForm({ ...form, tasmi_score: e.target.value })} /></Field>
            <Field label="الجزرية / 25"><input type="number" min="0" max="25" value={form.jazari_score} onChange={(e) => setForm({ ...form, jazari_score: e.target.value })} /></Field>
            <Field label="المجموع"><input type="text" value={`${total} / 100`} readOnly /></Field>
          </Row>
          <Field label="ملاحظات التقييم"><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <div className="inline">
            <button className="btn" disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <Save size={16} strokeWidth={1.75} />} إرسال التقييم</button>
            <Badge tone={total >= 90 ? 'ok' : total >= 70 ? 'gold' : 'bad'}>
              التقدير المتوقع: {total >= 90 ? 'ممتاز' : total >= 80 ? 'جيد جدًا' : total >= 70 ? 'جيد' : total >= 60 ? 'مقبول' : 'يحتاج تحسين'}
            </Badge>
          </div>
        </form>
      </Card>

      <Card title="سجل التقييمات" sub={`${(list.data || []).length} تقييم`} icon={Sparkles}>
        {list.loading ? <Skeleton /> : (
          <Table head={['التاريخ', 'الطالبة / الحلقة', 'نظري', 'عملي', 'تسميع', 'جزرية', 'المجموع', 'النتيجة']} empty="لا توجد تقييمات بعد.">
            {(list.data || []).map((e) => {
              const t = (e.theory_score || 0) + (e.practical_score || 0) + (e.tasmi_score || 0) + (e.jazari_score || 0);
              return (
                <tr key={e.id}>
                  <td>{fmtDate(e.created_at)}</td>
                  <td>{e.student_name || <span className="muted sm">تقييم حلقة</span>}<div className="muted xs">{e.halqa_name}</div></td>
                  <td>{e.theory_score ?? '—'}</td><td>{e.practical_score ?? '—'}</td>
                  <td>{e.tasmi_score ?? '—'}</td><td>{e.jazari_score ?? '—'}</td>
                  <td><strong>{t}</strong></td>
                  <td><Badge tone={t >= 80 ? 'ok' : t >= 60 ? 'gold' : 'bad'}>{e.result}</Badge></td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </>
  );
}

export function TeacherRequests() {
  const { data, loading, error } = useAsync(() => api.get('teacher/requests'), []);
  return (
    <Card title="طلبات التسجيل والطلبات الواردة" sub="طلبات الطالبات المرتبطات بحلقاتك — القرار النهائي للمشرفة" icon={ClipboardList}>
      {loading ? <Skeleton /> : error ? <div className="alert alert-bad"><span>{error}</span></div> : (
        <Table head={['التاريخ', 'مقدّمة الطلب', 'النوع', 'التفاصيل', 'الحالة']} empty="لا توجد طلبات واردة.">
          {(data || []).map((r) => (
            <tr key={r.id}>
              <td>{fmtDate(r.created_at)}</td>
              <td>{r.requester_name}</td>
              <td><Badge tone="brand">{r.type}</Badge></td>
              <td className="sm">{r.details}</td>
              <td><StatusBadge status={r.status} label={r.status === 'pending' ? 'قيد المراجعة' : r.status === 'accepted' ? 'مقبول' : 'مرفوض'} /></td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}
