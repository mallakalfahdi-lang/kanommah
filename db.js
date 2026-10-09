'use strict';
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.KAN_DATA_DIR ? path.resolve(process.env.KAN_DATA_DIR) : path.join(__dirname, '..', 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'app.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const STAGES = ['سراج 1', 'سراج 2', 'سراج 3', 'سراج 4',
  'معراج 1', 'معراج 2', 'معراج 3', 'معراج 4',
  'ضياء 1', 'ضياء 2', 'ضياء 3'];

const ATTENDANCE_STATUS = {
  present: 'حاضر',
  absent: 'غائب',
  unexcused: 'غائب بدون عذر',
  excused: 'غائب بعذر',
  late10: 'متأخر عشر دقائق'
};

const ROLES = {
  student: 'طالبة',
  teacher: 'معلمة',
  supervisor: 'مشرفة (الإدارة الفرعية)',
  admin: 'الإدارة العامة'
};

const REWARD_TYPES = {
  attendance: 'تعزيزات الحضور',
  academic: 'تعزيزات التميز الدراسي',
  other: 'تعزيزات أخرى'
};

const CLINICS = { theory: 'عيادة نظرية', makharij: 'عيادة المخارج' };

const DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

module.exports = { db, DATA_DIR, UPLOAD_DIR, STAGES, ATTENDANCE_STATUS, ROLES, REWARD_TYPES, CLINICS, DAYS };
