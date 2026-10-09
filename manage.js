'use strict';
const express = require('express');
const { db, ATTENDANCE_STATUS, REWARD_TYPES, CLINICS, ROLES, STAGES, DAYS } = require('../db');
const { requireRole, hashPassword, scopedBranchId } = require('../auth');
const { h, scoreTotal, monthKey } = require('../utils');

const router = express.Router();
router.use(requireRole('admin', 'supervisor'));

const branchScope = (req) => scopedBranchId(req.user);

function scopedStudents(req, extraWhere = '', params = []) {
  const b = branchScope(req);
  let sql = `SELECT u.id, u.name, u.username, u.stage, u.email, u.phone, u.active, u.branch_id, b.name AS branch_name
    FROM users u LEFT JOIN branches b ON b.id = u.branch_id WHERE u.role = 'student'`;
  if (b) { sql += ' AND u.branch_id = ?'; params.push(b); }
  if (extraWhere) sql += ` AND ${extraWhere}`;
  return db.prepare(`${sql} ORDER BY u.name`).all(...params);
}

router.get('/dashboard', h((req, res) => {
  const b = branchScope(req);
  const scope = b ? ' AND u.branch_id = ?' : '';
  const sp = b ? [b] : [];
  const students = db.prepare(`SELECT COUNT(*) AS c FROM users u WHERE u.role = 'student' AND u.active = 1${scope}`).get(...sp).c;
  const teachers = db.prepare(`SELECT COUNT(*) AS c FROM users u WHERE u.role = 'teacher' AND u.active = 1${scope}`).get(...sp).c;
  const halqas = db.prepare(`SELECT COUNT(*) AS c FROM halqas h WHERE h.active = 1${b ? ' AND h.branch_id = ?' : ''}`).get(...sp).c;
  const pendingAppointments = db.prepare(`SELECT COUNT(*) AS c FROM appointments a JOIN users u ON u.id = a.student_id WHERE a.status = 'pending'${scope}`).get(...sp).c;
  const pendingRequests = db.prepare(`SELECT COUNT(*) AS c FROM requests r JOIN users u ON u.id = r.user_id WHERE r.status = 'pending'${scope}`).get(...sp).c;
  const unpaid = db.prepare(`SELECT COUNT(*) AS c FROM payments p JOIN users u ON u.id = p.student_id WHERE p.status <> 'paid'${scope}`).get(...sp).c;
  const att = db.prepare(`SELECT a.status, COUNT(*) AS c FROM attendance a JOIN users u ON u.id = a.student_id WHERE 1=1${scope} GROUP BY a.status`).all(...sp);
  const total = att.reduce((s, r) => s + r.c, 0);
  const present = att.filter((r) => r.status === 'present' || r.status === 'late10').reduce((s, r) => s + r.c, 0);
  const branchBreakdown = db.prepare(`SELECT b.name, b.id,
      (SELECT COUNT(*) FROM users u WHERE u.role = 'student' AND u.branch_id = b.id) AS students,
      (SELECT COUNT(*) FROM halqas h WHERE h.branch_id = b.id) AS halqas
    FROM branches b ORDER BY b.name`).all();
  const byGrade = db.prepare(`SELECT stage, COUNT(*) AS c FROM users WHERE role = 'student' AND stage IS NOT NULL${b ? ' AND branch_id = ?' : ''} GROUP BY stage ORDER BY stage`).all(...sp);
  res.json({
    students, teachers, halqas, pending_appointments: pendingAppointments, pending_requests: pendingRequests,
    unpaid_payments: unpaid, attendance_total: total,
    attendance_rate: total ? Math.round((present / total) * 100) : 0,
    attendance_counts: att.reduce((o, r) => ({ ...o, [r.status]: r.c }), {}),
    attendance_labels: ATTENDANCE_STATUS, branch_breakdown: branchBreakdown, by_stage: byGrade, role: req.user.role,
    scope_branch: b
  });
}));

router.get('/branches', h((req, res) => res.json(db.prepare('SELECT * FROM branches ORDER BY name').all())));

router.post('/branches', h((req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'إضافة الفروع من صلاحية الإدارة العامة فقط.' });
  const { name, city } = req.body || {};
  if (!name) return res.status(400).json({ error: 'اسم الفرع مطلوب.' });
  if (db.prepare('SELECT id FROM branches WHERE name = ?').get(name)) return res.status(409).json({ error: 'الفرع موجود مسبقًا.' });
  const info = db.prepare('INSERT INTO branches(name, city) VALUES (?,?)').run(name, city || null);
  res.status(201).json({ ok: true, id: info.lastInsertRowid, message: 'تمت إضافة الفرع.' });
}));

router.get('/users', h((req, res) => {
  const b = branchScope(req);
  const params = [];
  let sql = `SELECT u.id, u.username, u.name, u.email, u.phone, u.role, u.stage, u.active, u.created_at,
      b.name AS branch_name, h.name AS halqa_name, u.branch_id
    FROM users u LEFT JOIN branches b ON b.id = u.branch_id
    LEFT JOIN enrollments e ON e.student_id = u.id AND e.pinned = 1
    LEFT JOIN halqas h ON h.id = e.halqa_id WHERE 1=1`;
  if (b) { sql += ' AND u.branch_id = ?'; params.push(b); }
  if (req.query.role) { sql += ' AND u.role = ?'; params.push(req.query.role); }
  if (req.query.q) { sql += ' AND (u.name LIKE ? OR u.username LIKE ?)'; params.push(`%${req.query.q}%`, `%${req.query.q}%`); }
  sql += ' ORDER BY u.role, u.name LIMIT 1000';
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map((u) => ({ ...u, role_label: ROLES[u.role] })));
}));

router.post('/users', h((req, res) => {
  const { name, username, email, phone, role, stage, branch_id, halqa_id } = req.body || {};
  if (!name || !username) return res.status(400).json({ error: 'الاسم واسم المستخدم مطلوبان.' });
  if (!['student', 'teacher', 'supervisor', 'admin'].includes(role)) return res.status(400).json({ error: 'نوع المستخدم غير صحيح.' });
  if (req.user.role === 'supervisor' && !['student', 'teacher'].includes(role)) {
    return res.status(403).json({ error: 'المشرفة تستطيع إضافة الطالبات والمعلمات فقط.' });
  }
  if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username)) {
    return res.status(400).json({ error: 'اسم المستخدم يجب أن يكون 3–30 حرفًا إنجليزيًا أو أرقامًا بدون مسافات.' });
  }
  if (db.prepare('SELECT id FROM users WHERE lower(username) = lower(?)').get(username)) {
    return res.status(409).json({ error: 'اسم المستخدم مستخدم مسبقًا.' });
  }
  const defaults = { admin: 'Admin@2026', supervisor: 'Super@2026', teacher: 'Teacher@2026', student: 'Student@2026' };
  const { hash, salt } = hashPassword(defaults[role]);
  const bId = req.user.role === 'supervisor' ? req.user.branch_id : (branch_id || req.user.branch_id || null);
  const info = db.prepare(`INSERT INTO users(username, name, email, phone, role, password_hash, password_salt, stage, branch_id, must_change_password)
    VALUES (?,?,?,?,?,?,?,?,?,1)`).run(username.trim(), name, email || null, phone || null, role, hash, salt, stage || null, bId);
  const userId = info.lastInsertRowid;
  if (halqa_id && role === 'student') db.prepare('INSERT OR IGNORE INTO enrollments(halqa_id, student_id) VALUES (?,?)').run(halqa_id, userId);
  res.status(201).json({ ok: true, id: userId, default_password: defaults[role], message: `تمت إضافة ${name} بكلمة مرور افتراضية.` });
}));

router.patch('/users/:id', h((req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود.' });
  const b = branchScope(req);
  if (b && user.branch_id !== b) return res.status(403).json({ error: 'المستخدم خارج نطاق فرعك.' });
  if (req.user.role === 'supervisor' && user.role === 'admin') return res.status(403).json({ error: 'لا تملك صلاحية تعديل الإدارة العامة.' });
  const { active, stage, halqa_id, reset_password, name, email, phone } = req.body || {};
  const sets = []; const params = [];
  if (active !== undefined) { sets.push('active = ?'); params.push(active ? 1 : 0); }
  if (stage !== undefined) { sets.push('stage = ?'); params.push(stage || null); }
  if (name) { sets.push('name = ?'); params.push(name); }
  if (email !== undefined) { sets.push('email = ?'); params.push(email || null); }
  if (phone !== undefined) { sets.push('phone = ?'); params.push(phone || null); }
  let newPassword = null;
  if (reset_password) {
    const defaults = { admin: 'Admin@2026', supervisor: 'Super@2026', teacher: 'Teacher@2026', student: 'Student@2026' };
    newPassword = defaults[user.role] || 'Kan@2026';
    const { hash, salt } = hashPassword(newPassword);
    sets.push('password_hash = ?', 'password_salt = ?', 'must_change_password = 1');
    params.push(hash, salt);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
  }
  if (sets.length) { params.push(user.id); db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...params); }
  if (halqa_id !== undefined && user.role === 'student') {
    db.prepare('DELETE FROM enrollments WHERE student_id = ? AND pinned = 1').run(user.id);
    if (halqa_id) db.prepare('INSERT OR IGNORE INTO enrollments(halqa_id, student_id, pinned) VALUES (?,?,1)').run(halqa_id, user.id);
  }
  res.json({ ok: true, new_password: newPassword, message: 'تم تحديث بيانات المستخدم.' });
}));

router.get('/grades', h((req, res) => {
  const params = [];
  const b = branchScope(req);
  let sql = `SELECT g.*, u.name AS student_name, u.username, u.stage AS student_stage, t.name AS teacher_name,
      h.name AS halqa_name FROM grades g JOIN users u ON u.id = g.student_id
    LEFT JOIN users t ON t.id = g.recorded_by
    LEFT JOIN enrollments e ON e.student_id = u.id AND e.pinned = 1
    LEFT JOIN halqas h ON h.id = e.halqa_id WHERE 1=1`;
  if (b) { sql += ' AND u.branch_id = ?'; params.push(b); }
  if (req.query.stage) { sql += ' AND g.stage = ?'; params.push(req.query.stage); }
  if (req.query.student_id) { sql += ' AND g.student_id = ?'; params.push(req.query.student_id); }
  if (req.query.q) { sql += ' AND (u.name LIKE ? OR u.username LIKE ?)'; params.push(`%${req.query.q}%`, `%${req.query.q}%`); }
  sql += ' ORDER BY g.created_at DESC LIMIT 500';
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map((r) => ({ ...r, total: scoreTotal(r) })));
}));

router.post('/grades', h((req, res) => {
  const { records, student_id, stage, theory_score, practical_score, notes, max_theory = 50, max_practical = 50 } = req.body || {};
  const list = Array.isArray(records) ? records : [{ student_id, stage, theory_score, practical_score, notes }];
  if (!list.length) return res.status(400).json({ error: 'لا توجد درجات للإرسال.' });
  const b = branchScope(req);
  const insert = db.prepare(`INSERT INTO grades(student_id, stage, theory_score, practical_score, max_theory, max_practical, notes, recorded_by)
    VALUES (?,?,?,?,?,?,?,?)`);
  const done = [];
  const tx = db.transaction(() => {
    for (const r of list) {
      const student = db.prepare(`SELECT * FROM users WHERE id = ? AND role = 'student'`).get(r.student_id);
      if (!student) throw Object.assign(new Error('طالبة غير موجودة في القائمة.'), { status: 404 });
      if (b && student.branch_id !== b) throw Object.assign(new Error('إحدى الطالبات خارج نطاق فرعك.'), { status: 403 });
      const th = r.theory_score === '' || r.theory_score === undefined || r.theory_score === null ? null : Number(r.theory_score);
      const pr = r.practical_score === '' || r.practical_score === undefined || r.practical_score === null ? null : Number(r.practical_score);
      const mt = Number(r.max_theory || max_theory), mp = Number(r.max_practical || max_practical);
      if (th !== null && (Number.isNaN(th) || th < 0 || th > mt)) throw Object.assign(new Error(`درجة النظري يجب أن تكون بين 0 و ${mt}.`), { status: 400 });
      if (pr !== null && (Number.isNaN(pr) || pr < 0 || pr > mp)) throw Object.assign(new Error(`درجة العملي يجب أن تكون بين 0 و ${mp}.`), { status: 400 });
      insert.run(student.id, r.stage || student.stage || null, th, pr, mt, mp, r.notes || null, req.user.id);
      done.push(student.name);
    }
  });
  tx();
  res.status(201).json({ ok: true, count: done.length, message: `تم إضافة وإرسال درجات ${done.length} طالبة.` });
}));

router.get('/appointments', h((req, res) => {
  const params = [];
  const b = branchScope(req);
  let sql = `SELECT a.*, u.name AS student_name, u.username, u.stage, d.name AS decided_by_name,
      (SELECT name FROM halqas h JOIN enrollments e ON e.halqa_id = h.id WHERE e.student_id = u.id AND e.pinned = 1 LIMIT 1) AS halqa_name
    FROM appointments a JOIN users u ON u.id = a.student_id LEFT JOIN users d ON d.id = a.decided_by WHERE 1=1`;
  if (b) { sql += ' AND u.branch_id = ?'; params.push(b); }
  if (req.query.status) { sql += ' AND a.status = ?'; params.push(req.query.status); }
  sql += ' ORDER BY CASE a.status WHEN \'pending\' THEN 0 ELSE 1 END, a.date ASC';
  res.json(db.prepare(sql).all(...params).map((r) => ({ ...r, clinic_label: CLINICS[r.clinic] || r.clinic })));
}));

router.patch('/appointments/:id', h((req, res) => {
  const appt = db.prepare(`SELECT a.*, u.branch_id FROM appointments a JOIN users u ON u.id = a.student_id WHERE a.id = ?`).get(req.params.id);
  if (!appt) return res.status(404).json({ error: 'الطلب غير موجود.' });
  const b = branchScope(req);
  if (b && appt.branch_id !== b) return res.status(403).json({ error: 'الطلب خارج نطاق فرعك.' });
  const { status, note } = req.body || {};
  if (!['accepted', 'rejected', 'pending'].includes(status)) return res.status(400).json({ error: 'حالة الطلب غير صحيحة.' });
  db.prepare(`UPDATE appointments SET status = ?, decision_note = ?, decided_by = ?, decided_at = datetime('now') WHERE id = ?`)
    .run(status, note || null, req.user.id, appt.id);
  res.json({ ok: true, message: status === 'accepted' ? 'تم قبول الموعد.' : 'تم رفض الموعد.' });
}));

router.get('/rewards', h((req, res) => {
  const params = [];
  const b = branchScope(req);
  let sql = `SELECT r.*, u.name AS student_name, u.username, t.name AS given_by_name FROM rewards r
    JOIN users u ON u.id = r.student_id LEFT JOIN users t ON t.id = r.given_by WHERE 1=1`;
  if (b) { sql += ' AND u.branch_id = ?'; params.push(b); }
  if (req.query.type) { sql += ' AND r.type = ?'; params.push(req.query.type); }
  sql += ' ORDER BY r.created_at DESC LIMIT 500';
  res.json(db.prepare(sql).all(...params).map((r) => ({ ...r, type_label: REWARD_TYPES[r.type] || r.type })));
}));

router.post('/rewards', h((req, res) => {
  const { student_id, type, title, points, note } = req.body || {};
  if (!REWARD_TYPES[type]) return res.status(400).json({ error: 'نوع التعزيز غير صحيح.' });
  const student = db.prepare(`SELECT * FROM users WHERE id = ? AND role = 'student'`).get(student_id);
  if (!student) return res.status(404).json({ error: 'الطالبة غير موجودة.' });
  const b = branchScope(req);
  if (b && student.branch_id !== b) return res.status(403).json({ error: 'الطالبة خارج نطاق فرعك.' });
  const info = db.prepare('INSERT INTO rewards(student_id, type, title, points, note, given_by) VALUES (?,?,?,?,?,?)')
    .run(student.id, type, title || REWARD_TYPES[type], Number(points) || 0, note || null, req.user.id);
  res.status(201).json({ ok: true, id: info.lastInsertRowid, message: 'تمت إضافة التعزيز.' });
}));

router.get('/alerts', h((req, res) => {
  const params = [];
  const b = branchScope(req);
  let sql = `SELECT a.*, u.name AS student_name, u.username, c.name AS created_by_name FROM alerts a
    JOIN users u ON u.id = a.student_id LEFT JOIN users c ON c.id = a.created_by WHERE 1=1`;
  if (b) { sql += ' AND u.branch_id = ?'; params.push(b); }
  sql += ' ORDER BY a.created_at DESC LIMIT 300';
  res.json(db.prepare(sql).all(...params));
}));

router.post('/alerts', h((req, res) => {
  const { student_id, level = 'notice', title, note } = req.body || {};
  if (!title) return res.status(400).json({ error: 'عنوان التنبيه مطلوب.' });
  const student = db.prepare(`SELECT * FROM users WHERE id = ? AND role = 'student'`).get(student_id);
  if (!student) return res.status(404).json({ error: 'الطالبة غير موجودة.' });
  const b = branchScope(req);
  if (b && student.branch_id !== b) return res.status(403).json({ error: 'الطالبة خارج نطاق فرعك.' });
  const info = db.prepare('INSERT INTO alerts(student_id, level, title, note, created_by) VALUES (?,?,?,?,?)')
    .run(student.id, level === 'warning' ? 'warning' : 'notice', title, note || null, req.user.id);
  res.status(201).json({ ok: true, id: info.lastInsertRowid, message: 'تم إرسال التنبيه للطالبة.' });
}));

router.get('/halqas', h((req, res) => {
  const params = [];
  const b = branchScope(req);
  let sql = `SELECT h.*, t.name AS teacher_name, b.name AS branch_name,
      (SELECT COUNT(*) FROM enrollments e WHERE e.halqa_id = h.id) AS students_count,
      (SELECT group_concat(s.day || ' | ' || s.time, ' — ') FROM halqa_sessions s WHERE s.halqa_id = h.id) AS schedule
    FROM halqas h LEFT JOIN users t ON t.id = h.teacher_id LEFT JOIN branches b ON b.id = h.branch_id WHERE 1=1`;
  if (b) { sql += ' AND h.branch_id = ?'; params.push(b); }
  sql += ' ORDER BY h.name';
  res.json(db.prepare(sql).all(...params));
}));

router.post('/halqas', h((req, res) => {
  const { name, link, teacher_id, stage, published = 1, sessions } = req.body || {};
  if (!name) return res.status(400).json({ error: 'اسم الحلقة مطلوب.' });
  const bId = branchScope(req) || req.body.branch_id || req.user.branch_id || null;
  if (teacher_id) {
    const t = db.prepare(`SELECT * FROM users WHERE id = ? AND role = 'teacher'`).get(teacher_id);
    if (!t) return res.status(404).json({ error: 'المعلمة غير موجودة.' });
    if (req.user.role === 'supervisor' && t.branch_id !== req.user.branch_id) return res.status(403).json({ error: 'المعلمة خارج نطاق فرعك.' });
  }
  const info = db.prepare('INSERT INTO halqas(name, link, branch_id, teacher_id, stage, published) VALUES (?,?,?,?,?,?)')
    .run(name, link || null, bId, teacher_id || null, stage || null, published ? 1 : 0);
  const halqaId = info.lastInsertRowid;
  if (Array.isArray(sessions)) {
    const ins = db.prepare('INSERT INTO halqa_sessions(halqa_id, day, time) VALUES (?,?,?)');
    sessions.filter((s) => s && s.day && s.time).forEach((s) => ins.run(halqaId, s.day, s.time));
  }
  res.status(201).json({ ok: true, id: halqaId, message: 'تمت إضافة الحلقة.' });
}));

router.patch('/halqas/:id', h((req, res) => {
  const halqa = db.prepare('SELECT * FROM halqas WHERE id = ?').get(req.params.id);
  if (!halqa) return res.status(404).json({ error: 'الحلقة غير موجودة.' });
  const b = branchScope(req);
  if (b && halqa.branch_id !== b) return res.status(403).json({ error: 'الحلقة خارج نطاق فرعك.' });
  const sets = []; const params = [];
  ['name', 'link', 'stage', 'teacher_id'].forEach((f) => {
    if (req.body[f] !== undefined) { sets.push(`${f} = ?`); params.push(req.body[f] === '' ? null : req.body[f]); }
  });
  if (req.body.published !== undefined) { sets.push('published = ?'); params.push(req.body.published ? 1 : 0); }
  if (req.body.active !== undefined) { sets.push('active = ?'); params.push(req.body.active ? 1 : 0); }
  if (!sets.length) return res.status(400).json({ error: 'لا توجد تغييرات.' });
  params.push(halqa.id);
  db.prepare(`UPDATE halqas SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  if (Array.isArray(req.body.sessions)) {
    db.prepare('DELETE FROM halqa_sessions WHERE halqa_id = ?').run(halqa.id);
    const ins = db.prepare('INSERT INTO halqa_sessions(halqa_id, day, time) VALUES (?,?,?)');
    req.body.sessions.filter((s) => s && s.day && s.time).forEach((s) => ins.run(halqa.id, s.day, s.time));
  }
  res.json({ ok: true, message: 'تم تحديث بيانات الحلقة.' });
}));

router.delete('/halqas/:id', h((req, res) => {
  const halqa = db.prepare('SELECT * FROM halqas WHERE id = ?').get(req.params.id);
  if (!halqa) return res.status(404).json({ error: 'الحلقة غير موجودة.' });
  const b = branchScope(req);
  if (b && halqa.branch_id !== b) return res.status(403).json({ error: 'الحلقة خارج نطاق فرعك.' });
  db.prepare('UPDATE halqas SET active = 0 WHERE id = ?').run(halqa.id);
  res.json({ ok: true, message: 'تم حذف الحلقة (إيقاف مؤقت).' });
}));

router.get('/halqas/:id/students', h((req, res) => {
  res.json(db.prepare(`SELECT u.id, u.name, u.username, u.stage, e.pinned FROM enrollments e JOIN users u ON u.id = e.student_id
    WHERE e.halqa_id = ? ORDER BY u.name`).all(req.params.id));
}));

router.post('/halqas/:id/students', h((req, res) => {
  const halqa = db.prepare('SELECT * FROM halqas WHERE id = ?').get(req.params.id);
  if (!halqa) return res.status(404).json({ error: 'الحلقة غير موجودة.' });
  const b = branchScope(req);
  if (b && halqa.branch_id !== b) return res.status(403).json({ error: 'الحلقة خارج نطاق فرعك.' });
  const student = db.prepare(`SELECT * FROM users WHERE id = ? AND role = 'student'`).get(req.body.student_id);
  if (!student) return res.status(404).json({ error: 'الطالبة غير موجودة.' });
  db.prepare('INSERT OR IGNORE INTO enrollments(halqa_id, student_id) VALUES (?,?)').run(halqa.id, student.id);
  res.status(201).json({ ok: true, message: 'تمت إضافة الطالبة إلى الحلقة.' });
}));

router.get('/sections', h((req, res) => {
  const params = [];
  const b = branchScope(req);
  let sql = `SELECT h.id, h.name, h.stage, h.link, h.published, b.name AS branch_name,
      (SELECT COUNT(*) FROM halqa_sessions s WHERE s.halqa_id = h.id) AS sessions_count,
      (SELECT group_concat(s.day || ' | ' || s.time, ' — ') FROM halqa_sessions s WHERE s.halqa_id = h.id) AS schedule
    FROM halqas h LEFT JOIN branches b ON b.id = h.branch_id WHERE h.active = 1`;
  if (b) { sql += ' AND h.branch_id = ?'; params.push(b); }
  sql += ' ORDER BY h.name';
  res.json(db.prepare(sql).all(...params));
}));

// إنشاء شعبة/حلقة مع مواعيدها ثم نشرها للطالبات
router.post('/sections', h((req, res) => {
  const { name, stage, link, sessions, published = 1 } = req.body || {};
  if (!name) return res.status(400).json({ error: 'اسم الشعبة مطلوب.' });
  const list = (Array.isArray(sessions) ? sessions : []).filter((s) => s && s.day && s.time);
  if (!list.length) return res.status(400).json({ error: 'الرجاء إضافة موعد واحد على الأقل (اليوم والوقت).' });
  const bId = branchScope(req) || req.user.branch_id || null;
  const info = db.prepare('INSERT INTO halqas(name, link, branch_id, stage, published) VALUES (?,?,?,?,?)')
    .run(name, link || null, bId, stage || null, published ? 1 : 0);
  const ins = db.prepare('INSERT INTO halqa_sessions(halqa_id, day, time) VALUES (?,?,?)');
  list.forEach((s) => ins.run(info.lastInsertRowid, s.day, s.time));
  res.status(201).json({ ok: true, id: info.lastInsertRowid, message: published ? 'تم نشر الشعبة ومَواعيدها.' : 'تم حفظ الشعبة كمسودة.' });
}));

router.get('/requests', h((req, res) => {
  const params = [];
  const b = branchScope(req);
  let sql = `SELECT r.*, u.name AS requester_name, u.username, u.role AS requester_role, u.stage, d.name AS decided_by_name
    FROM requests r JOIN users u ON u.id = r.user_id LEFT JOIN users d ON d.id = r.decided_by WHERE 1=1`;
  if (b) { sql += ' AND u.branch_id = ?'; params.push(b); }
  if (req.query.status) { sql += ' AND r.status = ?'; params.push(req.query.status); }
  sql += ' ORDER BY CASE r.status WHEN \'pending\' THEN 0 ELSE 1 END, r.created_at DESC LIMIT 500';
  res.json(db.prepare(sql).all(...params));
}));

router.patch('/requests/:id', h((req, res) => {
  const row = db.prepare(`SELECT r.*, u.branch_id FROM requests r JOIN users u ON u.id = r.user_id WHERE r.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'الطلب غير موجود.' });
  const b = branchScope(req);
  if (b && row.branch_id !== b) return res.status(403).json({ error: 'الطلب خارج نطاق فرعك.' });
  const { status, note } = req.body || {};
  if (!['accepted', 'rejected', 'pending'].includes(status)) return res.status(400).json({ error: 'حالة الطلب غير صحيحة.' });
  db.prepare(`UPDATE requests SET status = ?, decision_note = ?, decided_by = ?, decided_at = datetime('now') WHERE id = ?`)
    .run(status, note || null, req.user.id, row.id);
  res.json({ ok: true, message: status === 'accepted' ? 'تم قبول الطلب.' : 'تم رفض الطلب.' });
}));

router.get('/evaluations', h((req, res) => {
  const params = [];
  const b = branchScope(req);
  let sql = `SELECT e.*, h.name AS halqa_name, t.name AS teacher_name, u.name AS student_name, c.name AS created_by_name,
      (COALESCE(e.theory_score,0)+COALESCE(e.practical_score,0)+COALESCE(e.tasmi_score,0)+COALESCE(e.jazari_score,0)) AS total
    FROM evaluations e LEFT JOIN halqas h ON h.id = e.halqa_id LEFT JOIN users t ON t.id = h.teacher_id
    LEFT JOIN users u ON u.id = e.student_id LEFT JOIN users c ON c.id = e.created_by WHERE 1=1`;
  if (b) { sql += ' AND h.branch_id = ?'; params.push(b); }
  if (req.query.halqa_id) { sql += ' AND e.halqa_id = ?'; params.push(req.query.halqa_id); }
  sql += ' ORDER BY e.created_at DESC LIMIT 500';
  res.json(db.prepare(sql).all(...params));
}));

router.post('/evaluations', h((req, res) => {
  const { halqa_id, theory_score, practical_score, tasmi_score, jazari_score, result, notes, stage } = req.body || {};
  const halqa = db.prepare('SELECT * FROM halqas WHERE id = ?').get(halqa_id);
  if (!halqa) return res.status(404).json({ error: 'الحلقة غير موجودة.' });
  const b = branchScope(req);
  if (b && halqa.branch_id !== b) return res.status(403).json({ error: 'الحلقة خارج نطاق فرعك.' });
  const info = db.prepare(`INSERT INTO evaluations(halqa_id, teacher_id, stage, theory_score, practical_score, tasmi_score, jazari_score, result, notes, created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(halqa.id, halqa.teacher_id, stage || halqa.stage,
    Number(theory_score) || 0, Number(practical_score) || 0, Number(tasmi_score) || 0, Number(jazari_score) || 0,
    result || null, notes || null, req.user.id);
  res.status(201).json({ ok: true, id: info.lastInsertRowid, message: 'تم تسجيل نتيجة تقييم الحلقة.' });
}));

router.get('/payments', h((req, res) => {
  const params = [];
  const b = branchScope(req);
  let sql = `SELECT p.*, u.name AS student_name, u.username, u.stage, c.name AS checked_by_name FROM payments p
    JOIN users u ON u.id = p.student_id LEFT JOIN users c ON c.id = p.checked_by WHERE 1=1`;
  if (b) { sql += ' AND u.branch_id = ?'; params.push(b); }
  if (req.query.status) { sql += ' AND p.status = ?'; params.push(req.query.status); }
  if (req.query.month) { sql += ' AND p.month = ?'; params.push(req.query.month); }
  sql += ' ORDER BY p.month DESC, u.name LIMIT 500';
  res.json(db.prepare(sql).all(...params));
}));

router.patch('/payments/:id', h((req, res) => {
  const pay = db.prepare(`SELECT p.*, u.branch_id FROM payments p JOIN users u ON u.id = p.student_id WHERE p.id = ?`).get(req.params.id);
  if (!pay) return res.status(404).json({ error: 'سجل الدفع غير موجود.' });
  const b = branchScope(req);
  if (b && pay.branch_id !== b) return res.status(403).json({ error: 'السجل خارج نطاق فرعك.' });
  const { status, note, amount } = req.body || {};
  if (status && !['paid', 'unpaid', 'pending'].includes(status)) return res.status(400).json({ error: 'حالة الدفع غير صحيحة.' });
  db.prepare(`UPDATE payments SET status = COALESCE(?, status), note = COALESCE(?, note), amount = COALESCE(?, amount), checked_by = ? WHERE id = ?`)
    .run(status || null, note || null, amount === undefined ? null : Number(amount), req.user.id, pay.id);
  res.json({ ok: true, message: 'تم حفظ حالة الدفع.' });
}));

// إنشاء سجلات دفع شهرية لكل الطالبات في الفرع
router.post('/payments/generate', h((req, res) => {
  const month = req.body && req.body.month ? req.body.month : monthKey();
  const amount = Number((req.body && req.body.amount) || 0);
  const b = branchScope(req);
  const students = scopedStudents(req);
  const ins = db.prepare('INSERT INTO payments(student_id, month, amount, status) VALUES (?,?,?,?)');
  let created = 0;
  const tx = db.transaction(() => {
    for (const s of students) {
      const exists = db.prepare('SELECT id FROM payments WHERE student_id = ? AND month = ?').get(s.id, month);
      if (!exists) { ins.run(s.id, month, amount, 'unpaid'); created++; }
    }
  });
  tx();
  res.status(201).json({ ok: true, created, month, branch: b, message: created ? `تم إنشاء ${created} سجل دفع لشهر ${month}.` : 'جميع السجلات موجودة مسبقًا.' });
}));

router.get('/reports/summary', h((req, res) => {
  const students = scopedStudents(req);
  const b = branchScope(req);
  const sp = b ? [b] : [];
  const grades = db.prepare(`SELECT u.name, u.id, u.stage, g.theory_score, g.practical_score, g.created_at FROM grades g
    JOIN users u ON u.id = g.student_id WHERE u.role = 'student' ${b ? 'AND u.branch_id = ?' : ''} ORDER BY g.created_at DESC LIMIT 300`).all(...sp);
  const payments = db.prepare(`SELECT p.month, COUNT(*) AS total, SUM(CASE WHEN p.status = 'paid' THEN 1 ELSE 0 END) AS paid
    FROM payments p JOIN users u ON u.id = p.student_id ${b ? 'WHERE u.branch_id = ?' : ''} GROUP BY p.month ORDER BY p.month DESC LIMIT 12`).all(...sp);
  const attendance = db.prepare(`SELECT u.id, u.name, u.stage,
      SUM(CASE WHEN a.status IN ('present','late10') THEN 1 ELSE 0 END) AS present,
      COUNT(*) AS total
    FROM attendance a JOIN users u ON u.id = a.student_id ${b ? 'WHERE u.branch_id = ?' : ''}
    GROUP BY u.id ORDER BY (CAST(SUM(CASE WHEN a.status IN ('present','late10') THEN 1 ELSE 0 END) AS REAL) / COUNT(*)) DESC`).all(...sp);
  res.json({
    students, grades: grades.map((g) => ({ ...g, total: scoreTotal(g) })), payments,
    attendance: attendance.map((a) => ({ ...a, rate: a.total ? Math.round((a.present / a.total) * 100) : 0 })),
    meta: { stages: STAGES, days: DAYS, clinics: CLINICS, attendance_labels: ATTENDANCE_STATUS, reward_types: REWARD_TYPES }
  });
}));

module.exports = router;
