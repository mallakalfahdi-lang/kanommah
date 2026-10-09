'use strict';
const crypto = require('crypto');
const { db } = require('./db');

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  const candidate = crypto.scryptSync(String(password), salt, 64);
  const expected = Buffer.from(hash, 'hex');
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

const SESSION_DAYS = 14;

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  db.prepare('INSERT INTO sessions(token, user_id, expires_at) VALUES (?,?,?)').run(token, userId, expires);
  return { token, expires };
}

function destroySession(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

function publicUser(u) {
  if (!u) return null;
  const { password_hash, password_salt, ...rest } = u;
  return rest;
}

function attachUser(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : (req.query.token || null);
  req.token = token;
  req.user = null;
  if (token) {
    const row = db.prepare(`SELECT u.*, s.token AS session_token, s.expires_at, b.name AS branch_name
      FROM sessions s JOIN users u ON u.id = s.user_id
      LEFT JOIN branches b ON b.id = u.branch_id
      WHERE s.token = ?`).get(token);
    if (row && new Date(row.expires_at) > new Date() && row.active) req.user = row;
    else if (row) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'الجلسة منتهية، الرجاء تسجيل الدخول من جديد.' });
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'الجلسة منتهية، الرجاء تسجيل الدخول من جديد.' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'لا تملك صلاحية الوصول إلى هذه الصفحة.' });
    next();
  };
}

// المشرفة مقيّدة بفرعها، الإدارة العامة ترى كل الفروع
function scopedBranchId(user) {
  return user.role === 'admin' ? null : user.branch_id;
}

module.exports = { hashPassword, verifyPassword, createSession, destroySession, publicUser, attachUser, requireAuth, requireRole, scopedBranchId };
