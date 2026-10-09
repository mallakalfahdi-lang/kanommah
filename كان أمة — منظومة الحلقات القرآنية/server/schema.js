'use strict';
const { db } = require('./db');

db.exec(`
CREATE TABLE IF NOT EXISTS branches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  city TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('student','teacher','supervisor','admin')),
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  stage TEXT,
  branch_id INTEGER REFERENCES branches(id),
  must_change_password INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS halqas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  link TEXT,
  branch_id INTEGER REFERENCES branches(id),
  teacher_id INTEGER REFERENCES users(id),
  stage TEXT,
  published INTEGER DEFAULT 1,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS halqa_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  halqa_id INTEGER NOT NULL REFERENCES halqas(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  time TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  halqa_id INTEGER NOT NULL REFERENCES halqas(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active',
  pinned INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE (halqa_id, student_id)
);

CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  halqa_id INTEGER REFERENCES halqas(id),
  date TEXT NOT NULL,
  status TEXT NOT NULL,
  minutes_late INTEGER DEFAULT 0,
  note TEXT,
  recorded_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id, date);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS grades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stage TEXT,
  theory_score REAL,
  practical_score REAL,
  max_theory REAL DEFAULT 50,
  max_practical REAL DEFAULT 50,
  notes TEXT,
  recorded_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS recitation_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  surah TEXT,
  ayah_from TEXT,
  ayah_to TEXT,
  kind TEXT DEFAULT 'note',
  note TEXT,
  recorded_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  clinic TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  note TEXT,
  decision_note TEXT,
  decided_by INTEGER REFERENCES users(id),
  decided_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT,
  points INTEGER DEFAULT 0,
  note TEXT,
  given_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'pending',
  decision_note TEXT,
  decided_by INTEGER REFERENCES users(id),
  decided_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  amount REAL DEFAULT 0,
  receipt_path TEXT,
  status TEXT DEFAULT 'unpaid',
  note TEXT,
  checked_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_id INTEGER NOT NULL REFERENCES users(id),
  audience TEXT NOT NULL,
  to_user_id INTEGER REFERENCES users(id),
  subject TEXT,
  body TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  audience TEXT NOT NULL DEFAULT 'all',
  title TEXT NOT NULL,
  body TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notification_reads (
  notification_id INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (notification_id, user_id)
);

CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  level TEXT DEFAULT 'notice',
  title TEXT NOT NULL,
  note TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  halqa_id INTEGER REFERENCES halqas(id),
  title TEXT NOT NULL,
  description TEXT,
  kind TEXT DEFAULT 'homework',
  due_date TEXT,
  attachment_path TEXT,
  published INTEGER DEFAULT 0,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activity_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note TEXT,
  link TEXT,
  file_path TEXT,
  grade REAL,
  feedback TEXT,
  status TEXT DEFAULT 'submitted',
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE (activity_id, student_id)
);

CREATE TABLE IF NOT EXISTS evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  halqa_id INTEGER REFERENCES halqas(id),
  student_id INTEGER REFERENCES users(id),
  teacher_id INTEGER REFERENCES users(id),
  stage TEXT,
  theory_score REAL,
  practical_score REAL,
  tasmi_score REAL,
  jazari_score REAL,
  result TEXT,
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
`);

db.prepare(`INSERT OR IGNORE INTO settings(key, value) VALUES ('tadabbur_lesson', ?)`)
  .run('كل يوم أحد — 5:00 مساءً');
db.prepare(`INSERT OR IGNORE INTO settings(key, value) VALUES ('monthly_payment', ?)`)
  .run('الدفع الشهري قبل اليوم الخامس من كل شهر');
db.prepare(`INSERT OR IGNORE INTO settings(key, value) VALUES ('org_name', ?)`)
  .run('كان أمة');

module.exports = {};
