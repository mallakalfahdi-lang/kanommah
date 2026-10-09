'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { UPLOAD_DIR, ATTENDANCE_STATUS, REWARD_TYPES, CLINICS } = require('./db');

// حفظ مرفق مُرسل كنص base64 وإرجاع اسم الملف المخزَّن
function saveBase64(dataUrl, prefix = 'file') {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const match = /^data:([\w.+-]+\/[\w.+-]+);base64,(.+)$/s.exec(dataUrl);
  const mime = match ? match[1] : null;
  const payload = match ? match[2] : dataUrl;
  if (!payload || payload.length < 8) return null;
  const buf = Buffer.from(payload, 'base64');
  if (buf.length > 6 * 1024 * 1024) throw Object.assign(new Error('حجم الملف يتجاوز 6 ميجابايت.'), { status: 413 });
  const extFromMime = { 'application/pdf': '.pdf', 'image/png': '.png', 'image/jpeg': '.jpg', 'application/zip': '.zip', 'application/msword': '.doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx' };
  const ext = (mime && extFromMime[mime]) || (mime && mime.startsWith('image/') ? '.img' : '.bin');
  const name = `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  return name;
}

const h = (fn) => (req, res, next) => {
  try { fn(req, res, next); } catch (err) { next(err); }
};

function statusLabel(code) { return ATTENDANCE_STATUS[code] || code; }
function rewardLabel(code) { return REWARD_TYPES[code] || code; }
function clinicLabel(code) { return CLINICS[code] || code; }

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function scoreTotal(row) {
  const t = Number(row.theory_score || 0);
  const p = Number(row.practical_score || 0);
  return Math.round((t + p) * 100) / 100;
}

// جلب معرّفات الطالبات المرتبطات بحلقة معيّنة
function rosterOf(halqaId) {
  return require('./db').db.prepare(`SELECT u.id, u.name, u.username, u.stage, e.pinned FROM enrollments e
    JOIN users u ON u.id = e.student_id WHERE e.halqa_id = ? ORDER BY u.name`).all(halqaId);
}

module.exports = { saveBase64, h, statusLabel, rewardLabel, clinicLabel, monthKey, scoreTotal, rosterOf };
