'use strict';
const express = require('express');
const { db, CLINICS, REWARD_TYPES, ATTENDANCE_STATUS } = require('../db');
const { requireRole } = require('../auth');
const { h, saveBase64, scoreTotal, monthKey } = require('../utils');

const router = express.Router();
router.use(requireRole('student'));

const me = (req) => req.user.id;

router.get('/overview', h((req, res) => {
  const id = me(req);
  const att = db.prepare(`SELECT status, COUNT(*) AS c FROM attendance WHERE student_id = ? GROUP BY status`).all(id);
  const counts = {};
  att.forEach((r) => { counts[r.status] = r.c; });
  const total = att.reduce((s, r) => s + r.c, 0);
  const present = (counts.present || 0) + (counts.late10 || 0);
  const lastGrade = db.prepare('SELECT * FROM grades WHERE student_id = ? ORDER BY created_at DESC, id DESC LIMIT 1').get(id);
  const rewardPoints = db.prepare('SELECT COALESCE(SUM(points),0) AS p, COUNT(*) AS c FROM rewards WHERE student_id = ?').get(id);
  const payment = db.prepare('SELECT * FROM payments WHERE student_id = ? AND month = ?').get(id, monthKey());
  const settings = {};
  db.prepare('SELECT key, value FROM settings').all().forEach((r) => { settings[r.key] = r.value; });
  const halqa = db.prepare(`SELECT h.*, t.name AS teacher_name, b.name AS branch_name FROM enrollments e
    JOIN halqas h ON h.id = e.halqa_id LEFT JOIN users t ON t.id = h.teacher_id LEFT JOIN branches b ON b.id = h.branch_id
    WHERE e.student_id = ? LIMIT 1`).get(id);
  const pendingAppointments = db.prepare(`SELECT COUNT(*) AS c FROM appointments WHERE student_id = ? AND status = 'pending'`).get(id).c;
  const openActivities = db.prepare(`SELECT COUNT(*) AS c FROM activities a WHERE a.published = 1 AND a.halqa_id = ?
    AND NOT EXISTS (SELECT 1 FROM activity_submissions s WHERE s.activity_id = a.id AND s.student_id = ?)`).get(halqa ? halqa.id : -1, id).c;
  res.json({
    attendance: { total, present, absent: total - present, rate: total ? Math.round((present / total) * 100) : 0, counts, labels: ATTENDANCE_STATUS },
    last_grade: lastGrade ? { ...lastGrade, total: scoreTotal(lastGrade) } : null,
    rewards: rewardPoints, payment: payment || null, halqa, settings,
    pending_appointments: pendingAppointments, open_activities: openActivities
  });
}));

router.get('/attendance', h((req, res) => {
  const params = [me(req)];
  let sql = `SELECT a.*, h.name AS halqa_name, u.name AS teacher_name FROM attendance a
    LEFT JOIN halqas h ON h.id = a.halqa_id LEFT JOIN users u ON u.id = a.recorded_by
    WHERE a.student_id = ?`;
  if (req.query.from) { sql += ' AND a.date >= ?'; params.push(req.query.from); }
  if (req.query.to) { sql += ' AND a.date <= ?'; params.push(req.query.to); }
  sql += ' ORDER BY a.date DESC LIMIT 300';
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map((r) => ({ ...r, status_label: ATTENDANCE_STATUS[r.status] || r.status })));
}));

router.get('/grades', h((req, res) => {
  const rows = db.prepare(`SELECT g.*, u.name AS teacher_name FROM grades g LEFT JOIN users u ON u.id = g.recorded_by
    WHERE g.student_id = ? ORDER BY g.created_at DESC, g.id DESC`).all(me(req));
  res.json(rows.map((r) => ({ ...r, total: scoreTotal(r) })));
}));

router.get('/recitation', h((req, res) => {
  const rows = db.prepare(`SELECT r.*, u.name AS teacher_name FROM recitation_notes r LEFT JOIN users u ON u.id = r.recorded_by
    WHERE r.student_id = ? ORDER BY r.created_at DESC LIMIT 200`).all(me(req));
  res.json(rows.map((r) => ({ ...r, kind_label: r.kind === 'error' ? 'خطأ' : 'ملاحظة' })));
}));

router.get('/rewards', h((req, res) => {
  const rows = db.prepare(`SELECT r.*, u.name AS given_by_name FROM rewards r LEFT JOIN users u ON u.id = r.given_by
    WHERE r.student_id = ? ORDER BY r.created_at DESC`).all(me(req));
  const total = rows.reduce((s, r) => s + (r.points || 0), 0);
  res.json({ items: rows.map((r) => ({ ...r, type_label: REWARD_TYPES[r.type] || r.type })), total_points: total });
}));

router.get('/alerts', h((req, res) => {
  res.json(db.prepare(`SELECT a.*, u.name AS created_by_name FROM alerts a LEFT JOIN users u ON u.id = a.created_by
    WHERE a.student_id = ? ORDER BY a.created_at DESC`).all(me(req)));
}));

router.get('/appointments', h((req, res) => {
  const rows = db.prepare(`SELECT a.*, u.name AS decided_by_name FROM appointments a LEFT JOIN users u ON u.id = a.decided_by
    WHERE a.student_id = ? ORDER BY a.date DESC, a.time DESC`).all(me(req));
  res.json(rows.map((r) => ({ ...r, clinic_label: CLINICS[r.clinic] || r.clinic })));
}));

router.post('/appointments', h((req, res) => {
  const { clinic, date, time, note } = req.body || {};
  if (!CLINICS[clinic]) return res.status(400).json({ error: 'الرجاء اختيار العيادة (نظرية أو مخارج).' });
  if (!date || !time) return res.status(400).json({ error: 'الرجاء تحديد التاريخ والوقت.' });
  if (date < new Date().toISOString().slice(0, 10)) return res.status(400).json({ error: 'لا يمكن حجز موعد في تاريخ سابق.' });
  const clash = db.prepare('SELECT id FROM appointments WHERE student_id = ? AND date = ? AND time = ? AND status <> \'rejected\'').get(me(req), date, time);
  if (clash) return res.status(409).json({ error: 'لديك موعد محجوز في نفس التاريخ والوقت.' });
  const info = db.prepare('INSERT INTO appointments(student_id, clinic, date, time, note) VALUES (?,?,?,?,?)')
    .run(me(req), clinic, date, time, note || null);
  res.status(201).json({ ok: true, id: info.lastInsertRowid, message: 'تم إرسال طلب الحجز، سيتم إشعارك بالنتيجة.' });
}));

router.get('/registrations', h((req, res) => {
  const rows = db.prepare(`SELECT h.id, h.name, h.stage, h.link, e.status, e.pinned, e.created_at,
      t.name AS teacher_name, b.name AS branch_name,
      (SELECT group_concat(s.day || ' ' || s.time, ' | ') FROM halqa_sessions s WHERE s.halqa_id = h.id) AS schedule
    FROM enrollments e JOIN halqas h ON h.id = e.halqa_id LEFT JOIN users t ON t.id = h.teacher_id
    LEFT JOIN branches b ON b.id = h.branch_id WHERE e.student_id = ?`).all(me(req));
  res.json(rows);
}));

router.post('/registrations', h((req, res) => {
  const { halqa_id, note } = req.body || {};
  const halqa = db.prepare('SELECT * FROM halqas WHERE id = ? AND active = 1 AND published = 1').get(halqa_id);
  if (!halqa) return res.status(404).json({ error: 'الحلقة غير متاحة للتسجيل.' });
  const exists = db.prepare('SELECT id FROM enrollments WHERE halqa_id = ? AND student_id = ?').get(halqa.id, me(req));
  if (exists) return res.status(409).json({ error: 'أنت مسجَّلة بالفعل في هذه الحلقة.' });
  db.prepare('INSERT INTO enrollments(halqa_id, student_id) VALUES (?,?)').run(halqa.id, me(req));
  db.prepare('INSERT INTO requests(user_id, type, details, status) VALUES (?,?,?,?)')
    .run(me(req), 'التسجيل في حلقة', `طلب التسجيل في ${halqa.name} — ${halqa.stage || ''}${note ? ' — ' + note : ''}`, 'pending');
  res.status(201).json({ ok: true, message: 'تم إرسال طلب التسجيل في الحلقة.' });
}));

router.get('/requests', h((req, res) => {
  res.json(db.prepare('SELECT * FROM requests WHERE user_id = ? ORDER BY created_at DESC').all(me(req)));
}));

router.post('/requests', h((req, res) => {
  const { type, details } = req.body || {};
  if (!type) return res.status(400).json({ error: 'الرجاء تحديد نوع الطلب.' });
  if (!details || String(details).trim().length < 5) return res.status(400).json({ error: 'الرجاء كتابة تفاصيل الطلب.' });
  const info = db.prepare('INSERT INTO requests(user_id, type, details) VALUES (?,?,?)').run(me(req), type, String(details).trim());
  res.status(201).json({ ok: true, id: info.lastInsertRowid, message: 'تم تقديم الطلب، ستتم مراجعته من الإدارة.' });
}));

router.get('/payments', h((req, res) => {
  res.json(db.prepare('SELECT * FROM payments WHERE student_id = ? ORDER BY month DESC').all(me(req)));
}));

router.post('/payments', h((req, res) => {
  const { month, amount, receipt, note } = req.body || {};
  if (!month) return res.status(400).json({ error: 'الرجاء تحديد الشهر.' });
  if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'صيغة الشهر غير صحيحة.' });
  let receiptPath = null;
  if (receipt) receiptPath = saveBase64(receipt, 'receipt') || null;
  const existing = db.prepare('SELECT * FROM payments WHERE student_id = ? AND month = ?').get(me(req), month);
  if (existing) {
    db.prepare('UPDATE payments SET receipt_path = COALESCE(?, receipt_path), status = ?, note = ? WHERE id = ?')
      .run(receiptPath, receiptPath ? 'pending' : existing.status, note || existing.note, existing.id);
  } else {
    db.prepare('INSERT INTO payments(student_id, month, amount, receipt_path, status, note) VALUES (?,?,?,?,?,?)')
      .run(me(req), month, Number(amount || 0), receiptPath, receiptPath ? 'pending' : 'unpaid', note || null);
  }
  res.status(201).json({ ok: true, message: receiptPath ? 'تم رفع الإيصال، بانتظار مراجعة الإدارة.' : 'تم حفظ بيانات الدفع.' });
}));

function studentHalqaIds(studentId) {
  return db.prepare('SELECT halqa_id FROM enrollments WHERE student_id = ?').all(studentId).map((r) => r.halqa_id);
}
router.studentHalqaIds = studentHalqaIds;

router.get('/activities', h((req, res) => {
  const ids = studentHalqaIds(me(req));
  if (!ids.length) return res.json([]);
  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare(`SELECT a.*, h.name AS halqa_name, u.name AS teacher_name,
      s.id AS submission_id, s.status AS submission_status, s.note AS submission_note, s.link AS submission_link,
      s.file_path AS submission_file, s.grade, s.feedback, s.created_at AS submitted_at
    FROM activities a JOIN halqas h ON h.id = a.halqa_id LEFT JOIN users u ON u.id = a.created_by
    LEFT JOIN activity_submissions s ON s.activity_id = a.id AND s.student_id = ?
    WHERE a.published = 1 AND a.halqa_id IN (${placeholders}) ORDER BY a.due_date DESC`).all(me(req), ...ids);
  res.json(rows);
}));

router.post('/activities/:id/submit', h((req, res) => {
  const activity = db.prepare('SELECT * FROM activities WHERE id = ? AND published = 1').get(req.params.id);
  if (!activity) return res.status(404).json({ error: 'النشاط غير موجود.' });
  const enrolled = db.prepare('SELECT id FROM enrollments WHERE halqa_id = ? AND student_id = ?').get(activity.halqa_id, me(req));
  if (!enrolled) return res.status(403).json({ error: 'أنت غير مسجَّلة في حلقة هذا النشاط.' });
  const { note, link, file } = req.body || {};
  if (!note && !link && !file) return res.status(400).json({ error: 'الرجاء إرفاق الحل أو كتابة ملاحظة التسليم.' });
  const filePath = file ? saveBase64(file, 'submit') || null : null;
  const existing = db.prepare('SELECT id FROM activity_submissions WHERE activity_id = ? AND student_id = ?').get(activity.id, me(req));
  if (existing) {
    db.prepare('UPDATE activity_submissions SET note = ?, link = ?, file_path = COALESCE(?, file_path), status = \'submitted\', grade = NULL, feedback = NULL, created_at = datetime(\'now\') WHERE id = ?')
      .run(note || null, link || null, filePath, existing.id);
  } else {
    db.prepare('INSERT INTO activity_submissions(activity_id, student_id, note, link, file_path) VALUES (?,?,?,?,?)')
      .run(activity.id, me(req), note || null, link || null, filePath);
  }
  res.status(201).json({ ok: true, message: 'تم تسليم النشاط بنجاح.' });
}));

router.get('/teachers', h((req, res) => {
  res.json(db.prepare(`SELECT DISTINCT t.id, t.name FROM enrollments e JOIN halqas h ON h.id = e.halqa_id
    JOIN users t ON t.id = h.teacher_id WHERE e.student_id = ?`).all(me(req)));
}));

module.exports = router;
