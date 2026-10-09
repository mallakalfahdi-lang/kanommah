'use strict';
const express = require('express');
const { db, ATTENDANCE_STATUS, REWARD_TYPES, CLINICS, STAGES } = require('../db');
const { requireRole } = require('../auth');
const { h, saveBase64, scoreTotal } = require('../utils');

const router = express.Router();
router.use(requireRole('teacher'));

const myHalqas = (userId) => db.prepare('SELECT id, name FROM halqas WHERE teacher_id = ?').all(userId).map((r) => r.id);
function assertHalqa(req, halqaId) {
  const row = db.prepare('SELECT * FROM halqas WHERE id = ?').get(halqaId);
  if (!row) throw Object.assign(new Error('الحلقة غير موجودة.'), { status: 404 });
  if (row.teacher_id !== req.user.id) throw Object.assign(new Error('هذه الحلقة ليست ضمن حلقاتك.'), { status: 403 });
  return row;
}

router.get('/overview', h((req, res) => {
  const ids = myHalqas(req.user.id);
  const ph = ids.length ? ids.map(() => '?').join(',') : 'NULL';
  const students = db.prepare(`SELECT u.id, u.name, u.username, u.stage FROM enrollments e JOIN users u ON u.id = e.student_id
    WHERE e.halqa_id IN (${ph}) ORDER BY u.name`).all(...ids);
  const halqas = db.prepare(`SELECT h.*, b.name AS branch_name,
      (SELECT COUNT(*) FROM enrollments e WHERE e.halqa_id = h.id) AS students_count,
      (SELECT group_concat(s.day || ' ' || s.time, ' | ') FROM halqa_sessions s WHERE s.halqa_id = h.id) AS schedule
    FROM halqas h LEFT JOIN branches b ON b.id = h.branch_id WHERE h.teacher_id = ?`).all(req.user.id);
  const today = new Date().toISOString().slice(0, 10);
  const todayMarked = ids.length ? db.prepare(`SELECT COUNT(*) AS c FROM attendance WHERE halqa_id IN (${ph}) AND date = ?`)
    .get(...ids, today).c : 0;
  const pendingAppointments = db.prepare(`SELECT COUNT(*) AS c FROM appointments a WHERE a.status = 'pending' AND a.student_id IN
    (SELECT student_id FROM enrollments WHERE halqa_id IN (${ph}))`).get(...ids).c;
  const submissions = ids.length ? db.prepare(`SELECT COUNT(*) AS c FROM activity_submissions s JOIN activities a ON a.id = s.activity_id
    WHERE a.halqa_id IN (${ph}) AND s.status = 'submitted'`).get(...ids).c : 0;
  res.json({ halqas, students_count: students.length, students, today_marked: todayMarked, today, pending_appointments: pendingAppointments, pending_submissions: submissions });
}));

router.get('/halqas', h((req, res) => {
  const rows = db.prepare(`SELECT h.*, b.name AS branch_name,
      (SELECT COUNT(*) FROM enrollments e WHERE e.halqa_id = h.id) AS students_count,
      (SELECT group_concat(s.day || ' ' || s.time, ' | ') FROM halqa_sessions s WHERE s.halqa_id = h.id) AS schedule
    FROM halqas h LEFT JOIN branches b ON b.id = h.branch_id WHERE h.teacher_id = ? ORDER BY h.name`).all(req.user.id);
  res.json(rows);
}));

router.get('/halqas/:id/students', h((req, res) => {
  assertHalqa(req, req.params.id);
  res.json(db.prepare(`SELECT u.id, u.name, u.username, u.stage, u.email, u.phone, e.pinned, e.created_at AS joined_at
    FROM enrollments e JOIN users u ON u.id = e.student_id WHERE e.halqa_id = ? ORDER BY e.pinned DESC, u.name`).all(req.params.id));
}));

router.post('/halqas/:id/students', h((req, res) => {
  assertHalqa(req, req.params.id);
  const { username, student_id } = req.body || {};
  let student = null;
  if (student_id) student = db.prepare(`SELECT * FROM users WHERE id = ? AND role = 'student'`).get(student_id);
  else if (username) student = db.prepare(`SELECT * FROM users WHERE lower(username) = lower(?) AND role = 'student'`).get(String(username).trim());
  if (!student) return res.status(404).json({ error: 'لا توجد طالبة بهذا الرقم أو اسم المستخدم.' });
  const exists = db.prepare('SELECT id FROM enrollments WHERE halqa_id = ? AND student_id = ?').get(req.params.id, student.id);
  if (exists) return res.status(409).json({ error: 'الطالبة مضافة مسبقًا في هذه الحلقة.' });
  db.prepare('INSERT INTO enrollments(halqa_id, student_id) VALUES (?,?)').run(req.params.id, student.id);
  res.status(201).json({ ok: true, message: `تمت إضافة ${student.name} إلى الحلقة.` });
}));

router.delete('/halqas/:id/students/:studentId', h((req, res) => {
  assertHalqa(req, req.params.id);
  const info = db.prepare('DELETE FROM enrollments WHERE halqa_id = ? AND student_id = ?').run(req.params.id, req.params.studentId);
  if (!info.changes) return res.status(404).json({ error: 'الطالبة غير موجودة في هذه الحلقة.' });
  res.json({ ok: true, message: 'تم حذف الطالبة من الحلقة.' });
}));

router.patch('/halqas/:id/students/:studentId', h((req, res) => {
  assertHalqa(req, req.params.id);
  const pinned = req.body && req.body.pinned ? 1 : 0;
  const info = db.prepare('UPDATE enrollments SET pinned = ? WHERE halqa_id = ? AND student_id = ?').run(pinned, req.params.id, req.params.studentId);
  if (!info.changes) return res.status(404).json({ error: 'الطالبة غير موجودة في هذه الحلقة.' });
  res.json({ ok: true, message: pinned ? 'تم تثبيت الطالبة في الحلقة.' : 'تم إلغاء التثبيت.' });
}));

router.get('/attendance', h((req, res) => {
  const halqaId = Number(req.query.halqa_id);
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  if (!halqaId) return res.status(400).json({ error: 'الرجاء اختيار الحلقة.' });
  assertHalqa(req, halqaId);
  const roster = db.prepare(`SELECT u.id AS student_id, u.name, u.username, u.stage FROM enrollments e
    JOIN users u ON u.id = e.student_id WHERE e.halqa_id = ? ORDER BY u.name`).all(halqaId);
  const saved = db.prepare('SELECT * FROM attendance WHERE halqa_id = ? AND date = ?').all(halqaId, date);
  const map = {};
  saved.forEach((s) => { map[s.student_id] = s; });
  res.json({
    date, halqa_id: halqaId,
    students: roster.map((s) => ({
      ...s,
      status: map[s.student_id] ? map[s.student_id].status : null,
      status_label: map[s.student_id] ? ATTENDANCE_STATUS[map[s.student_id].status] : null,
      note: map[s.student_id] ? map[s.student_id].note : '',
      minutes_late: map[s.student_id] ? map[s.student_id].minutes_late : 0
    })),
    statuses: Object.keys(ATTENDANCE_STATUS).map((k) => ({ value: k, label: ATTENDANCE_STATUS[k] })),
    marked: saved.length > 0
  });
}));

router.post('/attendance', h((req, res) => {
  const { halqa_id, date, records } = req.body || {};
  if (!halqa_id || !date) return res.status(400).json({ error: 'الرجاء تحديد الحلقة والتاريخ.' });
  assertHalqa(req, halqa_id);
  if (!Array.isArray(records) || !records.length) return res.status(400).json({ error: 'لا توجد بيانات حضور لتسجيلها.' });
  const insert = db.prepare(`INSERT INTO attendance(student_id, halqa_id, date, status, minutes_late, note, recorded_by)
    VALUES (?,?,?,?,?,?,?)`);
  const tx = db.transaction(() => {
    for (const r of records) {
      const status = ATTENDANCE_STATUS[r.status] ? r.status : 'present';
      const minutes = status === 'late10' ? (Number(r.minutes_late) || 10) : 0;
      const existing = db.prepare('SELECT id FROM attendance WHERE student_id = ? AND halqa_id = ? AND date = ?')
        .get(r.student_id, halqa_id, date);
      if (existing) {
        db.prepare('UPDATE attendance SET status = ?, minutes_late = ?, note = ?, recorded_by = ? WHERE id = ?')
          .run(status, minutes, r.note || null, req.user.id, existing.id);
      } else {
        insert.run(r.student_id, halqa_id, date, status, minutes, r.note || null, req.user.id);
      }
    }
  });
  tx();
  res.json({ ok: true, message: 'تم تسجيل الحضور والغياب بنجاح.', count: records.length });
}));

router.get('/students', h((req, res) => {
  const ids = myHalqas(req.user.id);
  if (!ids.length) return res.json([]);
  const ph = ids.map(() => '?').join(',');
  res.json(db.prepare(`SELECT DISTINCT u.id, u.name, u.username, u.stage, h.id AS halqa_id, h.name AS halqa_name
    FROM enrollments e JOIN users u ON u.id = e.student_id JOIN halqas h ON h.id = e.halqa_id
    WHERE e.halqa_id IN (${ph}) ORDER BY u.name`).all(...ids));
}));

router.get('/recitation', h((req, res) => {
  const ids = myHalqas(req.user.id);
  if (!ids.length) return res.json([]);
  const ph = ids.map(() => '?').join(',');
  const params = [...ids];
  let sql = `SELECT r.*, u.name AS student_name, u.username, n.name AS teacher_name FROM recitation_notes r
    JOIN users u ON u.id = r.student_id LEFT JOIN users n ON n.id = r.recorded_by
    WHERE r.recorded_by = ?`;
  params.unshift(req.user.id);
  if (req.query.student_id) { sql += ' AND r.student_id = ?'; params.push(req.query.student_id); }
  sql += ' ORDER BY r.created_at DESC LIMIT 300';
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map((r) => ({ ...r, kind_label: r.kind === 'error' ? 'خطأ' : 'ملاحظة' })));
}));

router.post('/recitation', h((req, res) => {
  const { student_id, surah, ayah_from, ayah_to, kind = 'note', note } = req.body || {};
  const ids = myHalqas(req.user.id);
  const allowed = ids.length && db.prepare(`SELECT id FROM enrollments WHERE halqa_id IN (${ids.map(() => '?').join(',')}) AND student_id = ?`).get(...ids, student_id);
  if (!allowed) return res.status(403).json({ error: 'الطالبة ليست ضمن طالبات حلقاتك.' });
  if (!surah || !note) return res.status(400).json({ error: 'الرجاء إدخال السورة والملاحظة.' });
  const info = db.prepare(`INSERT INTO recitation_notes(student_id, surah, ayah_from, ayah_to, kind, note, recorded_by)
    VALUES (?,?,?,?,?,?,?)`).run(student_id, surah, ayah_from || null, ayah_to || null, kind === 'error' ? 'error' : 'note', note, req.user.id);
  res.status(201).json({ ok: true, id: info.lastInsertRowid, message: 'تم تسجيل الملاحظة وإرسالها للطالبة.' });
}));

router.get('/appointments', h((req, res) => {
  const ids = myHalqas(req.user.id);
  if (!ids.length) return res.json([]);
  const ph = ids.map(() => '?').join(',');
  const params = [...ids];
  let sql = `SELECT a.*, u.name AS student_name, u.username, d.name AS decided_by_name FROM appointments a
    JOIN users u ON u.id = a.student_id LEFT JOIN users d ON d.id = a.decided_by
    WHERE a.student_id IN (SELECT student_id FROM enrollments WHERE halqa_id IN (${ph}))`;
  if (req.query.status) { sql += ' AND a.status = ?'; params.push(req.query.status); }
  sql += ' ORDER BY CASE a.status WHEN \'pending\' THEN 0 ELSE 1 END, a.date ASC';
  res.json(db.prepare(sql).all(...params).map((r) => ({ ...r, clinic_label: CLINICS[r.clinic] || r.clinic })));
}));

router.patch('/appointments/:id', h((req, res) => {
  const appt = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
  if (!appt) return res.status(404).json({ error: 'الطلب غير موجود.' });
  const ids = myHalqas(req.user.id);
  const allowed = ids.length && db.prepare(`SELECT id FROM enrollments WHERE halqa_id IN (${ids.map(() => '?').join(',')}) AND student_id = ?`).get(...ids, appt.student_id);
  if (!allowed) return res.status(403).json({ error: 'لا تملك صلاحية تعديل هذا الطلب.' });
  const { status, note } = req.body || {};
  if (!['accepted', 'rejected', 'pending'].includes(status)) return res.status(400).json({ error: 'حالة الطلب غير صحيحة.' });
  db.prepare(`UPDATE appointments SET status = ?, decision_note = ?, decided_by = ?, decided_at = datetime('now') WHERE id = ?`)
    .run(status, note || null, req.user.id, appt.id);
  res.json({ ok: true, message: status === 'accepted' ? 'تم قبول طلب الموعد.' : 'تم رفض طلب الموعد.' });
}));

router.get('/rewards', h((req, res) => {
  const rows = db.prepare(`SELECT r.*, u.name AS student_name, u.username FROM rewards r JOIN users u ON u.id = r.student_id
    WHERE r.given_by = ? ORDER BY r.created_at DESC LIMIT 300`).all(req.user.id);
  res.json(rows.map((r) => ({ ...r, type_label: REWARD_TYPES[r.type] || r.type })));
}));

router.post('/rewards', h((req, res) => {
  const { student_id, type, title, points, note } = req.body || {};
  if (!REWARD_TYPES[type]) return res.status(400).json({ error: 'الرجاء اختيار نوع التعزيز.' });
  const ids = myHalqas(req.user.id);
  const allowed = ids.length && db.prepare(`SELECT id FROM enrollments WHERE halqa_id IN (${ids.map(() => '?').join(',')}) AND student_id = ?`).get(...ids, student_id);
  if (!allowed) return res.status(403).json({ error: 'الطالبة ليست ضمن طالبات حلقاتك.' });
  const info = db.prepare('INSERT INTO rewards(student_id, type, title, points, note, given_by) VALUES (?,?,?,?,?,?)')
    .run(student_id, type, title || REWARD_TYPES[type], Number(points) || 0, note || null, req.user.id);
  res.status(201).json({ ok: true, id: info.lastInsertRowid, message: 'تم إضافة التعزيز وإشعار الطالبة.' });
}));

router.get('/evaluations', h((req, res) => {
  const rows = db.prepare(`SELECT e.*, u.name AS student_name, h.name AS halqa_name FROM evaluations e
    LEFT JOIN users u ON u.id = e.student_id LEFT JOIN halqas h ON h.id = e.halqa_id
    WHERE e.created_by = ? OR e.teacher_id = ? ORDER BY e.created_at DESC LIMIT 300`).all(req.user.id, req.user.id);
  res.json(rows);
}));

router.post('/evaluations', h((req, res) => {
  const { student_id, halqa_id, theory_score, practical_score, tasmi_score, jazari_score, notes } = req.body || {};
  const halqa = assertHalqa(req, halqa_id);
  if (student_id) {
    const allowed = db.prepare('SELECT id FROM enrollments WHERE halqa_id = ? AND student_id = ?').get(halqa_id, student_id);
    if (!allowed) return res.status(403).json({ error: 'الطالبة ليست ضمن هذه الحلقة.' });
  }
  const num = (v, max = 25) => {
    const n = Number(v);
    if (Number.isNaN(n)) return null;
    if (n < 0 || n > max) throw Object.assign(new Error(`الدرجة يجب أن تكون بين 0 و ${max}.`), { status: 400 });
    return n;
  };
  const total = ['theory_score', 'practical_score', 'tasmi_score', 'jazari_score'].reduce((s, k) => s + (Number(req.body[k]) || 0), 0);
  const result = total >= 90 ? 'ممتاز' : total >= 80 ? 'جيد جدًا' : total >= 70 ? 'جيد' : total >= 60 ? 'مقبول' : 'يحتاج تحسين';
  const info = db.prepare(`INSERT INTO evaluations(halqa_id, student_id, teacher_id, stage, theory_score, practical_score, tasmi_score, jazari_score, result, notes, created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(halqa_id, student_id || null, req.user.id, halqa.stage,
    num(theory_score), num(practical_score), num(tasmi_score), num(jazari_score), result, notes || null, req.user.id);
  res.status(201).json({ ok: true, id: info.lastInsertRowid, result, total, message: 'تم إرسال نتائج الاختبار العملي.' });
}));

router.get('/activities', h((req, res) => {
  const rows = db.prepare(`SELECT a.*, h.name AS halqa_name,
      (SELECT COUNT(*) FROM activity_submissions s WHERE s.activity_id = a.id) AS submissions_count,
      (SELECT COUNT(*) FROM enrollments e WHERE e.halqa_id = a.halqa_id) AS students_count
    FROM activities a LEFT JOIN halqas h ON h.id = a.halqa_id WHERE a.created_by = ? ORDER BY a.created_at DESC`).all(req.user.id);
  res.json(rows);
}));

router.post('/activities', h((req, res) => {
  const { halqa_id, title, description, kind = 'homework', due_date, published = 1, attachment } = req.body || {};
  assertHalqa(req, halqa_id);
  if (!title) return res.status(400).json({ error: 'عنوان النشاط مطلوب.' });
  const file = attachment ? saveBase64(attachment, 'activity') || null : null;
  const info = db.prepare(`INSERT INTO activities(halqa_id, title, description, kind, due_date, attachment_path, published, created_by)
    VALUES (?,?,?,?,?,?,?,?)`).run(halqa_id, title, description || null, kind, due_date || null, file, published ? 1 : 0, req.user.id);
  res.status(201).json({ ok: true, id: info.lastInsertRowid, message: published ? 'تم نشر النشاط وإشعار الطالبات.' : 'تم حفظ النشاط كمسودة.' });
}));

router.patch('/activities/:id', h((req, res) => {
  const act = db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id);
  if (!act) return res.status(404).json({ error: 'النشاط غير موجود.' });
  assertHalqa(req, act.halqa_id);
  const fields = ['title', 'description', 'kind', 'due_date'];
  const sets = []; const params = [];
  fields.forEach((f) => { if (req.body[f] !== undefined) { sets.push(`${f} = ?`); params.push(req.body[f]); } });
  if (req.body.published !== undefined) { sets.push('published = ?'); params.push(req.body.published ? 1 : 0); }
  if (!sets.length) return res.status(400).json({ error: 'لا توجد تغييرات.' });
  params.push(act.id);
  db.prepare(`UPDATE activities SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  res.json({ ok: true, message: req.body.published ? 'تم نشر النشاط.' : 'تم تحديث النشاط.' });
}));

router.get('/activities/:id/submissions', h((req, res) => {
  const act = db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id);
  if (!act) return res.status(404).json({ error: 'النشاط غير موجود.' });
  assertHalqa(req, act.halqa_id);
  res.json({
    activity: act,
    students: db.prepare(`SELECT u.id AS student_id, u.name, u.username, s.id AS submission_id, s.note, s.link, s.file_path,
        s.grade, s.feedback, s.status, s.created_at
      FROM enrollments e JOIN users u ON u.id = e.student_id
      LEFT JOIN activity_submissions s ON s.activity_id = ? AND s.student_id = u.id
      WHERE e.halqa_id = ? ORDER BY u.name`).all(act.id, act.halqa_id)
  });
}));

router.patch('/submissions/:id', h((req, res) => {
  const sub = db.prepare(`SELECT s.*, a.halqa_id FROM activity_submissions s JOIN activities a ON a.id = s.activity_id WHERE s.id = ?`).get(req.params.id);
  if (!sub) return res.status(404).json({ error: 'التسليم غير موجود.' });
  assertHalqa(req, sub.halqa_id);
  const { grade, feedback } = req.body || {};
  let g = null;
  if (grade !== undefined && grade !== null && grade !== '') {
    g = Number(grade);
    if (Number.isNaN(g) || g < 0 || g > 10) return res.status(400).json({ error: 'الدرجة يجب أن تكون بين 0 و 10.' });
  }
  db.prepare(`UPDATE activity_submissions SET grade = ?, feedback = ?, status = 'graded' WHERE id = ?`).run(g, feedback || null, sub.id);
  res.json({ ok: true, message: 'تم حفظ التقييم.' });
}));

// إضافة وإرسال الدرجات (نظري/عملي) لطالبات حلقات المعلمة
router.get('/grades', h((req, res) => {
  const ids = myHalqas(req.user.id);
  if (!ids.length) return res.json([]);
  const ph = ids.map(() => '?').join(',');
  const rows = db.prepare(`SELECT g.*, u.name AS student_name, u.username, h.name AS halqa_name
    FROM grades g JOIN users u ON u.id = g.student_id
    LEFT JOIN enrollments e ON e.student_id = u.id
    LEFT JOIN halqas h ON h.id = e.halqa_id AND h.id IN (${ph})
    WHERE e.halqa_id IN (${ph}) ORDER BY g.created_at DESC LIMIT 300`).all(...ids, ...ids);
  res.json(rows.map((r) => ({ ...r, total: scoreTotal(r) })));
}));

router.post('/grades', h((req, res) => {
  const { records, max_theory = 50, max_practical = 50 } = req.body || {};
  if (!Array.isArray(records) || !records.length) return res.status(400).json({ error: 'لا توجد درجات للإرسال.' });
  const ids = myHalqas(req.user.id);
  if (!ids.length) return res.status(403).json({ error: 'لا توجد حلقات مرتبطة بحسابك.' });
  const ph = ids.map(() => '?').join(',');
  const mt = Number(max_theory) || 50; const mp = Number(max_practical) || 50;
  const insert = db.prepare(`INSERT INTO grades(student_id, stage, theory_score, practical_score, max_theory, max_practical, notes, recorded_by)
    VALUES (?,?,?,?,?,?,?,?)`);
  let count = 0;
  const tx = db.transaction(() => {
    for (const r of records) {
      const student = db.prepare(`SELECT u.* FROM enrollments e JOIN users u ON u.id = e.student_id
        WHERE e.halqa_id IN (${ph}) AND u.id = ?`).get(...ids, r.student_id);
      if (!student) throw Object.assign(new Error('إحدى الطالبات ليست ضمن طالبات حلقاتك.'), { status: 403 });
      const parse = (v) => (v === '' || v === undefined || v === null ? null : Number(v));
      const th = parse(r.theory_score); const pr = parse(r.practical_score);
      if (th !== null && (Number.isNaN(th) || th < 0 || th > mt)) throw Object.assign(new Error(`درجة النظري يجب أن تكون بين 0 و ${mt}.`), { status: 400 });
      if (pr !== null && (Number.isNaN(pr) || pr < 0 || pr > mp)) throw Object.assign(new Error(`درجة العملي يجب أن تكون بين 0 و ${mp}.`), { status: 400 });
      insert.run(student.id, r.stage || student.stage || null, th, pr, mt, mp, r.notes || null, req.user.id);
      count++;
    }
  });
  tx();
  res.status(201).json({ ok: true, count, message: `تم إضافة وإرسال درجات ${count} طالبة.` });
}));

router.get('/requests', h((req, res) => {
  const ids = myHalqas(req.user.id);
  if (!ids.length) return res.json([]);
  const ph = ids.map(() => '?').join(',');
  res.json(db.prepare(`SELECT r.*, u.name AS requester_name, u.username, u.stage, u.role AS requester_role, d.name AS decided_by_name
    FROM requests r JOIN users u ON u.id = r.user_id LEFT JOIN users d ON d.id = r.decided_by
    WHERE r.user_id IN (SELECT student_id FROM enrollments WHERE halqa_id IN (${ph}))
    ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END, r.created_at DESC LIMIT 300`).all(...ids));
}));

router.get('/stages', h((req, res) => res.json(STAGES)));

module.exports = router;
