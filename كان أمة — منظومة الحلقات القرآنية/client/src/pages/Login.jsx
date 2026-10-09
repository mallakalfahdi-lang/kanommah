import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GraduationCap, BookOpenText, Building2, ShieldCheck, Sparkles, LogIn, KeyRound,
  Loader2, AlertTriangle, UserCog, Lock, User
} from 'lucide-react';
import { useAuth, ROLE_HOME, ROLE_LABEL } from '../store.jsx';
import { useToast } from '../toast.jsx';
import { api } from '../api.js';
import { Field } from '../ui.jsx';

/* بوابات المنظومة الأربع — الدخول موحّد ويُوجَّه كل مستخدم حسب صلاحيته الفعلية */
const PORTALS = [
  { key: 'student', label: 'بوابة الطالبة', desc: 'الحلقة · الحضور · الدرجات · العيادات', icon: GraduationCap, u: 'student1', p: 'Student@2026' },
  { key: 'teacher', label: 'بوابة المعلمة', desc: 'التحضير · الدرجات · الأنشطة · التعزيز', icon: BookOpenText, u: 'teacher1', p: 'Teacher@2026' },
  { key: 'supervisor', label: 'الإدارة الفرعية', desc: 'حلقات الفرع · الطالبات · التقارير', icon: Building2, u: 'supervisor1', p: 'Super@2026' },
  { key: 'admin', label: 'الإدارة العامة', desc: 'كل الفروع · الحلقات · المدفوعات · الصلاحيات', icon: ShieldCheck, u: 'admin', p: 'Admin@2026' }
];

export default function Login() {
  const { login, user, refresh } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [portal, setPortal] = useState('student');
  const [form, setForm] = useState({ username: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mustChange, setMustChange] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const active = PORTALS.find((x) => x.key === portal) || PORTALS[0];
  const ActiveIcon = active.icon;

  const pick = (p) => { setPortal(p.key); setForm({ username: p.u, password: p.p }); setError(''); setNotice(''); };

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setNotice(''); setBusy(true);
    try {
      const u = await login(form.username.trim(), form.password);
      toast.ok(`أهلًا بك ${u.name}`);
      if (u.role !== portal) {
        setNotice(`تم التحقق من صلاحيتك: ${ROLE_LABEL[u.role]} — سيتم توجيهك إلى ${ROLE_HOME[u.role] === '/manage' ? 'لوحة الإدارة' : 'لوحتك'} المناسبة.`);
      }
      if (u.must_change_password) {
        setMustChange(true);
        toast.info('لأمان حسابك، يُرجى تغيير كلمة المرور الافتراضية.');
        return;
      }
      nav(ROLE_HOME[u.role] || '/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (pw.next !== pw.confirm) { setError('كلمتا المرور الجديدتان غير متطابقتين.'); return; }
    if (pw.next.length < 8) { setError('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.'); return; }
    setBusy(true); setError('');
    try {
      await api.post('auth/password', { current: pw.current, next: pw.next });
      await refresh();
      toast.ok('تم تحديث كلمة المرور بنجاح.');
      nav(ROLE_HOME[(user && user.role) || 'student'] || '/', { replace: true });
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="login-wrap">
      <div className="login-art">
        <div className="brandline">
          <span className="mark">كان</span>
          <div>
            <strong>كان أمة</strong>
            <div className="sm" style={{ opacity: 0.75 }}>منظومة إدارة الحلقات القرآنية</div>
          </div>
        </div>

        <div className="login-hero">
          <h2>منصّة متكاملة لإدارة حلقات القرآن الكريم<br />للطالبات والمعلمات والإدارة</h2>
          <p className="ayah">﴿ كُنتُمْ خَيْرَ أُمَّةٍ أُخْرِجَتْ لِلنَّاسِ ﴾</p>
          <div className="login-feats">
            <div className="login-feat"><span className="ic"><BookOpenText size={16} strokeWidth={1.75} /></span><span>الحلقات والمواعيد والمقررات وروابط البث في مكان واحد.</span></div>
            <div className="login-feat"><span className="ic"><GraduationCap size={16} strokeWidth={1.75} /></span><span>الحضور والتسميع والدرجات والتقييم العملي بمسارات واضحة.</span></div>
            <div className="login-feat"><span className="ic"><Sparkles size={16} strokeWidth={1.75} /></span><span>أنشطة وتدبّر وتعزيز تحفيزي ومتابعة للعيادات النظرية والمخارج.</span></div>
            <div className="login-feat"><span className="ic"><ShieldCheck size={16} strokeWidth={1.75} /></span><span>صلاحيات دقيقة: إدارة عامة، إدارة فرعية، معلمة، وطالبة.</span></div>
          </div>
        </div>

        <div>
          <div className="sm" style={{ opacity: 0.8, marginBottom: 8 }}>اختاري البوابة للدخول السريع (تجريبيًا):</div>
          <div className="login-roles">
            {PORTALS.map((p) => {
              const Icon = p.icon;
              return (
                <button key={p.key} type="button" className={`login-role ${portal === p.key ? 'is-active' : ''}`} onClick={() => pick(p)}>
                  <Icon className="lr-ico" size={19} strokeWidth={1.75} />
                  <strong>{p.label}</strong>
                  <span>{p.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        <span className="foot-note">© {new Date().getFullYear()} كان أمة — جميع الحقوق محفوظة</span>
      </div>

      <div className="login-form-side">
        <div className="login-card">
          <div className="inline" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
            <h1>{mustChange ? 'تغيير كلمة المرور' : 'تسجيل الدخول'}</h1>
            <span className="badge badge-gold"><ActiveIcon size={13} strokeWidth={1.75} /> {active.label}</span>
          </div>
          <p className="muted sm" style={{ marginBottom: 16 }}>
            {mustChange
              ? 'كلمة المرور الافتراضية يجب تغييرها عند أول دخول.'
              : 'صفحة دخول موحّدة لجميع الأدوار — يتعرّف النظام على هويتك وصلاحياتك ويوجّهك إلى لوحتك.'}
          </p>

          {error && <div className="alert alert-bad" style={{ marginBottom: 13 }}><AlertTriangle size={17} strokeWidth={1.75} /><span>{error}</span></div>}
          {notice && <div className="alert alert-ok" style={{ marginBottom: 13 }}><ShieldCheck size={17} strokeWidth={1.75} /><span>{notice}</span></div>}

          {!mustChange ? (
            <form onSubmit={submit} className="form-stack">
              <Field label="اسم المستخدم" required>
                <div className="input-ico">
                  <User size={16} strokeWidth={1.75} />
                  <input type="text" value={form.username} onChange={set('username')} placeholder="اسم المستخدم أو رقم المستخدم" autoComplete="username" required />
                </div>
              </Field>
              <Field label="كلمة المرور" required>
                <div className="input-ico">
                  <Lock size={16} strokeWidth={1.75} />
                  <input type="password" value={form.password} onChange={set('password')} placeholder="••••••••" autoComplete="current-password" required />
                </div>
              </Field>
              <button className="btn btn-block" type="submit" disabled={busy}>
                {busy ? <Loader2 size={17} className="spin" /> : <LogIn size={17} strokeWidth={1.75} />} دخول إلى {active.label}
              </button>
              <span className="muted xs" style={{ textAlign: 'center' }}>
                يتم التحقق من اسم المستخدم وكلمة المرور ثم توجيهك تلقائيًا حسب صلاحيتك المسجّلة.
              </span>
            </form>
          ) : (
            <form onSubmit={changePassword} className="form-stack">
              <Field label="كلمة المرور الحالية" required>
                <div className="input-ico">
                  <Lock size={16} strokeWidth={1.75} />
                  <input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required />
                </div>
              </Field>
              <Field label="كلمة المرور الجديدة" hint="8 أحرف على الأقل" required>
                <div className="input-ico">
                  <KeyRound size={16} strokeWidth={1.75} />
                  <input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required />
                </div>
              </Field>
              <Field label="تأكيد كلمة المرور" required>
                <div className="input-ico">
                  <KeyRound size={16} strokeWidth={1.75} />
                  <input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required />
                </div>
              </Field>
              <button className="btn btn-block" type="submit" disabled={busy}>
                {busy ? <Loader2 size={17} className="spin" /> : <KeyRound size={17} strokeWidth={1.75} />} حفظ ومتابعة إلى لوحتي
              </button>
            </form>
          )}

          {!mustChange && (
            <div className="login-hint" style={{ marginTop: 16 }}>
              <strong><UserCog size={14} strokeWidth={1.75} /> حسابات تجريبية</strong> — اضغطي على الحساب لملء البيانات:
              <div className="chips">
                {PORTALS.map((d) => (
                  <button key={d.u} type="button" className="chip" onClick={() => pick(d)}>
                    {d.label} <span className="muted">({d.u})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="muted xs" style={{ marginTop: 14, textAlign: 'center' }}>
            هل فقدتِ كلمة المرور؟ تواصلي مع الإدارة لإعادة تعيينها.
          </p>
        </div>
      </div>
    </div>
  );
}
