const express = require('express');
const { db, getSetting, setSetting } = require('./db');
const A = require('./auth');

const r = express.Router();
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const LOW = 75;
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const fail = (res, code, msg) => res.status(code).json({ error: msg });
const sid = (n) => 's' + n, tid = (n) => 't' + n, rid = (n) => 'R' + String(n).padStart(3, '0');
const num = (s, p) => { const m = new RegExp('^' + p + '(\\d+)$').exec(String(s)); return m ? Number(m[1]) : NaN; };
const wrap = (fn) => (req, res) => { try { fn(req, res); } catch (e) { console.error(e); fail(res, 500, 'Something went wrong on the server.'); } };

/* ---------- helpers ---------- */
function notify(aud, text, auto, from) {
  db.prepare('INSERT INTO notifications(ts,aud,text,sender,auto) VALUES(?,?,?,?,?)').run(Date.now(), aud, text, from || 'System', auto ? 1 : 0);
}
const inr = (n) => '₹' + Number(n).toLocaleString('en-IN');
const invoiceOf = (cls) => db.prepare('SELECT COALESCE(SUM(amount),0) t FROM fee_structure WHERE cls=?').get(cls).t;
const paidOf = (id) => db.prepare('SELECT COALESCE(SUM(amount),0) t FROM payments WHERE student_id=?').get(id).t;
const balanceOf = (s) => invoiceOf(s.cls) - paidOf(s.id);
const getStudent = (id) => db.prepare('SELECT * FROM students WHERE id=?').get(id);
function uniqueUsername(base) {
  base = (base || 'user').toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';
  let u = base, i = 1; while (db.prepare('SELECT 1 FROM users WHERE username=?').get(u)) u = base + (++i);
  return u;
}
const randomPw = () => { const c = 'abcdefghjkmnpqrstuvwxyz23456789'; let s = ''; for (let i = 0; i < 8; i++) s += c[Math.floor(Math.random() * c.length)]; return s; };
const teacherClasses = (staffId) => db.prepare('SELECT cls FROM staff_classes WHERE staff_id=?').all(staffId).map(x => x.cls);

/* ---------- public ---------- */
r.get('/public', wrap((req, res) => res.json({ school: getSetting('school_name', 'My School'), demo: getSetting('demo') === 'true' })));

r.post('/login', wrap((req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase(), password = String(req.body.password || '');
  const key = username + '|' + req.ip;
  const wait = A.checkLock(key);
  if (wait) return fail(res, 429, 'Too many failed attempts. Try again in ' + wait + ' minute(s).');
  const u = db.prepare('SELECT * FROM users WHERE username=?').get(username);
  if (!u || !A.verifyPassword(password, u.pw_hash)) {
    const n = A.noteFail(key);
    return fail(res, 401, 'The username or password is not correct' + (n < 5 ? ' (' + (5 - n) + ' attempts left).' : '.'));
  }
  A.clearFails(key);
  res.json({ token: A.makeToken(u.id), user: publicUser(u) });
}));
const publicUser = (u) => ({ role: u.role, name: u.name, username: u.username, staffId: u.staff_id ? tid(u.staff_id) : undefined, studentId: u.student_id ? sid(u.student_id) : undefined });

/* ---------- everything below needs a login ---------- */
r.use(A.requireAuth);

r.get('/me', wrap((req, res) => res.json({ user: publicUser(req.user) })));

r.post('/password', wrap((req, res) => {
  const { oldPassword, newPassword } = req.body;
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  if (!A.verifyPassword(String(oldPassword || ''), u.pw_hash)) return fail(res, 400, 'The current password is not correct.');
  if (String(newPassword || '').length < 6) return fail(res, 400, 'The new password must have at least 6 characters.');
  db.prepare('UPDATE users SET pw_hash=? WHERE id=?').run(A.hashPassword(String(newPassword)), u.id);
  res.json({ ok: true });
}));

/* ----- one call returns everything the signed-in user may see, shaped for the UI ----- */
r.get('/data', wrap((req, res) => {
  const u = req.user, role = u.role;
  const classes = db.prepare('SELECT name FROM classes ORDER BY name').all().map(x => x.name);
  let sRows = db.prepare('SELECT * FROM students ORDER BY cls, roll').all();
  const myClasses = role === 'teacher' ? teacherClasses(u.staff_id) : [];
  let myCls = null;
  if (role === 'student') { const me = getStudent(u.student_id); myCls = me.cls; sRows = [me]; }
  if (role === 'teacher') sRows = sRows.filter(s => myClasses.includes(s.cls));
  const students = sRows.map(s => ({ id: sid(s.id), name: s.name, cls: s.cls, roll: s.roll, guardian: s.guardian, phone: s.phone, active: !!s.active }));

  const staff = db.prepare('SELECT * FROM staff ORDER BY id').all().map(t => ({ id: tid(t.id), name: t.name, subject: t.subject, classes: teacherClasses(t.id) }));

  let ttRows = db.prepare('SELECT * FROM timetable').all();
  if (role === 'teacher') ttRows = ttRows.filter(x => x.staff_id === u.staff_id);
  if (role === 'student') ttRows = ttRows.filter(x => x.cls === myCls);
  const subj = Object.fromEntries(db.prepare('SELECT id, subject FROM staff').all().map(t => [t.id, t.subject]));
  const timetable = ttRows.map(x => ({ day: x.day, period: x.period, cls: x.cls, subject: subj[x.staff_id], teacher: tid(x.staff_id) }));

  let aRows = db.prepare('SELECT * FROM attendance ORDER BY date, cls').all();
  if (role === 'teacher') aRows = aRows.filter(a => myClasses.includes(a.cls));
  if (role === 'student') aRows = aRows.filter(a => a.cls === myCls);
  const marksStmt = db.prepare('SELECT student_id, status FROM attendance_marks WHERE attendance_id=?');
  const att = aRows.map(a => { const marks = {}; marksStmt.all(a.id).forEach(m => { if (role !== 'student' || m.student_id === u.student_id) marks[sid(m.student_id)] = m.status; }); return { date: a.date, cls: a.cls, marks }; });

  const fees = {};
  db.prepare('SELECT * FROM fee_structure').all().forEach(f => { if (role === 'teacher') return; if (role === 'student' && f.cls !== myCls) return; (fees[f.cls] ||= {})[f.head] = f.amount; });
  let pRows = role === 'admin' ? db.prepare('SELECT * FROM payments ORDER BY id').all() : role === 'student' ? db.prepare('SELECT * FROM payments WHERE student_id=? ORDER BY id').all(u.student_id) : [];
  const payments = pRows.map(p => ({ id: rid(p.id), sid: sid(p.student_id), amount: p.amount, date: p.date, mode: p.mode }));

  let nRows = db.prepare('SELECT * FROM notifications ORDER BY id DESC LIMIT 300').all();
  nRows = nRows.filter(n => {
    if (role === 'admin' || n.aud === 'all') return true;
    if (role === 'teacher') return n.aud === 'teachers' || (n.aud.startsWith('class:') && myClasses.includes(n.aud.slice(6)));
    return n.aud === 'students' || n.aud === 'class:' + myCls || n.aud === 'student:' + sid(u.student_id);
  });
  const notes = nRows.map(n => ({ id: n.id, ts: n.ts, aud: n.aud, text: n.text, from: n.sender, auto: !!n.auto }));
  res.json({ school: getSetting('school_name', 'My School'), classes, students, staff, timetable, att, fees, payments, notes });
}));

const admin = A.requireRole('admin');

/* ---------- settings & classes ---------- */
r.put('/settings', admin, wrap((req, res) => {
  const name = String(req.body.school || '').trim();
  if (name.length < 2 || name.length > 80) return fail(res, 400, 'Enter a school name of 2 to 80 characters.');
  setSetting('school_name', name); res.json({ ok: true });
}));
r.post('/classes', admin, wrap((req, res) => {
  const name = String(req.body.name || '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9 \-]{0,19}$/.test(name)) return fail(res, 400, 'Class names use letters, numbers, spaces or hyphens (up to 20 characters).');
  if (db.prepare('SELECT 1 FROM classes WHERE name=?').get(name)) return fail(res, 409, 'Class ' + name + ' already exists.');
  db.transaction(() => {
    db.prepare('INSERT INTO classes(name) VALUES(?)').run(name);
    const heads = db.prepare('SELECT head, amount FROM fee_structure WHERE cls=(SELECT name FROM classes WHERE name<>? ORDER BY name LIMIT 1)').all(name);
    (heads.length ? heads : [{ head: 'Tuition', amount: 0 }, { head: 'Transport', amount: 0 }, { head: 'Activity', amount: 0 }])
      .forEach(h => db.prepare('INSERT INTO fee_structure(cls,head,amount) VALUES(?,?,?)').run(name, h.head, h.amount));
  })();
  res.json({ ok: true });
}));
r.delete('/classes/:name', admin, wrap((req, res) => {
  const n = req.params.name;
  if (db.prepare('SELECT 1 FROM students WHERE cls=?').get(n)) return fail(res, 409, 'Class ' + n + ' still has students. Move or remove them first.');
  db.transaction(() => { db.prepare('DELETE FROM timetable WHERE cls=?').run(n); db.prepare('DELETE FROM staff_classes WHERE cls=?').run(n); db.prepare('DELETE FROM attendance WHERE cls=?').run(n); db.prepare('DELETE FROM fee_structure WHERE cls=?').run(n); db.prepare('DELETE FROM classes WHERE name=?').run(n); })();
  res.json({ ok: true });
}));

/* ---------- students ---------- */
function validateStudent(b, selfId) {
  const name = String(b.name || '').trim(), cls = String(b.cls || ''), roll = Number(b.roll), guardian = String(b.guardian || '').trim(), phone = String(b.phone || '').trim();
  if (!name || !guardian) return { error: 'Name and guardian are required.' };
  if (!/^\d{10}$/.test(phone)) return { error: 'The phone number must have exactly 10 digits.' };
  if (!Number.isInteger(roll) || roll <= 0) return { error: 'The roll number must be a whole number above zero.' };
  if (!db.prepare('SELECT 1 FROM classes WHERE name=?').get(cls)) return { error: 'Choose a valid class.' };
  const dup = db.prepare('SELECT id FROM students WHERE cls=? AND roll=?').get(cls, roll);
  if (dup && dup.id !== selfId) return { error: 'Roll ' + roll + ' is already used in class ' + cls + '.' };
  return { name, cls, roll, guardian, phone };
}
r.post('/students', admin, wrap((req, res) => {
  const v = validateStudent(req.body, null); if (v.error) return fail(res, 400, v.error);
  const out = db.transaction(() => {
    const id = db.prepare('INSERT INTO students(name,cls,roll,guardian,phone,active) VALUES(?,?,?,?,?,1)').run(v.name, v.cls, v.roll, v.guardian, v.phone).lastInsertRowid;
    const username = uniqueUsername(v.name.split(' ')[0]), password = randomPw();
    db.prepare('INSERT INTO users(username,pw_hash,role,name,student_id) VALUES(?,?,?,?,?)').run(username, A.hashPassword(password), 'student', v.name, id);
    return { id: sid(id), credentials: { username, password } };
  })();
  res.json(out);
}));
r.put('/students/:id', admin, wrap((req, res) => {
  const id = num(req.params.id, 's'); if (!getStudent(id)) return fail(res, 404, 'Student not found.');
  const v = validateStudent(req.body, id); if (v.error) return fail(res, 400, v.error);
  db.transaction(() => { db.prepare('UPDATE students SET name=?,cls=?,roll=?,guardian=?,phone=? WHERE id=?').run(v.name, v.cls, v.roll, v.guardian, v.phone, id); db.prepare('UPDATE users SET name=? WHERE student_id=?').run(v.name, id); })();
  res.json({ ok: true });
}));
r.patch('/students/:id/active', admin, wrap((req, res) => {
  const id = num(req.params.id, 's'); if (!getStudent(id)) return fail(res, 404, 'Student not found.');
  db.prepare('UPDATE students SET active=? WHERE id=?').run(req.body.active ? 1 : 0, id); res.json({ ok: true });
}));

/* ---------- staff ---------- */
r.post('/staff', admin, wrap((req, res) => {
  const name = String(req.body.name || '').trim(), subject = String(req.body.subject || '').trim();
  const classes = (Array.isArray(req.body.classes) ? req.body.classes : []).filter(c => db.prepare('SELECT 1 FROM classes WHERE name=?').get(c));
  if (!name || !subject) return fail(res, 400, 'Enter a name and a subject.');
  const out = db.transaction(() => {
    const id = db.prepare('INSERT INTO staff(name,subject) VALUES(?,?)').run(name, subject).lastInsertRowid;
    classes.forEach(c => db.prepare('INSERT INTO staff_classes(staff_id,cls) VALUES(?,?)').run(id, c));
    const base = name.replace(/^(Ms|Mr|Mrs|Dr)\.\s*/i, '').split(' ').pop();
    const username = uniqueUsername(base), password = randomPw();
    db.prepare('INSERT INTO users(username,pw_hash,role,name,staff_id) VALUES(?,?,?,?,?)').run(username, A.hashPassword(password), 'teacher', name, id);
    return { id: tid(id), credentials: { username, password } };
  })();
  res.json(out);
}));

/* ---------- attendance ---------- */
r.post('/attendance', A.requireRole('admin', 'teacher'), wrap((req, res) => {
  const cls = String(req.body.cls || ''), date = String(req.body.date || ''), marks = req.body.marks || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date))) return fail(res, 400, 'Choose a valid date.');
  if (Date.parse(date) > Date.now() + 36 * 3600e3) return fail(res, 400, 'Attendance cannot be recorded for a future date.');
  if (!db.prepare('SELECT 1 FROM classes WHERE name=?').get(cls)) return fail(res, 400, 'Choose a valid class.');
  if (req.user.role === 'teacher' && !teacherClasses(req.user.staff_id).includes(cls)) return fail(res, 403, 'You can only record attendance for your own classes.');
  if (db.prepare('SELECT 1 FROM attendance WHERE cls=? AND date=?').get(cls, date)) return fail(res, 409, 'Attendance is already recorded for this class and date.');
  const list = db.prepare('SELECT id, name FROM students WHERE cls=? AND active=1').all(cls);
  if (!list.length) return fail(res, 400, 'This class has no active students.');
  for (const s of list) if (!['P', 'A', 'L'].includes(marks[sid(s.id)])) return fail(res, 400, 'Mark every student as Present, Absent or Late.');
  let flagged = 0;
  db.transaction(() => {
    const aid = db.prepare('INSERT INTO attendance(cls,date) VALUES(?,?)').run(cls, date).lastInsertRowid;
    list.forEach(s => db.prepare('INSERT INTO attendance_marks(attendance_id,student_id,status) VALUES(?,?,?)').run(aid, s.id, marks[sid(s.id)]));
    list.forEach(s => {
      const t = db.prepare('SELECT COUNT(*) t, SUM(status<>\'A\') p FROM attendance_marks WHERE student_id=?').get(s.id);
      const pct = t.t ? Math.round(t.p * 100 / t.t) : null;
      if (pct !== null && pct < LOW) {
        const key = 'Low attendance alert: ' + s.name, aud = 'student:' + sid(s.id);
        const recent = db.prepare('SELECT 1 FROM notifications WHERE aud=? AND text LIKE ? AND ts > ?').get(aud, key + '%', Date.now() - 7 * 864e5);
        if (!recent) { notify(aud, key + ' is at ' + pct + '%, below the ' + LOW + '% limit. Sent to the guardian by SMS and email (simulated).', true, 'Attendance'); flagged++; }
      }
    });
  })();
  res.json({ ok: true, flagged });
}));

/* ---------- fees ---------- */
r.put('/fees/:cls', admin, wrap((req, res) => {
  const cls = req.params.cls, body = req.body.fees || {};
  const heads = db.prepare('SELECT head FROM fee_structure WHERE cls=?').all(cls).map(x => x.head);
  if (!heads.length) return fail(res, 404, 'Class not found.');
  for (const h of heads) { const v = Number(body[h]); if (!Number.isInteger(v) || v < 0) return fail(res, 400, 'Enter a whole amount (0 or more) for ' + h + '.'); }
  db.transaction(() => heads.forEach(h => db.prepare('UPDATE fee_structure SET amount=? WHERE cls=? AND head=?').run(Number(body[h]), cls, h)))();
  res.json({ ok: true });
}));
r.post('/payments', admin, wrap((req, res) => {
  const s = getStudent(num(req.body.studentId, 's')); if (!s) return fail(res, 404, 'Student not found.');
  const amount = Number(req.body.amount), mode = String(req.body.mode || '');
  if (!['Cash', 'UPI', 'Card', 'Bank transfer'].includes(mode)) return fail(res, 400, 'Choose a payment mode.');
  if (!Number.isInteger(amount) || amount <= 0) return fail(res, 400, 'Enter an amount above zero.');
  const bal = balanceOf(s);
  if (amount > bal) return fail(res, 400, 'The amount is more than the balance of ' + inr(bal) + '.');
  const out = db.transaction(() => {
    const id = db.prepare('INSERT INTO payments(student_id,amount,date,mode) VALUES(?,?,?,?)').run(s.id, amount, today(), mode).lastInsertRowid;
    notify('student:' + sid(s.id), 'Payment of ' + inr(amount) + ' received. Receipt ' + rid(id) + '. Balance ' + inr(balanceOf(s)) + '.', true, 'Fee office');
    return { id: rid(id) };
  })();
  res.json(out);
}));
r.post('/fees/remind/:id', admin, wrap((req, res) => {
  const s = getStudent(num(req.params.id, 's')); if (!s) return fail(res, 404, 'Student not found.');
  notify('student:' + sid(s.id), 'Fee reminder: ' + inr(balanceOf(s)) + ' is due for ' + s.name + '. Sent to the guardian by SMS and email (simulated).', true, 'Fee office');
  res.json({ ok: true });
}));

/* ---------- timetable ---------- */
r.post('/timetable', admin, wrap((req, res) => {
  const { cls, day } = req.body, period = Number(req.body.period), staffId = num(req.body.teacher, 't');
  if (!db.prepare('SELECT 1 FROM classes WHERE name=?').get(cls)) return fail(res, 400, 'Choose a valid class.');
  if (!DAYS.includes(day) || !(period >= 1 && period <= 6)) return fail(res, 400, 'Choose a valid day and period.');
  const t = db.prepare('SELECT * FROM staff WHERE id=?').get(staffId); if (!t) return fail(res, 400, 'Choose a teacher.');
  if (db.prepare('SELECT 1 FROM timetable WHERE cls=? AND day=? AND period=?').get(cls, day, period)) return fail(res, 409, 'Class ' + cls + ' already has a period on ' + day + ', period ' + period + '. Remove it first.');
  const clash = db.prepare('SELECT cls FROM timetable WHERE staff_id=? AND day=? AND period=?').get(staffId, day, period);
  if (clash) return fail(res, 409, t.name + ' is already teaching class ' + clash.cls + ' on ' + day + ', period ' + period + '.');
  db.transaction(() => {
    db.prepare('INSERT INTO timetable(cls,day,period,staff_id) VALUES(?,?,?,?)').run(cls, day, period, staffId);
    notify('class:' + cls, 'Timetable updated for class ' + cls + ': ' + t.subject + ' added on ' + day + ', period ' + period + '.', true, 'Timetable');
  })();
  res.json({ ok: true });
}));
r.delete('/timetable', admin, wrap((req, res) => {
  const { cls, day } = req.body, period = Number(req.body.period);
  const x = db.prepare('SELECT t.*, s.subject FROM timetable t JOIN staff s ON s.id=t.staff_id WHERE t.cls=? AND t.day=? AND t.period=?').get(cls, day, period);
  if (!x) return fail(res, 404, 'Period not found.');
  db.transaction(() => {
    db.prepare('DELETE FROM timetable WHERE cls=? AND day=? AND period=?').run(cls, day, period);
    notify('class:' + cls, 'Timetable updated for class ' + cls + ': ' + x.subject + ' removed from ' + day + ', period ' + period + '.', true, 'Timetable');
  })();
  res.json({ ok: true });
}));

/* ---------- notifications ---------- */
r.post('/notifications', A.requireRole('admin', 'teacher'), wrap((req, res) => {
  const aud = String(req.body.aud || ''), text = String(req.body.text || '').trim();
  if (!text || text.length > 400) return fail(res, 400, 'Enter a message of up to 400 characters.');
  const okAud = req.user.role === 'admin'
    ? (['all', 'teachers', 'students'].includes(aud) || (aud.startsWith('class:') && db.prepare('SELECT 1 FROM classes WHERE name=?').get(aud.slice(6))))
    : (aud.startsWith('class:') && teacherClasses(req.user.staff_id).includes(aud.slice(6)));
  if (!okAud) return fail(res, 403, 'You cannot send to that audience.');
  notify(aud, text, false, req.user.name); res.json({ ok: true });
}));

module.exports = r;
