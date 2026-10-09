'use strict';
/* اختبار شامل لواجهات API — التشغيل: node checks/smoke.js  (يبدأ الخادم مؤقتًا على منفذ اختبار) */
const { spawn } = require('child_process');
const path = require('path');

const PORT = 4399;
const BASE = `http://127.0.0.1:${PORT}/api`;
let passed = 0; let failed = 0;
const failures = [];

function check(name, ok, detail = '') {
  if (ok) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; failures.push(`${name} — ${detail}`); console.log(`  ❌ ${name} — ${detail}`); }
}

async function api(pathname, { method = 'GET', token, body } = {}) {
  const res = await fetch(BASE + pathname, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}

async function login(username, password) {
  return api('/auth/login', { method: 'POST', body: { username, password } });
}

async function run() {
  console.log('\n— المصادقة والصلاحيات —');
  const bad = await login('admin', 'wrong-password');
  check('رفض كلمة مرور خاطئة', bad.status === 401, `status=${bad.status}`);

  const admin = await login('admin', 'Admin@2026');
  check('دخول الإدارة العامة', admin.status === 200 && admin.data.user.role === 'admin');
  const sup = await login('supervisor1', 'Super@2026');
  check('دخول المشرفة', sup.status === 200 && sup.data.user.role === 'supervisor');
  const teacher = await login('teacher1', 'Teacher@2026');
  check('دخول المعلمة', teacher.status === 200 && teacher.data.user.role === 'teacher');
  const student = await login('student1', 'Student@2026');
  check('دخول الطالبة', student.status === 200 && student.data.user.role === 'student');
  if (admin.status !== 200 || student.status !== 200 || teacher.status !== 200 || sup.status !== 200) return;

  const aT = admin.data.token; const sT = sup.data.token; const tT = teacher.data.token; const stT = student.data.token;

  check('منع الوصول بدون جلسة', (await api('/student/overview')).status === 401);
  check('منع الطالبة من لوحة الإدارة (403)', (await api('/admin/dashboard', { token: stT })).status === 403);
  check('منع المعلمة من واجهة الطالبة (403)', (await api('/student/overview', { token: tT })).status === 403);

  console.log('\n— البيانات المشتركة —');
  const boot = await api('/common/bootstrap', { token: stT });
  check('بيانات التهيئة للطالبة', boot.status === 200 && boot.data.user.role === 'student' && Array.isArray(boot.data.meta.stages));
  const notifs = await api('/common/notifications', { token: stT });
  check('إشعارات الطالبة', notifs.status === 200 && Array.isArray(notifs.data) && notifs.data.length > 0);
  check('قائمة الحلقات للطالبة', (await api('/common/halqas', { token: stT })).status === 200);

  console.log('\n— وحدة الطالبة —');
  const ov = await api('/student/overview', { token: stT });
  check('ملخص الطالبة', ov.status === 200 && ov.data.attendance && typeof ov.data.attendance.rate === 'number');
  const att = await api('/student/attendance', { token: stT });
  check('سجل الحضور والغياب', att.status === 200 && Array.isArray(att.data) && !!att.data[0].status_label);
  const gr = await api('/student/grades', { token: stT });
  check('الدرجات مع المجموع', gr.status === 200 && Array.isArray(gr.data) && typeof gr.data[0].total === 'number');
  check('ملاحظات التلاوة', (await api('/student/recitation', { token: stT })).status === 200);
  const rw = await api('/student/rewards', { token: stT });
  check('التعزيزات', rw.status === 200 && Array.isArray(rw.data.items));
  check('التنبيهات', (await api('/student/alerts', { token: stT })).status === 200);

  const future = new Date(Date.now() + 12 * 864e5).toISOString().slice(0, 10);
  const appt = await api('/student/appointments', { method: 'POST', token: stT, body: { clinic: 'theory', date: future, time: '7:00 مساءً', note: 'اختبار' } });
  check('حجز موعد جديد', appt.status === 201, JSON.stringify(appt.data));
  check('منع تكرار نفس الموعد', (await api('/student/appointments', { method: 'POST', token: stT, body: { clinic: 'theory', date: future, time: '7:00 مساءً' } })).status === 409);
  check('منع حجز موعد في الماضي', (await api('/student/appointments', { method: 'POST', token: stT, body: { clinic: 'theory', date: '2020-01-01', time: '5:00 م' } })).status === 400);
  check('التحقق من حقل العيادة', (await api('/student/appointments', { method: 'POST', token: stT, body: { clinic: 'x', date: future, time: '1:00' } })).status === 400);

  check('تقديم طلب', (await api('/student/requests', { method: 'POST', token: stT, body: { type: 'طلب اختبار', details: 'طلب تجريبي للاختبار الآلي' } })).status === 201);
  check('رفض طلب بدون تفاصيل', (await api('/student/requests', { method: 'POST', token: stT, body: { type: 'طلب', details: 'ب' } })).status === 400);

  const receipt = 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4 test receipt').toString('base64');
  check('رفع إيصال الدفع', (await api('/student/payments', { method: 'POST', token: stT, body: { month: '2026-11', amount: 25, receipt, note: 'إيصال اختبار' } })).status === 201);
  check('رفض صيغة شهر غير صحيحة', (await api('/student/payments', { method: 'POST', token: stT, body: { month: 'نوفمبر' } })).status === 400);

  const act = await api('/student/activities', { token: stT });
  check('الأنشطة والواجبات للطالبة', act.status === 200 && Array.isArray(act.data), `len=${act.data ? act.data.length : 'n/a'}`);
  if (act.data && act.data.length) {
    check('تسليم نشاط', (await api(`/student/activities/${act.data[0].id}/submit`, { method: 'POST', token: stT, body: { note: 'تم الحل' } })).status === 201);
  }

  console.log('\n— وحدة المعلمة —');
  const tov = await api('/teacher/overview', { token: tT });
  check('ملخص المعلمة', tov.status === 200 && Array.isArray(tov.data.halqas) && tov.data.halqas.length > 0);
  const halqaId = tov.data.halqas[0].id;
  const roster = await api(`/teacher/halqas/${halqaId}/students`, { token: tT });
  check('طالبات الحلقة', roster.status === 200 && Array.isArray(roster.data));
  const today = new Date().toISOString().slice(0, 10);
  const attSheet = await api(`/teacher/attendance?halqa_id=${halqaId}&date=${today}`, { token: tT });
  check('كشف تسجيل الحضور', attSheet.status === 200 && Array.isArray(attSheet.data.students));
  const rec = attSheet.data.students.map((s, i) => ({ student_id: s.student_id, status: ['present', 'absent', 'excused', 'late10'][i % 4], note: 'اختبار آلي' }));
  const saveAtt = await api('/teacher/attendance', { method: 'POST', token: tT, body: { halqa_id: halqaId, date: today, records: rec } });
  check('تسجيل الحضور والغياب', saveAtt.status === 200 && saveAtt.data.count === rec.length, JSON.stringify(saveAtt.data));
  const reAtt = await api(`/teacher/attendance?halqa_id=${halqaId}&date=${today}`, { token: tT });
  check('استمرارية بيانات الحضور', reAtt.data.marked === true && reAtt.data.students[0].status === 'present');
  check('منع الوصول لحلقة ليست للمعلمة', (await api('/teacher/halqas/999/students', { token: tT })).status === 404);

  const sid = roster.data[0] ? roster.data[0].id : null;
  if (sid) {
    check('تسجيل ملاحظة تلاوة/خطأ', (await api('/teacher/recitation', { method: 'POST', token: tT, body: { student_id: sid, surah: 'الملك', ayah_from: '1', ayah_to: '10', kind: 'error', note: 'اختبار ملاحظة خطأ' } })).status === 201);
    check('إضافة تعزيز', (await api('/teacher/rewards', { method: 'POST', token: tT, body: { student_id: sid, type: 'academic', title: 'تميز', points: 5 } })).status === 201);
  }
  const ev = await api('/teacher/evaluations', { method: 'POST', token: tT, body: { halqa_id: halqaId, student_id: sid, theory_score: 22, practical_score: 23, tasmi_score: 24, jazari_score: 20, notes: 'اختبار آلي' } });
  check('تقييم الاختبار العملي', ev.status === 201 && ev.data.total === 89, JSON.stringify(ev.data));
  check('رفض درجة خارج النطاق', (await api('/teacher/evaluations', { method: 'POST', token: tT, body: { halqa_id: halqaId, theory_score: 90 } })).status === 400);

  const tGrades = await api('/teacher/grades', { token: tT });
  check('إضافة وإرسال الدرجات (المعلمة)', tGrades.status === 200 && Array.isArray(tGrades.data));
  const tGradesPost = await api('/teacher/grades', { method: 'POST', token: tT, body: { records: [{ student_id: sid, theory_score: 44, practical_score: 46, notes: 'اختبار آلي' }], max_theory: 50, max_practical: 50 } });
  check('حفظ درجات المعلمة', tGradesPost.status === 201 && tGradesPost.data.count === 1, JSON.stringify(tGradesPost.data));
  const tGradesBad = await api('/teacher/grades', { method: 'POST', token: tT, body: { records: [{ student_id: sid, theory_score: 500 }] } });
  check('رفض درجة المعلمة خارج النطاق', tGradesBad.status === 400, JSON.stringify(tGradesBad.data));
  const tReq = await api('/teacher/requests', { token: tT });
  check('طلبات الطالبات لدى المعلمة', tReq.status === 200 && Array.isArray(tReq.data));


  const newAct = await api('/teacher/activities', { method: 'POST', token: tT, body: { halqa_id: halqaId, title: 'واجب اختباري', description: 'وصف', due_date: future, published: 1 } });
  check('نشر نشاط/واجب', newAct.status === 201, JSON.stringify(newAct.data));
  const subs = await api(`/teacher/activities/${newAct.data.id}/submissions`, { token: tT });
  check('كشف متابعة التسليمات', subs.status === 200 && Array.isArray(subs.data.students));
  const tAppts = await api('/teacher/appointments', { token: tT });
  check('طلبات المواعيد للمعلمة', tAppts.status === 200 && Array.isArray(tAppts.data));
  if (tAppts.data.length) check('قبول/رفض طلب موعد', (await api(`/teacher/appointments/${tAppts.data[0].id}`, { method: 'PATCH', token: tT, body: { status: 'accepted', note: 'تم القبول' } })).status === 200);
  check('إضافة طالبة للحلقة', [201, 409].includes((await api(`/teacher/halqas/${halqaId}/students`, { method: 'POST', token: tT, body: { username: 'student7' } })).status));
  check('رفض إضافة مستخدم غير موجود', (await api(`/teacher/halqas/${halqaId}/students`, { method: 'POST', token: tT, body: { username: 'no-such-user' } })).status === 404);

  console.log('\n— وحدة المشرفة والإدارة —');
  const dash = await api('/admin/dashboard', { token: aT });
  check('لوحة الإدارة العامة', dash.status === 200 && dash.data.students > 0);
  const supDash = await api('/supervisor/dashboard', { token: sT });
  check('لوحة المشرفة (مقيّدة بالفرع)', supDash.status === 200 && supDash.data.scope_branch === sup.data.user.branch_id, `scope=${supDash.data.scope_branch}`);
  check('المشرفة ترى فرعًا واحدًا فقط', supDash.data.students <= dash.data.students, `sup=${supDash.data.students} admin=${dash.data.students}`);

  const users = await api('/admin/users?role=student', { token: aT });
  check('قائمة المستخدمين', users.status === 200 && users.data.length >= 12);
  const created = await api('/admin/users', { method: 'POST', token: aT, body: { name: 'طالبة اختبار', username: 'teststudent' + (Date.now() % 10000), role: 'student', stage: 'سراج 1' } });
  check('إضافة طالبة جديدة', created.status === 201 && !!created.data.default_password, JSON.stringify(created.data));
  check('رفض اسم مستخدم مكرر', (await api('/admin/users', { method: 'POST', token: aT, body: { name: 'مكرر', username: 'admin', role: 'teacher' } })).status === 409);
  check('منع المشرفة من إنشاء مدير', (await api('/supervisor/users', { method: 'POST', token: sT, body: { name: 'مدير', username: 'boss' + (Date.now() % 999), role: 'admin' } })).status === 403);

  const newIds = users.data.slice(0, 3).map((u) => u.id);
  const addGrades = await api('/admin/grades', { method: 'POST', token: aT, body: { records: newIds.map((id, i) => ({ student_id: id, stage: 'سراج 1', theory_score: 45 - i, practical_score: 47 - i, notes: 'اختبار آلي' })) } });
  check('إضافة وإرسال الدرجات', addGrades.status === 201 && addGrades.data.count === 3, JSON.stringify(addGrades.data));
  check('رفض درجة أعلى من النهاية العظمى', (await api('/admin/grades', { method: 'POST', token: aT, body: { records: [{ student_id: newIds[0], theory_score: 200 }] } })).status === 400);
  const gradeList = await api('/admin/grades', { token: aT });
  check('كشف الدرجات', gradeList.status === 200 && gradeList.data.length > 0 && typeof gradeList.data[0].total === 'number');

  const halqaCreate = await api('/admin/halqas', { method: 'POST', token: aT, body: { name: 'حلقة اختبارية', stage: 'سراج 2', teacher_id: teacher.data.user.id, link: 'https://meet.example.com/test', sessions: [{ day: 'الأحد', time: '6:00 مساءً' }] } });
  check('إضافة حلقة', halqaCreate.status === 201, JSON.stringify(halqaCreate.data));
  check('تعديل حلقة (رابط ومواعيد)', (await api(`/admin/halqas/${halqaCreate.data.id}`, { method: 'PATCH', token: aT, body: { link: 'https://meet.example.com/updated', sessions: [{ day: 'الإثنين', time: '5:00 مساءً' }] } })).status === 200);
  check('إضافة شعبة ونشرها', (await api('/supervisor/sections', { method: 'POST', token: sT, body: { name: 'شعبة اختبارية', stage: 'معراج 2', sessions: [{ day: 'الثلاثاء', time: '4:30 مساءً' }], published: 1 } })).status === 201);
  check('رفض شعبة بدون مواعيد', (await api('/supervisor/sections', { method: 'POST', token: sT, body: { name: 'شعبة بلا مواعيد' } })).status === 400);
  check('حذف (إيقاف) حلقة', (await api(`/admin/halqas/${halqaCreate.data.id}`, { method: 'DELETE', token: aT })).status === 200);

  const allAppts = await api('/admin/appointments', { token: aT });
  check('طلبات المواعيد للإدارة', allAppts.status === 200 && allAppts.data.length > 0);
  check('قبول طلب موعد في الإدارة', (await api(`/admin/appointments/${allAppts.data[0].id}`, { method: 'PATCH', token: aT, body: { status: 'accepted', note: 'تمت الموافقة' } })).status === 200);
  check('إضافة تعزيز من الإدارة', (await api('/admin/rewards', { method: 'POST', token: aT, body: { student_id: newIds[0], type: 'attendance', points: 3 } })).status === 201);
  check('إرسال إنذار/تنبيه', (await api('/supervisor/alerts', { method: 'POST', token: sT, body: { student_id: newIds[0], level: 'warning', title: 'تنبيه اختباري', note: 'ملاحظة' } })).status === 201);

  const reqList = await api('/admin/requests?status=pending', { token: aT });
  check('إدارة الطلبات', reqList.status === 200 && Array.isArray(reqList.data));
  if (reqList.data.length) check('قبول طلب', (await api(`/admin/requests/${reqList.data[0].id}`, { method: 'PATCH', token: aT, body: { status: 'accepted' } })).status === 200);

  const payList = await api('/admin/payments', { token: aT });
  check('إدارة الدفع', payList.status === 200 && payList.data.length > 0);
  check('تحديث حالة الدفع', (await api(`/admin/payments/${payList.data[0].id}`, { method: 'PATCH', token: aT, body: { status: 'paid', note: 'تم التحقق' } })).status === 200);
  check('توليد سجلات دفع شهرية', (await api('/admin/payments/generate', { method: 'POST', token: aT, body: { month: '2030-01', amount: 25 } })).status === 201);

  const evList = await api('/admin/evaluations', { token: aT });
  check('نتائج تقييم الحلقات', evList.status === 200 && Array.isArray(evList.data));
  check('تسجيل نتيجة تقييم', (await api('/admin/evaluations', { method: 'POST', token: aT, body: { halqa_id: halqaId, theory_score: 20, practical_score: 21, tasmi_score: 22, jazari_score: 19, result: 'جيد جدًا', notes: 'اختبار آلي' } })).status === 201);

  check('إرسال إشعار للطالبات', (await api('/common/notifications', { method: 'POST', token: aT, body: { audience: 'students', title: 'إشعار اختباري', body: 'نص الإشعار' } })).status === 201);
  check('التواصل: إرسال تعميم', (await api('/common/messages', { method: 'POST', token: aT, body: { audience: 'all', subject: 'تعميم', body: 'تعميم اختباري' } })).status === 201);
  check('رفض جهة تواصل غير صحيحة', (await api('/common/messages', { method: 'POST', token: aT, body: { audience: 'nobody', body: 'x' } })).status === 400);
  const summary = await api('/admin/reports/summary', { token: aT });
  check('تقارير وملخصات', summary.status === 200 && Array.isArray(summary.data.attendance) && Array.isArray(summary.data.payments));

  const settingsGet = await api('/common/settings', { token: aT });
  check('قراءة الإعدادات', settingsGet.status === 200 && !!settingsGet.data.tadabbur_lesson);
  check('تحديث الإعدادات (موعد التدبر/الدفع)', (await api('/common/settings', { method: 'PUT', token: aT, body: { tadabbur_lesson: 'كل يوم أحد — 5:30 مساءً' } })).status === 200);
  check('منع الطالبة من تعديل الإعدادات', (await api('/common/settings', { method: 'PUT', token: stT, body: { org_name: 'x' } })).status === 403);

  check('رفض كلمة مرور حالية خاطئة', (await api('/auth/password', { method: 'POST', token: stT, body: { current: 'wrong', next: 'NewPass@2026' } })).status === 400);
  check('رفض كلمة مرور قصيرة', (await api('/auth/password', { method: 'POST', token: stT, body: { current: 'Student@2026', next: '123' } })).status === 400);
  check('تغيير كلمة المرور', (await api('/auth/password', { method: 'POST', token: stT, body: { current: 'Student@2026', next: 'Student@2026' } })).status === 200);

  check('تسجيل الخروج', (await api('/auth/logout', { method: 'POST', token: stT })).status === 200);
  check('انتهاء الجلسة بعد الخروج', (await api('/student/overview', { token: stT })).status === 401);
  check('استجابة 404 للمسارات غير الموجودة', (await api('/no-such-route', { token: aT })).status === 404);

  console.log(`\nالنتيجة: ${passed} ناجح، ${failed} فاشل من أصل ${passed + failed} اختبار.`);
  if (failures.length) console.log('الإخفاقات:\n - ' + failures.join('\n - '));
}

// قاعدة بيانات مؤقتة معزولة لكل تشغيل حتى تكون الاختبارات قابلة للتكرار
const os = require('os');
const fs = require('fs');
const TEST_DATA = path.join(os.tmpdir(), 'kan-ummah-test-data');
fs.rmSync(TEST_DATA, { recursive: true, force: true });

const server = spawn('node', [path.join(__dirname, '..', 'index.js')], {
  env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', KAN_DATA_DIR: TEST_DATA },
  stdio: ['ignore', 'inherit', 'inherit']
});

(async () => {
  await new Promise((r) => setTimeout(r, 2500));
  try { await run(); } catch (e) { console.error('فشل تشغيل الاختبارات:', e.message); failed++; }
  server.kill('SIGTERM');
  setTimeout(() => process.exit(failed ? 1 : 0), 500);
})();
