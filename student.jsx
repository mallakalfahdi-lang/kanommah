import React, { useState } from 'react';
import {
  CalendarCheck, Award, BookOpenText, Link2, ClipboardList, AlertTriangle, Wallet,
  FileUp, CheckCircle2, Loader2, Plus, Sparkles, TrendingUp, GraduationCap, Send
} from 'lucide-react';
import { api, fmtDate, fmtDateTime, fileUrl, toDataUrl, today, monthNow, pct } from '../api.js';
import { useAsync } from '../hooks.js';
import { useAuth } from '../store.jsx';
import { useToast } from '../toast.jsx';
import {
  Card, Stat, Table, Badge, StatusBadge, Skeleton, EmptyState, Donut, Bar,
  Modal, Field, Row, Avatar, Loading, Tabs
} from '../ui.jsx';

const GRADES_KEYS = ['theory_score', 'practical_score'];

export function StudentHome() {
  const { user } = useAuth();
  const { data, loading, error } = useAsync(() => api.get('student/overview'), []);
  if (loading) return <Skeleton rows={6} />;
  if (error) return <div className="alert alert-bad"><AlertTriangle size={17} /><span>{error}</span></div>;
  const att = data.attendance || {};
  const reward = data.rewards || { p: 0, c: 0 };
  const g = data.last_grade;

  return (
    <>
      <Card>
        <div className="inline" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div className="inline" style={{ gap: 13 }}>
            <Avatar name={user.name} />
            <div>
              <h2>أهلًا، {user.name}</h2>
              <p className="muted sm">
                {data.halqa ? <>حلقتك: <strong>{data.halqa.name}</strong> — المعلمة {data.halqa.teacher_name} — {data.halqa.branch_name}</> : 'لم تُسجَّلي في حلقة بعد.'}
              </p>
            </div>
          </div>
          {data.halqa && data.halqa.link && (
            <a className="btn btn-gold" href={data.halqa.link} target="_blank" rel="noreferrer"><Link2 size={16} strokeWidth={1.75} /> دخول الحلقة</a>
          )}
        </div>
      </Card>

      <div className="stats-row">
        <Stat label="نسبة الحضور" value={`${att.rate || 0}%`} hint={`${att.present || 0} حضور من ${att.total || 0} تسجيل`} icon={CalendarCheck} tone="ok" />
        <Stat label="آخر درجة" value={g ? `${g.total}/100` : '—'} hint={g ? `نظري ${g.theory_score} · عملي ${g.practical_score}` : 'لم تُرصد درجات بعد'} icon={TrendingUp} tone="gold" />
        <Stat label="نقاط التعزيز" value={reward.p || 0} hint={`${reward.c || 0} تعزيز ممنوح`} icon={Award} tone="brand" />
        <Stat label="حالة الرسوم" value={data.payment ? (data.payment.status === 'paid' ? 'مسددة' : data.payment.status === 'pending' ? 'بالمراجعة' : 'غير مسددة') : 'لا يوجد سجل'}
          hint={data.payment ? `شهر ${data.payment.month} — ${data.payment.amount} ر.ع` : 'تواصلي مع الإدارة'} icon={Wallet}
          tone={data.payment && data.payment.status === 'paid' ? 'ok' : data.payment ? 'warn' : 'bad'} />
      </div>

      <div className="grid grid-2">
        <Card title="الحضور والغياب" sub="توزيع التسجيلات" icon={CalendarCheck}>
          <div className="inline" style={{ gap: 22, alignItems: 'center' }}>
            <Donut value={att.rate || 0} label="نسبة الحضور" />
            <div className="legend" style={{ flexDirection: 'column', gap: 8 }}>
              {Object.entries(att.counts || {}).map(([k, v]) => (
                <span key={k} className="legend-item"><i className="dot" /> {att.labels?.[k] || k}: <strong>{v}</strong></span>
              ))}
              {!Object.keys(att.counts || {}).length && <span className="muted sm">لا توجد تسجيلات حضور بعد.</span>}
            </div>
          </div>
        </Card>

        <Card title="مهامّي القريبة" sub="الأنشطة والمواعيد" icon={ClipboardList}>
          <div className="kv"><span>أنشطة لم تُسلَّم</span><span>{data.open_activities || 0}</span></div>
          <div className="kv"><span>مواعيد بانتظار الموافقة</span><span>{data.pending_appointments || 0}</span></div>
          <hr className="hr" />
          <div className="alert"><Sparkles size={17} strokeWidth={1.75} /><span>{data.settings?.tadabbur_lesson || 'موعد درس التدبّر يُعلن من الإدارة.'}</span></div>
          <div className="alert alert-warn" style={{ marginTop: 10 }}><Wallet size={17} strokeWidth={1.75} /><span>{data.settings?.monthly_payment || 'الدفع الشهري قبل اليوم الخامس.'}</span></div>
        </Card>
      </div>
    </>
  );
}
export function StudentHalqas() {
  const toast = useToast();
  const mine = useAsync(() => api.get('student/registrations'), []);
  const all = useAsync(() => api.get('common/halqas'), []);
  const [target, setTarget] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const enrolledIds = new Set((mine.data || []).map((r) => r.id));
  const register = async () => {
    setBusy(true);
    try {
      const r = await api.post('student/registrations', { halqa_id: target.id, note });
      toast.ok(r.message); setTarget(null); setNote(''); mine.reload(); all.reload();
    } catch (e) { toast.err(e.message); } finally { setBusy(false); }
  };

  return (
    <>
      <Card title="حلقاتي المسجَّلة" sub="الحلقات التي التحقتِ بها ومواعيدها" icon={BookOpenText}>
        {mine.loading ? <Skeleton /> : (
          <Table head={['الحلقة', 'المستوى', 'المعلمة', 'الفرع', 'المواعيد', 'الحالة', 'الرابط']}>
            {(mine.data || []).map((h) => (
              <tr key={h.id}>
                <td><strong>{h.name}</strong></td>
                <td><Badge tone="brand">{h.stage || '—'}</Badge></td>
                <td>{h.teacher_name || '—'}</td>
                <td className="sm muted">{h.branch_name || '—'}</td>
                <td className="sm">{h.schedule || '—'}</td>
                <td><StatusBadge status={h.status === 'pending' ? 'pending' : 'accepted'} label={h.status === 'pending' ? 'قيد المراجعة' : 'مُعتمدة'} /></td>
                <td>{h.link ? <a className="btn btn-soft btn-sm" href={h.link} target="_blank" rel="noreferrer"><Link2 size={13} strokeWidth={1.75} /> فتح</a> : <span className="muted sm">—</span>}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title="الحلقات المتاحة للتسجيل" sub="اختاري الحلقة المناسبة لمستواك" icon={Plus}>
        {all.loading ? <Skeleton /> : (
          <Table head={['الحلقة', 'المستوى', 'المعلمة', 'المواعيد', 'الطالبات', '']}>
            {(all.data || []).map((h) => (
              <tr key={h.id}>
                <td><strong>{h.name}</strong></td>
                <td><Badge tone="brand">{h.stage || '—'}</Badge></td>
                <td>{h.teacher_name || '—'}</td>
                <td className="sm">{h.schedule || '—'}</td>
                <td>{h.students_count}</td>
                <td>
                  {enrolledIds.has(h.id)
                    ? <Badge tone="ok">مسجَّلة</Badge>
                    : <button className="btn btn-sm" onClick={() => setTarget(h)}><Send size={13} strokeWidth={1.75} /> طلب التسجيل</button>}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={Boolean(target)} title={`التسجيل في ${target ? target.name : ''}`} onClose={() => setTarget(null)}
        footer={<><button className="btn" onClick={register} disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <Send size={16} strokeWidth={1.75} />} إرسال الطلب</button><button className="btn btn-ghost" onClick={() => setTarget(null)}>إلغاء</button></>}>
        <Field label="ملاحظة للمشرفة (اختياري)"><textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثال: أرغب في الحلقة لتناسب مستواي في التجويد." /></Field>
      </Modal>
    </>
  );
}
export function StudentAttendance() {
  const [range, setRange] = useState({ from: '', to: '' });
  const { data, loading, error, reload } = useAsync(() => api.get(`student/attendance?from=${range.from}&to=${range.to}`), [range.from, range.to]);
  const rows = data || [];
  const present = rows.filter((r) => r.status === 'present').length;
  const late = rows.filter((r) => r.status === 'late10').length;
  const absent = rows.filter((r) => r.status === 'absent' || r.status === 'unexcused').length;
  const excused = rows.filter((r) => r.status === 'excused').length;

  return (
    <>
      <div className="stats-row">
        <Stat label="إجمالي التسجيلات" value={rows.length} icon={CalendarCheck} />
        <Stat label="حضور" value={present} tone="ok" icon={CheckCircle2} />
        <Stat label="تأخير" value={late} tone="warn" icon={CalendarCheck} />
        <Stat label="غياب" value={absent} tone="bad" icon={AlertTriangle} />
        <Stat label="غياب بعذر" value={excused} tone="gold" icon={FileUp} />
      </div>
      <Card title="سجل الحضور" sub={`نسبة الحضور ${pct(present + late, rows.length)}%`} icon={CalendarCheck}
        actions={<div className="inline">
          <input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
          <input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
          <button className="btn btn-ghost btn-sm" onClick={reload}>تطبيق</button>
        </div>}>
        {loading ? <Skeleton /> : error ? <div className="alert alert-bad"><span>{error}</span></div> : (
          <Table head={['التاريخ', 'الحلقة', 'الحالة', 'دقائق التأخير', 'سجّلته', 'ملاحظة']} empty="لا توجد تسجيلات حضور في هذه الفترة.">
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{fmtDate(r.date)}</td>
                <td className="sm">{r.halqa_name || '—'}</td>
                <td><StatusBadge status={r.status} label={r.status_label} /></td>
                <td>{r.minutes_late || 0}</td>
                <td className="sm muted">{r.teacher_name || '—'}</td>
                <td className="sm">{r.note || '—'}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}

export function StudentGrades() {
  const { data, loading, error } = useAsync(() => api.get('student/grades'), []);
  const rows = data || [];
  const best = rows.reduce((m, r) => Math.max(m, r.total || 0), 0);
  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + (r.total || 0), 0) / rows.length) : 0;

  return (
    <>
      <div className="stats-row">
        <Stat label="عدد النتائج" value={rows.length} icon={GraduationCap} />
        <Stat label="المعدل" value={`${avg}/100`} icon={TrendingUp} tone="gold" />
        <Stat label="أعلى نتيجة" value={`${best}/100`} icon={Award} tone="ok" />
      </div>
      <Card title="درجاتي" sub="النتائج النظرية والعملية المرصودة" icon={TrendingUp}>
        {loading ? <Skeleton /> : error ? <div className="alert alert-bad"><span>{error}</span></div> : (
          <Table head={['التاريخ', 'المستوى', 'نظري', 'عملي', 'المجموع', 'المعلمة', 'ملاحظة']} empty="لم تُرصد درجات بعد.">
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{fmtDate(r.created_at)}</td>
                <td><Badge tone="brand">{r.stage || '—'}</Badge></td>
                <td>{r.theory_score ?? '—'} / {r.max_theory}</td>
                <td>{r.practical_score ?? '—'} / {r.max_practical}</td>
                <td><strong>{r.total}/100</strong><Bar value={r.total} tone={r.total >= 80 ? 'ok' : r.total >= 60 ? 'gold' : 'bad'} /></td>
                <td className="sm muted">{r.teacher_name || '—'}</td>
                <td className="sm">{r.notes || '—'}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
export function StudentRecitation() {
  const { data, loading, error } = useAsync(() => api.get('student/recitation'), []);
  const rows = data || [];
  const errors = rows.filter((r) => r.kind === 'error').length;
  return (
    <>
      <div className="stats-row">
        <Stat label="عدد الملاحظات" value={rows.length} icon={BookOpenText} />
        <Stat label="أخطاء مسجّلة" value={errors} tone="bad" icon={AlertTriangle} />
        <Stat label="ملاحظات إيجابية" value={rows.length - errors} tone="ok" icon={CheckCircle2} />
      </div>
      <Card title="الحفظ والتسميع" sub="ملاحظات المعلمة على التسميع والأخطاء" icon={BookOpenText}>
        {loading ? <Skeleton /> : error ? <div className="alert alert-bad"><span>{error}</span></div> : !rows.length ? (
          <EmptyState text="لا توجد ملاحظات تسميع بعد." icon={BookOpenText} />
        ) : (
          <div className="timeline">
            {rows.map((r) => (
              <div key={r.id} className="tl-item">
                <span className="tl-dot" style={{ background: r.kind === 'error' ? 'var(--bad)' : 'var(--ok)', boxShadow: 'none' }} />
                <div className="tl-body">
                  <div className="inline" style={{ justifyContent: 'space-between' }}>
                    <strong className="sm">{r.surah}{r.ayah_from ? ` — الآية ${r.ayah_from}${r.ayah_to ? `–${r.ayah_to}` : ''}` : ''}</strong>
                    <span className="muted xs">{fmtDate(r.created_at)} — {r.teacher_name || 'المعلمة'}</span>
                  </div>
                  <p className="sm" style={{ color: 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>{r.note}</p>
                  <Badge tone={r.kind === 'error' ? 'bad' : 'ok'}>{r.kind_label}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

export function StudentActivities() {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => api.get('student/activities'), []);
  const [target, setTarget] = useState(null);
  const [form, setForm] = useState({ note: '', link: '', file: null });
  const [busy, setBusy] = useState(false);
  const rows = data || [];

  const submit = async () => {
    setBusy(true);
    try {
      const payload = { note: form.note, link: form.link };
      if (form.file) payload.file = await toDataUrl(form.file);
      const r = await api.post(`student/activities/${target.id}/submit`, payload);
      toast.ok(r.message); setTarget(null); setForm({ note: '', link: '', file: null }); reload();
    } catch (e) { toast.err(e.message); } finally { setBusy(false); }
  };

  const open = (a) => { setTarget(a); setForm({ note: a.submission_note || '', link: a.submission_link || '', file: null }); };

  return (
    <>
      <Card title="الأنشطة والمهام" sub={`${rows.filter((r) => !r.submission_id).length} نشاط لم يُسلَّم`} icon={ClipboardList}>
        {loading ? <Skeleton /> : error ? <div className="alert alert-bad"><span>{error}</span></div> : (
          <div className="grid grid-2">
            {rows.map((a) => (
              <div key={a.id} className="card" style={{ boxShadow: 'none', borderColor: a.submission_id ? 'var(--line)' : 'var(--brand-3)' }}>
                <div className="card-body">
                  <div className="inline" style={{ justifyContent: 'space-between' }}>
                    <strong>{a.title}</strong>
                    {a.submission_id ? <Badge tone={a.grade != null ? 'ok' : 'info'}>{a.grade != null ? `مُقيَّم ${a.grade}` : 'تم التسليم'}</Badge> : <Badge tone="warn">لم يُسلَّم</Badge>}
                  </div>
                  <p className="muted xs">{a.halqa_name} — {a.teacher_name}</p>
                  {a.description && <p className="sm" style={{ marginTop: 6 }}>{a.description}</p>}
                  <div className="inline" style={{ marginTop: 8, gap: 10 }}>
                    <span className="muted xs">تاريخ التسليم: {fmtDate(a.due_date)}</span>
                    {a.attachment_path && <a className="btn btn-ghost btn-sm" href={fileUrl(a.attachment_path)} target="_blank" rel="noreferrer"><FileUp size={13} strokeWidth={1.75} /> مرفق النشاط</a>}
                  </div>
                  {a.feedback && <div className="alert alert-ok" style={{ marginTop: 10 }}><span>تقييم المعلمة: {a.feedback}</span></div>}
                  <button className="btn btn-soft btn-sm" style={{ marginTop: 10 }} onClick={() => open(a)}>
                    {a.submission_id ? 'تعديل التسليم' : 'تسليم النشاط'}
                  </button>
                </div>
              </div>
            ))}
            {!rows.length && <EmptyState text="لا توجد أنشطة منشورة لحلقاتك." icon={ClipboardList} />}
          </div>
        )}
      </Card>

      <Modal open={Boolean(target)} title={target ? `تسليم: ${target.title}` : ''} onClose={() => setTarget(null)}
        footer={<><button className="btn" onClick={submit} disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <FileUp size={16} strokeWidth={1.75} />} تسليم</button><button className="btn btn-ghost" onClick={() => setTarget(null)}>إلغاء</button></>}>
        <div className="form-stack">
          <Field label="ملاحظة التسليم"><textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="اكتبي وصفًا موجزًا للحل…" /></Field>
          <Field label="رابط الحل (اختياري)"><input type="url" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://…" /></Field>
          <Field label="ملف مرفق (اختياري)" hint="PDF أو صورة، بحد أقصى 6 ميجابايت">
            <input type="file" accept="application/pdf,image/*" onChange={(e) => setForm({ ...form, file: e.target.files[0] || null })} />
          </Field>
          {target && target.submission_file && <div className="muted xs">الملف السابق: <a href={fileUrl(target.submission_file)} target="_blank" rel="noreferrer">عرض</a></div>}
        </div>
      </Modal>
    </>
  );
}
export function StudentAppointments() {
  const { meta } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => api.get('student/appointments'), []);
  const clinics = (meta && meta.clinics) || { theory: 'عيادة نظرية', makharij: 'عيادة المخارج' };
  const [form, setForm] = useState({ clinic: 'theory', date: today(), time: '16:00', note: '' });
  const [busy, setBusy] = useState(false);
  const rows = data || [];

  const book = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const r = await api.post('student/appointments', form); toast.ok(r.message); setForm({ ...form, note: '' }); reload(); }
    catch (err) { toast.err(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="grid grid-2">
      <Card title="حجز موعد جديد" sub="عيادة نظرية أو عيادة مخارج" icon={CalendarCheck}>
        <form className="form-stack" onSubmit={book}>
          <Field label="نوع العيادة" required>
            <select value={form.clinic} onChange={(e) => setForm({ ...form, clinic: e.target.value })}>
              {Object.entries(clinics).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Row>
            <Field label="التاريخ" required><input type="date" min={today()} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></Field>
            <Field label="الوقت" required><input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} required /></Field>
          </Row>
          <Field label="ملاحظة (اختياري)"><textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
          <button className="btn" disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <Plus size={16} strokeWidth={1.75} />} إرسال طلب الحجز</button>
        </form>
      </Card>

      <Card title="مواعيدي" sub={`${rows.filter((r) => r.status === 'pending').length} طلب قيد المراجعة`} icon={CalendarCheck}>
        {loading ? <Skeleton /> : error ? <div className="alert alert-bad"><span>{error}</span></div> : (
          <Table head={['العيادة', 'التاريخ', 'الوقت', 'الحالة', 'ملاحظة المشرفة']} empty="لا توجد مواعيد بعد.">
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.clinic_label}</td>
                <td>{fmtDate(r.date)}</td>
                <td>{r.time}</td>
                <td><StatusBadge status={r.status} label={r.status === 'pending' ? 'قيد المراجعة' : r.status === 'accepted' ? 'مقبول' : 'مرفوض'} /></td>
                <td className="sm">{r.decision_note || '—'}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

export function StudentRewards() {
  const { data, loading, error } = useAsync(() => api.get('student/rewards'), []);
  const items = (data && data.items) || [];
  const total = (data && data.total_points) || 0;
  const byType = items.reduce((acc, r) => { acc[r.type_label] = (acc[r.type_label] || 0) + (r.points || 0); return acc; }, {});
  return (
    <>
      <div className="stats-row">
        <Stat label="مجموع النقاط" value={total} icon={Award} tone="gold" />
        <Stat label="عدد التعزيزات" value={items.length} icon={Sparkles} />
        <Stat label="أنواع التعزيز" value={Object.keys(byType).length} icon={GraduationCap} tone="ok" />
      </div>
      <Card title="لوحة التعزيز" sub="النقاط الممنوحة من المعلمات والمشرفات" icon={Award}>
        {loading ? <Skeleton /> : error ? <div className="alert alert-bad"><span>{error}</span></div> : !items.length ? (
          <EmptyState text="لم يُمنح لك تعزيز بعد — اجتهدي في الحضور والتميز!" icon={Award} />
        ) : (
          <>
            <div className="legend" style={{ marginBottom: 14 }}>
              {Object.entries(byType).map(([k, v]) => <span key={k} className="legend-item"><i className="dot" /> {k}: <strong>{v} نقطة</strong></span>)}
            </div>
            <Table head={['التاريخ', 'النوع', 'العنوان', 'النقاط', 'منحت بواسطة', 'ملاحظة']}>
              {items.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.created_at)}</td>
                  <td><Badge tone="gold">{r.type_label}</Badge></td>
                  <td>{r.title}</td>
                  <td><strong>{r.points}</strong></td>
                  <td className="sm muted">{r.given_by_name || '—'}</td>
                  <td className="sm">{r.note || '—'}</td>
                </tr>
              ))}
            </Table>
          </>
        )}
      </Card>
    </>
  );
}
export function StudentPayments() {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => api.get('student/payments'), []);
  const [form, setForm] = useState({ month: monthNow(), amount: '', note: '', receipt: null });
  const [busy, setBusy] = useState(false);
  const rows = data || [];
  const unpaid = rows.filter((r) => r.status !== 'paid').length;

  const upload = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const payload = { month: form.month, amount: Number(form.amount || 0), note: form.note };
      if (form.receipt) payload.receipt = await toDataUrl(form.receipt);
      const r = await api.post('student/payments', payload);
      toast.ok(r.message); setForm({ ...form, receipt: null, note: '' }); reload();
      e.target.reset && e.target.reset();
    } catch (err) { toast.err(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="grid grid-2">
      <Card title="رفع إيصال السداد" sub="يُرسل الإيصال للمراجعة الإدارية" icon={FileUp}>
        <form className="form-stack" onSubmit={upload}>
          <Row>
            <Field label="الشهر" required><input type="month" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} required /></Field>
            <Field label="المبلغ (ر.ع)"><input type="number" min="0" step="0.5" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
          </Row>
          <Field label="إيصال الدفع" hint="PDF أو صورة">
            <input type="file" accept="application/pdf,image/*" onChange={(e) => setForm({ ...form, receipt: e.target.files[0] || null })} />
          </Field>
          <Field label="ملاحظة"><textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
          <button className="btn btn-block" disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <FileUp size={16} strokeWidth={1.75} />} إرسال الإيصال</button>
        </form>
      </Card>

      <Card title="سجل المدفوعات" sub={`${unpaid} شهر بحاجة إلى سداد`} icon={Wallet}>
        {loading ? <Skeleton /> : error ? <div className="alert alert-bad"><span>{error}</span></div> : (
          <Table head={['الشهر', 'المبلغ', 'الحالة', 'الإيصال', 'ملاحظة']} empty="لا توجد سجلات دفع بعد.">
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.month}</td>
                <td>{r.amount != null ? `${r.amount} ر.ع` : '—'}</td>
                <td><StatusBadge status={r.status} label={r.status === 'paid' ? 'مسدَّد' : r.status === 'pending' ? 'بالمراجعة' : 'غير مسدَّد'} /></td>
                <td>{r.receipt_path ? <a className="btn btn-ghost btn-sm" href={fileUrl(r.receipt_path)} target="_blank" rel="noreferrer">عرض</a> : <span className="muted sm">—</span>}</td>
                <td className="sm">{r.note || '—'}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
export function StudentRequests() {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => api.get('student/requests'), []);
  const [form, setForm] = useState({ type: 'استفسار عام', details: '' });
  const [busy, setBusy] = useState(false);
  const rows = data || [];
  const types = ['استفسار عام', 'طلب نقل حلقة', 'طلب إعفاء أو تخفيض', 'طلب شهادة أو كشف درجات', 'عذر غياب', 'أخرى'];

  const send = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const r = await api.post('student/requests', form); toast.ok(r.message); setForm({ ...form, details: '' }); reload(); }
    catch (err) { toast.err(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="grid grid-2">
      <Card title="طلب جديد" sub="تُراجع الطلبات من المشرفة أو الإدارة" icon={Send}>
        <form className="form-stack" onSubmit={send}>
          <Field label="نوع الطلب" required>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="التفاصيل" required hint="اكتبي تفاصيل واضحة (5 أحرف على الأقل)">
            <textarea value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} required />
          </Field>
          <button className="btn btn-block" disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <Send size={16} strokeWidth={1.75} />} إرسال الطلب</button>
        </form>
      </Card>

      <Card title="طلباتي" sub={`${rows.filter((r) => r.status === 'pending').length} قيد المراجعة`} icon={ClipboardList}>
        {loading ? <Skeleton /> : error ? <div className="alert alert-bad"><span>{error}</span></div> : (
          <Table head={['التاريخ', 'النوع', 'التفاصيل', 'الحالة']} empty="لم تقدّمي طلبات بعد.">
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{fmtDate(r.created_at)}</td>
                <td><Badge tone="brand">{r.type}</Badge></td>
                <td className="sm">{r.details}{r.decision_note ? <div className="muted xs">ردّ الإدارة: {r.decision_note}</div> : null}</td>
                <td><StatusBadge status={r.status} label={r.status === 'pending' ? 'قيد المراجعة' : r.status === 'accepted' ? 'مقبول' : 'مرفوض'} /></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

export function StudentAlerts() {
  const { data, loading, error } = useAsync(() => api.get('student/alerts'), []);
  const rows = data || [];
  return (
    <>
      <div className="stats-row">
        <Stat label="عدد التنبيهات" value={rows.length} icon={AlertTriangle} />
        <Stat label="تنبيهات تحذيرية" value={rows.filter((r) => r.level === 'warning').length} tone="bad" icon={AlertTriangle} />
        <Stat label="ملاحظات متابعة" value={rows.filter((r) => r.level !== 'warning').length} tone="ok" icon={CheckCircle2} />
      </div>
      <Card title="تنبيهات المتابعة" sub="ملاحظات إدارية تخصّ مستواك الأكاديمي" icon={AlertTriangle}>
        {loading ? <Skeleton /> : error ? <div className="alert alert-bad"><span>{error}</span></div> : !rows.length ? (
          <EmptyState text="لا توجد تنبيهات — أداؤك على ما يُرام." icon={CheckCircle2} />
        ) : (
          <div className="grid grid-2">
            {rows.map((a) => (
              <div key={a.id} className={`alert ${a.level === 'warning' ? 'alert-bad' : ''}`}>
                <AlertTriangle size={18} strokeWidth={1.75} />
                <div>
                  <strong className="sm">{a.title}</strong>
                  <p className="sm" style={{ whiteSpace: 'pre-wrap' }}>{a.note}</p>
                  <span className="xs" style={{ opacity: 0.75 }}>{fmtDateTime(a.created_at)} — {a.created_by_name || 'الإدارة'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
