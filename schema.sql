-- Krillion School Management System: SQLite schema
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS classes (
  name TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS students (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  name     TEXT NOT NULL,
  cls      TEXT NOT NULL REFERENCES classes(name) ON UPDATE CASCADE,
  roll     INTEGER NOT NULL CHECK (roll > 0),
  guardian TEXT NOT NULL,
  phone    TEXT NOT NULL CHECK (length(phone) = 10),
  active   INTEGER NOT NULL DEFAULT 1,
  UNIQUE (cls, roll)
);

CREATE TABLE IF NOT EXISTS staff (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  name    TEXT NOT NULL,
  subject TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS staff_classes (
  staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  cls      TEXT NOT NULL REFERENCES classes(name) ON UPDATE CASCADE,
  PRIMARY KEY (staff_id, cls)
);

CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  username   TEXT NOT NULL UNIQUE,
  pw_hash    TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('admin','teacher','student')),
  name       TEXT NOT NULL,
  staff_id   INTEGER REFERENCES staff(id) ON DELETE CASCADE,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS timetable (
  cls      TEXT NOT NULL REFERENCES classes(name) ON UPDATE CASCADE,
  day      TEXT NOT NULL CHECK (day IN ('Mon','Tue','Wed','Thu','Fri')),
  period   INTEGER NOT NULL CHECK (period BETWEEN 1 AND 6),
  staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  PRIMARY KEY (cls, day, period),
  UNIQUE (staff_id, day, period)           -- a teacher cannot be in two places at once
);

CREATE TABLE IF NOT EXISTS attendance (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  cls  TEXT NOT NULL REFERENCES classes(name) ON UPDATE CASCADE,
  date TEXT NOT NULL,
  UNIQUE (cls, date)                       -- one record per class per day
);

CREATE TABLE IF NOT EXISTS attendance_marks (
  attendance_id INTEGER NOT NULL REFERENCES attendance(id) ON DELETE CASCADE,
  student_id    INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status        TEXT NOT NULL CHECK (status IN ('P','A','L')),
  PRIMARY KEY (attendance_id, student_id)
);

CREATE TABLE IF NOT EXISTS fee_structure (
  cls    TEXT NOT NULL REFERENCES classes(name) ON UPDATE CASCADE,
  head   TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  PRIMARY KEY (cls, head)
);

CREATE TABLE IF NOT EXISTS payments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  amount     INTEGER NOT NULL CHECK (amount > 0),
  date       TEXT NOT NULL,
  mode       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  ts     INTEGER NOT NULL,
  aud    TEXT NOT NULL,                    -- all | teachers | students | class:<name> | student:<id>
  text   TEXT NOT NULL,
  sender TEXT NOT NULL,
  auto   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_marks_student ON attendance_marks(student_id);
CREATE INDEX IF NOT EXISTS idx_pay_student   ON payments(student_id);
