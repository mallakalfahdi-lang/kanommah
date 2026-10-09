import React, { useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, GraduationCap, BookOpenText, CalendarCheck, ClipboardList, Award,
  AlertTriangle, Wallet, FileText, BellRing, Mail, Building2, Menu, LogOut, RefreshCw,
  BookMarked, NotebookPen, ListChecks, UserCog, LineChart, X, Sparkles, ShieldCheck, Clock
} from 'lucide-react';
import { useAuth, ROLE_LABEL } from './store.jsx';
import { Avatar, PageHero } from './ui.jsx';

/* عنوان ووصف وأيقونة كل صفحة — يُستخدم في شريط الصفحة وفي شريحة المسار */
const META = {
  '/student': ['لوحتي', 'نظرة سريعة على رحلتك في الحلقة', LayoutDashboard],
  '/student/halqas': ['حلقاتي', 'التسجيل والمواعيد وروابط الحلقات', BookOpenText],
  '/student/attendance': ['الحضور والغياب', 'سجل حضورك في الحلقة والغياب والتأخير', CalendarCheck],
  '/student/grades': ['الدرجات', 'نتائجك النظرية والعملية في كل مرحلة', LineChart],
  '/student/recitation': ['ملاحظات التلاوة', 'ملاحظات معلمتك على تلاوتك وأخطائك', BookMarked],
  '/student/activities': ['الأنشطة والتقييمات', 'واجباتك وأنشطتك الحالية وتسليماتها', ClipboardList],
  '/student/appointments': ['حجز المواعيد', 'احجزي موعدًا في العيادة النظرية أو عيادة المخارج', Clock],
  '/student/rewards': ['التعزيزات', 'أوسمتك وإنجازاتك ونقاط التميز', Award],
  '/student/payments': ['الدفع', 'ارفعي إيصال الدفع لكل شهر', Wallet],
  '/student/requests': ['تقديم طلب', 'أرسلي طلبك إلى الإدارة وتابعي حالته', ListChecks],
  '/student/alerts': ['التنبيهات', 'ملاحظات إدارية تخصّ مستواك وحضورك', AlertTriangle],
  '/teacher': ['لوحة المعلمة', 'ملخّص حلقاتك وطالباتك اليوم', LayoutDashboard],
  '/teacher/halqas': ['حلقاتي', 'إدارة الحلقات والمقررات والمواعيد', BookOpenText],
  '/teacher/students': ['طالباتي', 'قائمة الطالبات في حلقاتك ومستوياتهن', Users],
  '/teacher/attendance': ['تسجيل الحضور والغياب', 'سجّلي حالة كل طالبة في الحلقة', CalendarCheck],
  '/teacher/grades': ['الدرجات', 'إضافة وإرسال درجات الطالبات', LineChart],
  '/teacher/recitation': ['ملاحظات التلاوة والأخطاء', 'دوّني ملاحظات الطالبات على التلاوة', BookMarked],
  '/teacher/activities': ['إضافة أنشطة', 'انشري واجبًا أو نشاطًا لطالبات حلقاتك', ClipboardList],
  '/teacher/appointments': ['طلبات المواعيد', 'راجعي طلبات الحجز واتخذي القرار', Clock],
  '/teacher/rewards': ['إضافة تعزيزات', 'امنحي تعزيزًا أو وسامًا للطالبة', Award],
  '/teacher/evaluations': ['تقييم الاختبارات العملية', 'سجّلي درجات الاختبار العملي والنتيجة', Sparkles],
  '/teacher/requests': ['طلبات التسجيل', 'طلبات الطالبات على حلقاتك', ListChecks],
  '/teacher/profile': ['ملفي الشخصي', 'بيانات الحساب وكلمة المرور', UserCog],
  '/manage': ['لوحة التحكم', 'مؤشرات الفروع والحلقات والأداء', LayoutDashboard],
  '/manage/students': ['ملف الطالبات', 'بيانات الطالبات وحالتهن ومستوياتهن', GraduationCap],
  '/manage/teachers': ['ملف المعلمات', 'بيانات المعلمات وتوزيعهن على الحلقات', Users],
  '/manage/halqas': ['إضافة الشعب والحلقات', 'أنشئ شعبة جديدة أو حلقة وحدّدي مواعيدها', BookOpenText],
  '/manage/grades': ['إضافة وإرسال الدرجات', 'سجّلي الدرجات وأرسليها للطالبة', LineChart],
  '/manage/appointments': ['طلبات المواعيد', 'راجعي طلبات الحجز واتخذي القرار', Clock],
  '/manage/rewards': ['التعزيزات', 'امنحي تعزيزًا وتابعي الأوسمة الممنوحة', Award],
  '/manage/alerts': ['الإنذارات والتنبيهات', 'أرسلي إشعارًا أو تنبيهًا لمجموعة', AlertTriangle],
  '/manage/requests': ['إدارة الطلبات', 'طلبات الطالبات والمعلمات وقراراتها', ListChecks],
  '/manage/evaluations': ['نتائج تقييم الحلقات', 'تقييم الطالبات لأداء الحلقات', Sparkles],
  '/manage/payments': ['إدارة الدفع', 'تأكيد إيصالات الدفع والمتأخرات', Wallet],
  '/manage/reports': ['التقارير', 'تقارير الحضور والتميز والجودة', FileText],
  '/manage/users': ['إضافة طالبات أو معلمات', 'أنشئ حسابًا جديدًا وأدِر الحسابات', UserCog],
  '/manage/branches': ['الفروع', 'إدارة فروع المنظومة ومدنها', Building2],
  '/messages': ['التواصل', 'راسلي المعلمات والإدارة والطالبات', Mail],
  '/notifications': ['الإشعارات', 'تعميمات المنظومة وتنبيهاتها', BellRing],
  '/profile': ['ملفي الشخصي', 'بيانات الحساب وكلمة المرور', UserCog]
};

const NAV = {
  student: [
    { label: 'رحلتي', items: [['/student', 'لوحتي', LayoutDashboard], ['/student/halqas', 'حلقاتي والتسجيل', BookOpenText]] },
    { label: 'التحصيل العلمي', items: [['/student/attendance', 'الحضور والغياب', CalendarCheck], ['/student/grades', 'الدرجات', LineChart], ['/student/recitation', 'ملاحظات التلاوة', BookMarked], ['/student/activities', 'الأنشطة والتقييمات', ClipboardList]] },
    { label: 'العيادات والمتابعة', items: [['/student/appointments', 'حجز المواعيد', Clock], ['/student/rewards', 'التعزيزات', Award], ['/student/alerts', 'التنبيهات', AlertTriangle]] },
    { label: 'الإجراءات', items: [['/student/payments', 'الدفع', Wallet], ['/student/requests', 'تقديم طلب', ListChecks]] },
    { label: 'التواصل', items: [['/messages', 'التواصل', Mail], ['/notifications', 'الإشعارات', BellRing], ['/profile', 'ملفي الشخصي', UserCog]] }
  ],
  teacher: [
    { label: 'الحلقة', items: [['/teacher', 'لوحة المعلمة', LayoutDashboard], ['/teacher/halqas', 'حلقاتي', BookOpenText], ['/teacher/students', 'طالباتي', Users]] },
    { label: 'المتابعة الأكاديمية', items: [['/teacher/attendance', 'تسجيل الحضور والغياب', CalendarCheck], ['/teacher/grades', 'إضافة وإرسال الدرجات', LineChart], ['/teacher/recitation', 'ملاحظات التلاوة والأخطاء', BookMarked], ['/teacher/activities', 'إضافة أنشطة', ClipboardList]] },
    { label: 'العيادات والتعزيز', items: [['/teacher/appointments', 'طلبات المواعيد', Clock], ['/teacher/rewards', 'إضافة تعزيزات', Award], ['/teacher/evaluations', 'تقييم الاختبارات العملية', Sparkles]] },
    { label: 'التواصل', items: [['/teacher/requests', 'طلبات التسجيل', ListChecks], ['/messages', 'التواصل', Mail], ['/notifications', 'الإشعارات', BellRing], ['/profile', 'ملفي الشخصي', UserCog]] }
  ],
  supervisor: [
    { label: 'المركز', items: [['/manage', 'لوحة التحكم', LayoutDashboard], ['/manage/halqas', 'إضافة الشعب والحلقات', BookOpenText], ['/manage/reports', 'التقارير', FileText]] },
    { label: 'الأشخاص', items: [['/manage/students', 'ملف الطالبات', GraduationCap], ['/manage/teachers', 'ملف المعلمات', Users], ['/manage/users', 'إضافة طالبات أو معلمات', UserCog]] },
    { label: 'العمليات', items: [['/manage/grades', 'إضافة وإرسال الدرجات', LineChart], ['/manage/evaluations', 'نتائج تقييم الحلقات', Sparkles], ['/manage/appointments', 'طلبات المواعيد', Clock], ['/manage/rewards', 'التعزيزات', Award], ['/manage/alerts', 'الإنذارات والتنبيهات', AlertTriangle], ['/manage/requests', 'إدارة الطلبات', ListChecks], ['/manage/payments', 'إدارة الدفع', Wallet]] },
    { label: 'التواصل', items: [['/messages', 'التواصل', Mail], ['/notifications', 'الإشعارات', BellRing], ['/profile', 'ملفي الشخصي', UserCog]] }
  ],
  admin: [
    { label: 'المركز', items: [['/manage', 'لوحة التحكم', LayoutDashboard], ['/manage/halqas', 'إضافة الشعب والحلقات', BookOpenText], ['/manage/reports', 'التقارير', FileText], ['/manage/branches', 'الفروع', Building2]] },
    { label: 'الأشخاص', items: [['/manage/students', 'ملف الطالبات', GraduationCap], ['/manage/teachers', 'ملف المعلمات', Users], ['/manage/users', 'إضافة طالبات أو معلمات', UserCog]] },
    { label: 'العمليات', items: [['/manage/grades', 'إضافة وإرسال الدرجات', LineChart], ['/manage/evaluations', 'نتائج تقييم الحلقات', Sparkles], ['/manage/appointments', 'طلبات المواعيد', Clock], ['/manage/rewards', 'التعزيزات', Award], ['/manage/alerts', 'الإنذارات والتنبيهات', AlertTriangle], ['/manage/requests', 'إدارة الطلبات', ListChecks], ['/manage/payments', 'إدارة الدفع', Wallet]] },
    { label: 'التواصل', items: [['/messages', 'التواصل', Mail], ['/notifications', 'الإشعارات', BellRing], ['/profile', 'ملفي الشخصي', UserCog]] }
  ]
};

const TONE = { student: 'tone-student', teacher: 'tone-teacher', supervisor: 'tone-supervisor', admin: 'tone-admin' };
const PORTAL = { student: 'بوابة الطالبة', teacher: 'بوابة المعلمة', supervisor: 'بوابة الإدارة الفرعية', admin: 'بوابة الإدارة العامة' };

export default function Shell({ children }) {
  const { user, logout, refresh, unreadMessages, unreadNotifications } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  const meta = useMemo(() => META[loc.pathname] || ['كان أمة', 'منظومة إدارة الحلقات القرآنية', ShieldCheck], [loc.pathname]);
  const groups = NAV[user?.role] || NAV.student;
  const tone = TONE[user?.role] || 'tone-student';
  const portal = PORTAL[user?.role] || 'المنظومة';

  const doLogout = async () => { await logout(); nav('/', { replace: true }); };
  const doRefresh = async () => { setBusy(true); await refresh(); setBusy(false); };

  const badge = (path) => {
    if (path === '/messages' && unreadMessages) return <span className="pill">{unreadMessages}</span>;
    if (path === '/notifications' && unreadNotifications) return <span className="pill">{unreadNotifications}</span>;
    return null;
  };

  return (
    <div className="shell">
      {open && <div className="side-backdrop" onClick={() => setOpen(false)} />}
      <aside className={`side ${open ? 'open' : ''}`}>
        <div className="side-brand">
          <span className="mark">كان</span>
          <div>
            <strong>كان أمة</strong>
            <span>منظومة الحلقات القرآنية</span>
          </div>
          <button className="icon-btn burger" style={{ color: '#fff', marginInlineStart: 'auto' }} onClick={() => setOpen(false)} aria-label="إغلاق القائمة"><X size={18} /></button>
        </div>

        <div className="side-user">
          <Avatar name={user?.name} />
          <div style={{ minWidth: 0 }}>
            <strong>{user?.name}</strong>
            <span className="sm">{ROLE_LABEL[user?.role]}{user?.branch_name ? ` — ${user.branch_name}` : ''}</span>
          </div>
        </div>

        <nav className="nav">
          {groups.map((g) => (
            <React.Fragment key={g.label}>
              <span className="nav-label">{g.label}</span>
              {g.items.map(([path, label, Icon]) => (
                <NavLink key={path} to={path} end={path === '/student' || path === '/teacher' || path === '/manage'}
                  onClick={() => setOpen(false)} className={({ isActive }) => (isActive ? 'active' : '')}>
                  <Icon size={17} strokeWidth={1.75} />
                  <span>{label}</span>
                  {badge(path)}
                </NavLink>
              ))}
            </React.Fragment>
          ))}
        </nav>

        <div className="side-foot">
          <button className="btn btn-ghost btn-sm btn-block" onClick={doLogout}><LogOut size={15} strokeWidth={1.75} /> تسجيل الخروج</button>
          <span className="side-note">كان أمة © {new Date().getFullYear()}</span>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="icon-btn burger" onClick={() => setOpen(true)} aria-label="القائمة"><Menu size={19} strokeWidth={1.75} /></button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="crumb">كان أمة — {portal}</div>
            <div className="topbar-title">{meta[0]}</div>
          </div>
          <div className="topbar-right">
            <button className="icon-btn" onClick={doRefresh} title="تحديث" aria-label="تحديث"><RefreshCw size={17} className={busy ? 'spin' : ''} strokeWidth={1.75} /></button>
            <NavLink to="/messages" className="icon-btn" title="الرسائل" aria-label="الرسائل">
              <Mail size={18} strokeWidth={1.75} />{unreadMessages ? <span className="dot-badge">{unreadMessages}</span> : null}
            </NavLink>
            <NavLink to="/notifications" className="icon-btn" title="الإشعارات" aria-label="الإشعارات">
              <BellRing size={18} strokeWidth={1.75} />{unreadNotifications ? <span className="dot-badge">{unreadNotifications}</span> : null}
            </NavLink>
          </div>
        </header>

        <main className="content fade-up">
          <PageHero icon={meta[2]} title={meta[0]} subtitle={meta[1]} tone={tone}
            chips={[portal, user?.branch_name || 'كل الفروع']} />
          {children}
        </main>
      </div>
    </div>
  );
}
