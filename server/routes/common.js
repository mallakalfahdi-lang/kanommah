'use strict';
const express = require('express');
const fs = require('fs');
const path = require('path');
const { db, UPLOAD_DIR, STAGES, ATTENDANCE_STATUS, ROLES, REWARD_TYPES, CLINICS, DAYS } = require('../db');
const { requireAuth, publicUser } = require('../auth');

const router = express.Router();

// الجهات التي يراها كل دور (الإشعارات والرسائل الجماعية)
const AUDIENCE_MAP = {
  student: ['students', 'student'],
  teacher: ['teachers', 'teacher'],
  supervisor: ['supervisors', 'supervisor'],
  admin: ['admins', 'admin']
};
function audiencesFor(role) { return ['all', ...(AUDIENCE_MAP[role] || [])]; }
function audienceFilter(role) {
  const list = audiencesFor(role);
  return { sql: `${list.map(() => '?').join(',')}`, params: list };
}

function copyTo(req, user) {
  return {
    id: user.id, username: user.username, name: user.name, role: user.role,
    role_label: ROLES[user.role], branch_id: user.branch_id, branch_name: user.branch_name || null, stage: user.stage
  };
}

router.get('/bootstrap', requireAuth, (req, res) => {
  const settings = {};
  db.prepare('SELECT key, value FROM settings').all().forEach((r) => { settings[r.key] = r.value; });
  const af = audienceFilter(req.user.role);
  const unread = db.prepare(`SELECT COUNT(*) AS c FROM messages WHERE read_at IS NULL AND from_id <> ?
    AND (to_user_id = ? OR audience IN (${af.sql}))`).get(req.user.id, req.user.id, ...af.params).c;
  const since = new Date(Date.now() - 14 * 864e5).toISOString();
  const notifCount = db.prepare(`SELECT COUNT(*) AS c FROM notifications n WHERE n.created_at >= ?
    AND (n.audience IN (${af.sql}) OR n.created_by = ?)
    AND NOT EXISTS (SELECT 1 FROM notification_reads r WHERE r.notification_id = n.id AND r.user_id = ?)`)
    .get(since, ...af.params, req.user.id, req.user.id).c;
  res.json({
    user: copyTo(req, req.user), settings, unread_messages: unread, unread_notifications: notifCount,
    meta: { stages: STAGES, attendance_status: ATTENDANCE_STATUS, roles: ROLES, reward_types: REWARD_TYPES, clinics: CLINICS, days: DAYS }
  });
});

router.get('/settings', requireAuth, (req, res) => {
  const settings = {};
  db.prepare('SELECT key, value FROM settings').all().forEach((r) => { settings[r.key] = r.value; });
  res.json(settings);
});

router.put('/settings', requireAuth, (req, res) => {
  if (!['admin', 'supervisor'].includes(req.user.role)) return res.status(403).json({ error: 'لا تملك صلاحية تعديل الإعدادات.' });
  const allowed = ['tadabbur_lesson', 'monthly_payment', 'org_name'];
  const stmt = db.prepare('INSERT INTO settings(key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  for (const key of allowed) if (req.body && req.body[key] !== undefined) stmt.run(key, String(req.body[key]));
  res.json({ ok: true, message: 'تم حفظ الإعدادات.' });
});

router.get('/notifications', requireAuth, (req, res) => {
  const af = audienceFilter(req.user.role);
  const rows = db.prepare(`SELECT n.*, u.name AS author, r.read_at IS NOT NULL AS is_read
    FROM notifications n LEFT JOIN users u ON u.id = n.created_by
    LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.user_id = ?
    WHERE n.audience IN (${af.sql}) OR n.created_by = ?
    ORDER BY n.created_at DESC LIMIT 200`).all(req.user.id, ...af.params, req.user.id);
  res.json(rows);
});

router.post('/notifications', requireAuth, (req, res) => {
  if (!['admin', 'supervisor'].includes(req.user.role)) return res.status(403).json({ error: 'لا تملك صلاحية إرسال الإشعارات.' });
  const { audience = 'all', title, body } = req.body || {};
  if (!title) return res.status(400).json({ error: 'عنوان الإشعار مطلوب.' });
  const allowed = ['all', 'students', 'teachers', 'admins', 'supervisors', 'student', 'teacher', 'admin', 'supervisor'];
  if (!allowed.includes(audience)) return res.status(400).json({ error: 'الجهة المستهدفة غير صحيحة.' });
  if (req.user.role === 'supervisor' && ['admins', 'admin'].includes(audience)) {
    return res.status(403).json({ error: 'لا تملك صلاحية إرسال إشعار للإدارة العامة.' });
  }
  const info = db.prepare('INSERT INTO notifications(audience, title, body, created_by) VALUES (?,?,?,?)')
    .run(audience, title, body || null, req.user.id);
  res.status(201).json({ ok: true, id: info.lastInsertRowid, message: 'تم إرسال الإشعار.' });
});

router.post('/notifications/:id/read', requireAuth, (req, res) => {
  db.prepare('INSERT OR IGNORE INTO notification_reads(notification_id, user_id) VALUES (?,?)').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

router.get('/messages', requireAuth, (req, res) => {
  const box = req.query.box === 'sent' ? 'sent' : 'inbox';
  let rows;
  if (box === 'sent') {
    rows = db.prepare(`SELECT m.*, u.name AS from_name, t.name AS to_name FROM messages m
      LEFT JOIN users u ON u.id = m.from_id LEFT JOIN users t ON t.id = m.to_user_id
      WHERE m.from_id = ? ORDER BY m.created_at DESC LIMIT 200`).all(req.user.id);
  } else {
    const af = audienceFilter(req.user.role);
    rows = db.prepare(`SELECT m.*, u.name AS from_name, u.role AS from_role FROM messages m
      LEFT JOIN users u ON u.id = m.from_id
      WHERE m.from_id <> ? AND (m.to_user_id = ? OR m.audience IN (${af.sql}))
      ORDER BY m.created_at DESC LIMIT 200`).all(req.user.id, req.user.id, ...af.params);
  }
  res.json(rows);
});

router.post('/messages', requireAuth, (req, res) => {
  const { audience, subject, body, to_user_id } = req.body || {};
  if (!body || !String(body).trim()) return res.status(400).json({ error: 'نص الرسالة مطلوب.' });
  const allowed = ['admin', 'supervisor', 'teacher', 'students', 'teachers', 'admins', 'supervisors', 'all', 'user'];
  if (!allowed.includes(audience)) return res.status(400).json({ error: 'الجهة الموجه إليها غير صحيحة.' });
  if (audience === 'user' && !to_user_id) return res.status(400).json({ error: 'الرجاء اختيار المستخدم.' });
  const info = db.prepare('INSERT INTO messages(from_id, audience, to_user_id, subject, body) VALUES (?,?,?,?,?)')
    .run(req.user.id, audience, audience === 'user' ? to_user_id : null, subject || null, String(body).trim());
  res.status(201).json({ ok: true, id: info.lastInsertRowid, message: 'تم إرسال الرسالة.' });
});

router.post('/messages/:id/read', requireAuth, (req, res) => {
  db.prepare('UPDATE messages SET read_at = datetime(\'now\') WHERE id = ? AND to_user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

router.get('/people', requireAuth, (req, res) => {
  if (!['admin', 'supervisor', 'teacher'].includes(req.user.role)) return res.status(403).json({ error: 'لا تملك صلاحية الوصول.' });
  const role = req.query.role;
  const q = req.query.q ? `%${req.query.q}%` : null;
  let sql = `SELECT u.id, u.name, u.username, u.role, u.stage, u.active, b.name AS branch_name, u.branch_id
    FROM users u LEFT JOIN branches b ON b.id = u.branch_id WHERE 1=1`;
  const params = [];
  if (role) { sql += ' AND u.role = ?'; params.push(role); }
  if (q) { sql += ' AND (u.name LIKE ? OR u.username LIKE ?)'; params.push(q, q); }
  if (req.user.role === 'supervisor') { sql += ' AND u.branch_id = ?'; params.push(req.user.branch_id); }
  sql += ' ORDER BY u.name LIMIT 500';
  res.json(db.prepare(sql).all(...params).map((u) => ({ ...u, role_label: ROLES[u.role] })));
});

router.get('/halqas', requireAuth, (req, res) => {
  let sql = `SELECT h.*, t.name AS teacher_name, b.name AS branch_name,
      (SELECT COUNT(*) FROM enrollments e WHERE e.halqa_id = h.id) AS students_count,
      (SELECT group_concat(s.day || ' ' || s.time, ' | ') FROM halqa_sessions s WHERE s.halqa_id = h.id) AS schedule
    FROM halqas h LEFT JOIN users t ON t.id = h.teacher_id LEFT JOIN branches b ON b.id = h.branch_id
    WHERE h.active = 1`;
  const params = [];
  if (req.user.role === 'teacher') { sql += ' AND h.teacher_id = ?'; params.push(req.user.id); }
  if (req.user.role === 'supervisor') { sql += ' AND h.branch_id = ?'; params.push(req.user.branch_id); }
  if (req.user.role === 'student') {
    sql += ` AND (h.published = 1 OR h.id IN (SELECT halqa_id FROM enrollments WHERE student_id = ?))`;
    params.push(req.user.id);
  }
  sql += ' ORDER BY h.name';
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map((h) => ({ ...h, stage: h.stage || null })));
});

router.get('/files/:name', requireAuth, (req, res) => {
  const name = path.basename(String(req.params.name));
  const file = path.join(UPLOAD_DIR, name);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'الملف غير موجود.' });
  res.sendFile(file);
});

module.exports = router;
