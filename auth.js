'use strict';
const express = require('express');
const { db } = require('../db');
const { hashPassword, verifyPassword, createSession, destroySession, publicUser, requireAuth } = require('../auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'الرجاء إدخال اسم المستخدم وكلمة المرور.' });
  const user = db.prepare('SELECT * FROM users WHERE lower(username) = lower(?)').get(String(username).trim());
  if (!user || !verifyPassword(password, user.password_hash, user.password_salt)) {
    return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة.' });
  }
  if (!user.active) return res.status(403).json({ error: 'الحساب موقوف، الرجاء مراجعة الإدارة.' });
  const { token } = createSession(user.id);
  const branch = user.branch_id ? db.prepare('SELECT name FROM branches WHERE id = ?').get(user.branch_id) : null;
  res.json({ token, user: { ...publicUser(user), branch_name: branch ? branch.name : null } });
});

router.post('/logout', requireAuth, (req, res) => {
  destroySession(req.token);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.post('/password', requireAuth, (req, res) => {
  const { current, next } = req.body || {};
  if (!current || !next) return res.status(400).json({ error: 'الرجاء إدخال كلمة المرور الحالية والجديدة.' });
  if (String(next).length < 8) return res.status(400).json({ error: 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!verifyPassword(current, user.password_hash, user.password_salt)) {
    return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة.' });
  }
  const { hash, salt } = hashPassword(next);
  db.prepare('UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = 0 WHERE id = ?').run(hash, salt, user.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND token <> ?').run(user.id, req.token);
  res.json({ ok: true, message: 'تم تحديث كلمة المرور بنجاح.' });
});

module.exports = router;
