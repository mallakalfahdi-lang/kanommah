'use strict';
const { db } = require('./db');
const { hashPassword, publicUser } = require('./auth');

const DEFAULT_PASSWORDS = {
  admin: 'Admin@2026',
  supervisor: 'Super@2026',
  teacher: 'Teacher@2026',
  student: 'Student@2026'
};

function createUser({ username, name, role, email, phone, stage, branch_id, must_change_password = 0 }) {
  const password = DEFAULT_PASSWORDS[role] || 'Kan@2026';
  const { hash, salt } = hashPassword(password);
  const info = db.prepare(`INSERT INTO users(username, name, email, phone, role, password_hash, password_salt, stage, branch_id, must_change_password)
    VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(username, name, email || null, phone || null, role, hash, salt, stage || null, branch_id || null, must_change_password ? 1 : 0);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
}

function seed({ force = false } = {}) {
  const existing = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (existing > 0 && !force) return { seeded: false };

  const tx = db.transaction(() => {
    if (force) {
      for (const t of ['notification_reads', 'notifications', 'messages', 'activity_submissions', 'activities',
        'evaluations', 'alerts', 'payments', 'requests', 'rewards', 'appointments', 'recitation_notes',
        'grades', 'attendance', 'enrollments', 'halqa_sessions', 'halqas', 'sessions', 'users', 'branches']) {
        db.prepare(`DELETE FROM ${t}`).run();
      }
    }

    const branchA = db.prepare('INSERT INTO branches(name, city) VALUES (?,?)').run('فرع ضياء', 'مسقط').lastInsertRowid;
    const branchB = db.prepare('INSERT INTO branches(name, city) VALUES (?,?)').run('فرع سراج', 'صلالة').lastInsertRowid;

    const admin = createUser({ username: 'admin', name: 'أ. سارة الحارثية', role: 'admin', email: 'admin@kanomah.om', phone: '+96890000001', must_change_password: 1 });
    const supA = createUser({ username: 'supervisor1', name: 'أ. منى البلوشية', role: 'supervisor', email: 'mona@kanomah.om', phone: '+96890000002', branch_id: branchA, must_change_password: 1 });
    const supB = createUser({ username: 'supervisor2', name: 'أ. خديجة الرواحية', role: 'supervisor', email: 'khadija@kanomah.om', phone: '+96890000003', branch_id: branchB });

    const teacherNames = [
      ['teacher1', 'أ. فاطمة السالمية', branchA, 'سراج 1'],
      ['teacher2', 'أ. مريم العبرية', branchA, 'معراج 1'],
      ['teacher3', 'أ. زينب الكندية', branchA, 'ضياء 1'],
      ['teacher4', 'أ. عائشة المقبالية', branchB, 'سراج 2'],
      ['teacher5', 'أ. حفصة الشكيلية', branchB, 'معراج 3']
    ];
    const teachers = teacherNames.map(([username, name, branch_id, stage]) =>
      createUser({ username, name, role: 'teacher', branch_id, stage, email: `${username}@kanomah.om`, phone: '+9689111' + Math.floor(1000 + Math.random() * 8999) }));

    const studentNames = [
      ['student1', 'آلاء بنت سالم', 'سراج 1', branchA], ['student2', 'بشرى بنت أحمد', 'سراج 1', branchA],
      ['student3', 'تقى بنت ناصر', 'سراج 2', branchA], ['student4', 'جميلة بنت راشد', 'سراج 3', branchA],
      ['student5', 'حور بنت خالد', 'معراج 1', branchA], ['student6', 'رشا بنت يوسف', 'معراج 1', branchA],
      ['student7', 'سلمى بنت هلال', 'معراج 2', branchA], ['student8', 'شذى بنت ماجد', 'ضياء 1', branchA],
      ['student9', 'صفية بنت عمار', 'ضياء 1', branchA], ['student10', 'عائشة بنت حمود', 'سراج 2', branchB],
      ['student11', 'غالية بنت أنور', 'معراج 3', branchB], ['student12', 'فاطمة بنت سعيد', 'معراج 4', branchB]
    ];
    const students = studentNames.map(([username, name, stage, branch_id]) =>
      createUser({ username, name, role: 'student', stage, branch_id, email: `${username}@kanomah.om`, phone: '+9689222' + Math.floor(1000 + Math.random() * 8999) }));

    const halqaDefs = [
      ['حلقة سراج الأولى', teachers[0].id, branchA, 'سراج 1', 'https://meet.example.com/siraj-1'],
      ['حلقة سراج الثانية', teachers[0].id, branchA, 'سراج 2', 'https://meet.example.com/siraj-2'],
      ['حلقة معراج الأولى', teachers[1].id, branchA, 'معراج 1', 'https://meet.example.com/miraj-1'],
      ['حلقة ضياء الأولى', teachers[2].id, branchA, 'ضياء 1', 'https://meet.example.com/diyaa-1'],
      ['حلقة سراج ب-2', teachers[3].id, branchB, 'سراج 2', 'https://meet.example.com/siraj-b2'],
      ['حلقة معراج ب-3', teachers[4].id, branchB, 'معراج 3', 'https://meet.example.com/miraj-b3']
    ];
    const halqas = halqaDefs.map(([name, teacher_id, branch_id, stage, link]) => {
      const id = db.prepare('INSERT INTO halqas(name, link, branch_id, teacher_id, stage, published) VALUES (?,?,?,?,?,1)')
        .run(name, link, branch_id, teacher_id, stage).lastInsertRowid;
      db.prepare('INSERT INTO halqa_sessions(halqa_id, day, time) VALUES (?,?,?)').run(id, 'الأحد', '4:00 مساءً');
      db.prepare('INSERT INTO halqa_sessions(halqa_id, day, time) VALUES (?,?,?)').run(id, 'الثلاثاء', '4:00 مساءً');
      return { id, teacher_id, branch_id, stage };
    });

    const enroll = db.prepare('INSERT OR IGNORE INTO enrollments(halqa_id, student_id, pinned) VALUES (?,?,1)');
    const map = { 'سراج 1': [0, 1], 'سراج 2': [2, 9], 'سراج 3': [3], 'معراج 1': [4, 5], 'معراج 2': [6], 'ضياء 1': [7, 8], 'معراج 3': [10], 'معراج 4': [11] };
    for (const h of halqas) {
      for (const idx of (map[h.stage] || [])) {
        if (students[idx] && students[idx].branch_id === h.branch_id) enroll.run(h.id, students[idx].id);
      }
    }

    const today = new Date();
    const dayISO = (d) => d.toISOString().slice(0, 10);
    const statuses = ['present', 'present', 'absent', 'excused', 'late10', 'unexcused'];
    const att = db.prepare('INSERT INTO attendance(student_id, halqa_id, date, status, minutes_late, note, recorded_by) VALUES (?,?,?,?,?,?,?)');
    halqas.forEach((h) => {
      const roster = db.prepare('SELECT student_id FROM enrollments WHERE halqa_id = ?').all(h.id);
      for (let back = 0; back < 6; back++) {
        const d = new Date(today.getTime() - back * 2 * 864e5);
        roster.forEach((r, i) => {
          const st = statuses[(back + i) % statuses.length];
          att.run(r.student_id, h.id, dayISO(d), st, st === 'late10' ? 10 : 0, st === 'excused' ? 'عذر مقبول من الإدارة' : null, h.teacher_id);
        });
      }
    });

    const gr = db.prepare('INSERT INTO grades(student_id, stage, theory_score, practical_score, notes, recorded_by) VALUES (?,?,?,?,?,?)');
    students.forEach((s, i) => gr.run(s.id, s.stage, 40 + ((i * 3) % 11), 42 + ((i * 5) % 9), i % 3 === 0 ? 'تحتاج مراجعة أحكام المدود' : null, admin.id));

    const rc = db.prepare('INSERT INTO recitation_notes(student_id, surah, ayah_from, ayah_to, kind, note, recorded_by) VALUES (?,?,?,?,?,?,?)');
    const surahs = ['البقرة', 'الكهف', 'النور', 'لقمان', 'يس'];
    students.forEach((s, i) => rc.run(s.id, surahs[i % surahs.length], String(1 + i), String(10 + i), i % 2 ? 'error' : 'note', i % 2 ? 'خطأ في إخفاء الميم الساكنة' : 'أداء جيد مع ملاحظة السرعة', teachers[i % teachers.length].id));

    const ap = db.prepare('INSERT INTO appointments(student_id, clinic, date, time, status, note) VALUES (?,?,?,?,?,?)');
    students.slice(0, 6).forEach((s, i) => ap.run(s.id, CLINIC(i), dayISO(new Date(today.getTime() + (i + 1) * 864e5)), ['4:30 مساءً', '5:00 مساءً', '5:30 مساءً'][i % 3], i % 3 === 0 ? 'pending' : (i % 3 === 1 ? 'accepted' : 'rejected'), 'أرغب في مراجعة أحكام التجويد'));

    const rw = db.prepare('INSERT INTO rewards(student_id, type, title, points, note, given_by) VALUES (?,?,?,?,?,?)');
    const rtypes = ['attendance', 'academic', 'other'];
    students.forEach((s, i) => rw.run(s.id, rtypes[i % 3], ['وسام المواظبة', 'شهادة تميز', 'هدية تشجيعية'][i % 3], 5 + (i % 10), 'استمرار في التميز', teachers[i % teachers.length].id));

    const rq = db.prepare('INSERT INTO requests(user_id, type, details, status) VALUES (?,?,?,?)');
    rq.run(students[2].id, 'طلب تأجيل حضور', 'ظرف عائلي يمنعني من حضور حلقة هذا الأسبوع', 'pending');
    rq.run(students[5].id, 'طلب نقل حلقة', 'أرغب في الانتقال إلى حلقة تناسب وقتي الجديد', 'accepted');

    const pay = db.prepare('INSERT INTO payments(student_id, month, amount, status, note, checked_by) VALUES (?,?,?,?,?,?)');
    students.forEach((s, i) => pay.run(s.id, '2026-10', 25, i % 3 === 0 ? 'unpaid' : 'paid', i % 3 === 0 ? null : 'تم التحقق من الإيصال', admin.id));

    db.prepare('INSERT INTO alerts(student_id, level, title, note, created_by) VALUES (?,?,?,?,?)')
      .run(students[3].id, 'warning', 'إنذار غياب متكرر', 'تجاوزت نسبة الغياب المسموح بها (3 أيام متتالية)', supA.id);

    db.prepare('INSERT INTO notifications(audience, title, body, created_by) VALUES (?,?,?,?)')
      .run('all', 'بدء الحلقة الأسبوعية للتدبر', 'يبدأ درس التدبر الأسبوعي يوم الأحد القادم الساعة 5:00 مساءً.', admin.id);
    db.prepare('INSERT INTO notifications(audience, title, body, created_by) VALUES (?,?,?,?)')
      .run('students', 'تذكير بالدفع الشهري', 'يرجى رفع إيصال الدفع لشهر أكتوبر قبل اليوم الخامس.', supA.id);
    db.prepare('INSERT INTO notifications(audience, title, body, created_by) VALUES (?,?,?,?)')
      .run('teachers', 'تسليم نتائج الاختبارات العملية', 'الرجاء إدخال نتائج الاختبارات العملية قبل نهاية الأسبوع.', admin.id);

    const msg = db.prepare('INSERT INTO messages(from_id, audience, subject, body) VALUES (?,?,?,?)');
    msg.run(students[0].id, 'teacher', 'استفسار عن الواجب', 'هل يمكن إعادة تسليم نشاط التلاوة بعد الموعد؟');
    msg.run(teachers[0].id, 'students', 'تنبيه الحلقة', 'حلقة الغد تبدأ الساعة 4:00 مساءً، الرجاء الاستعداد.');
    msg.run(supA.id, 'admin', 'طلب صيانة', 'نحتاج تجهيزات إضافية لحلقة ضياء الأولى.');

    const act = db.prepare('INSERT INTO activities(halqa_id, title, description, kind, due_date, published, created_by) VALUES (?,?,?,?,?,1,?)');
    const actId = act.run(halqas[0].id, 'حفظ سورة الملك', 'حفظ من الآية 1 إلى 15 مع مراعاة أحكام النون الساكنة.', 'homework', dayISO(new Date(today.getTime() + 5 * 864e5)), teachers[0].id).lastInsertRowid;
    act.run(halqas[2].id, 'نشاط تدبر سورة الكهف', 'كتابة تدبر مختصر للآيات 1–10.', 'activity', dayISO(new Date(today.getTime() + 7 * 864e5)), teachers[1].id);

    db.prepare('INSERT OR IGNORE INTO activity_submissions(activity_id, student_id, note, status, grade, feedback) VALUES (?,?,?,?,?,?)')
      .run(actId, students[0].id, 'تم الحفظ كاملًا والحمد لله.', 'graded', 9.5, 'أداء ممتاز ما شاء الله.');
    db.prepare('INSERT OR IGNORE INTO activity_submissions(activity_id, student_id, note, status) VALUES (?,?,?,?)')
      .run(actId, students[1].id, 'حفظت حتى الآية 10 وأكمل الباقي قريبًا.', 'submitted');

    const ev = db.prepare('INSERT INTO evaluations(halqa_id, student_id, teacher_id, stage, theory_score, practical_score, tasmi_score, jazari_score, result, notes, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
    ev.run(halqas[0].id, null, teachers[0].id, 'سراج 1', 24, 23, 25, 22, 'ممتاز', 'التزام واضح بالحضور', supA.id);
    ev.run(halqas[2].id, null, teachers[1].id, 'معراج 1', 20, 21, 19, 18, 'جيد جدًا', 'يحتاج تحسين المخارج', supA.id);
    ev.run(halqas[3].id, null, teachers[2].id, 'ضياء 1', 22, 22, 23, 20, 'ممتاز', 'مستوى ثابت', admin.id);
  });

  tx();
  return { seeded: true };
}

function CLINIC(i) { return i % 2 === 0 ? 'theory' : 'makharij'; }

module.exports = { seed, createUser, DEFAULT_PASSWORDS, publicUser };
