const { db, getSetting, setSetting } = require('./db');
const { hashPassword } = require('./auth');

const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function seedAll() {
  if (getSetting('seeded')) return;
  const demo = String(process.env.DEMO_DATA || 'true').toLowerCase() !== 'false';
  const addUser = db.prepare('INSERT INTO users(username,pw_hash,role,name,staff_id,student_id) VALUES(?,?,?,?,?,?)');
  const tx = db.transaction(() => {
    setSetting('school_name', demo ? 'My School' : 'My School');
    addUser.run('admin', hashPassword(demo ? 'admin123' : (process.env.ADMIN_PASSWORD || 'admin123')), 'admin', 'Administrator', null, null);
    if (!demo) { setSetting('demo', 'false'); return; }
    setSetting('demo', 'true');

    const classes = ['8-A', '8-B'];
    classes.forEach(c => db.prepare('INSERT INTO classes(name) VALUES(?)').run(c));
    const names = [['Aarav Sharma', 'Diya Nair', 'Kabir Singh', 'Meera Iyer', 'Rohan Gupta', 'Sana Khan'],
                   ['Ishaan Patel', 'Tara Menon', 'Vihaan Joshi', 'Anaya Das', 'Neil Fernandes', 'Zoya Ahmed']];
    const insStu = db.prepare('INSERT INTO students(name,cls,roll,guardian,phone,active) VALUES(?,?,?,?,?,1)');
    let n = 1; const students = [];
    classes.forEach((c, ci) => names[ci].forEach((nm, i) => {
      const id = insStu.run(nm, c, i + 1, 'Guardian of ' + nm.split(' ')[0], '98' + String(10000000 + n * 137911).slice(0, 8)).lastInsertRowid;
      students.push({ id, cls: c, name: nm }); n++;
    }));
    const insStaff = db.prepare('INSERT INTO staff(name,subject) VALUES(?,?)');
    const insSC = db.prepare('INSERT INTO staff_classes(staff_id,cls) VALUES(?,?)');
    const staffDefs = [['Ms. Meera Rao', 'Mathematics', ['8-A']], ['Mr. Imran Qureshi', 'Science', ['8-B']], ['Mrs. Anita Desai', 'English', ['8-A', '8-B']], ['Mr. Rohan Mehta', 'Social Studies', ['8-B']]];
    const staff = staffDefs.map(([nm, sub, cl]) => { const id = insStaff.run(nm, sub).lastInsertRowid; cl.forEach(c => insSC.run(id, c)); return id; });

    addUser.run('rao', hashPassword('teach123'), 'teacher', 'Ms. Meera Rao', staff[0], null);
    addUser.run('aarav', hashPassword('stud123'), 'student', 'Aarav Sharma', null, students[0].id);

    const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const insTT = db.prepare('INSERT INTO timetable(cls,day,period,staff_id) VALUES(?,?,?,?)');
    classes.forEach((c, ci) => DAYS.forEach((d, di) => [1, 2, 3, 4].forEach(p => insTT.run(c, d, p, staff[(di + p + ci * 2) % 4]))));

    const r = rng(42), prop = { 4: .66, 9: .62 };
    const insAtt = db.prepare('INSERT INTO attendance(cls,date) VALUES(?,?)'), insMark = db.prepare('INSERT INTO attendance_marks(attendance_id,student_id,status) VALUES(?,?,?)');
    const d = new Date(); let made = 0;
    while (made < 12) {
      d.setDate(d.getDate() - 1); if (d.getDay() === 0 || d.getDay() === 6) continue;
      classes.forEach(c => { const aid = insAtt.run(c, iso(d)).lastInsertRowid;
        students.filter(s => s.cls === c).forEach(s => { const v = r(), p = prop[s.id] ?? .93; insMark.run(aid, s.id, v < p ? 'P' : (v < p + .03 ? 'L' : 'A')); }); });
      made++;
    }
    const insFee = db.prepare('INSERT INTO fee_structure(cls,head,amount) VALUES(?,?,?)');
    classes.forEach(c => { insFee.run(c, 'Tuition', 24000); insFee.run(c, 'Transport', 6000); insFee.run(c, 'Activity', 2000); });
    const insPay = db.prepare('INSERT INTO payments(student_id,amount,date,mode) VALUES(?,?,?,?)');
    [[1, 32000, 20, 'UPI'], [2, 16000, 15, 'Cash'], [5, 32000, 9, 'Card'], [7, 10000, 5, 'UPI']].forEach(([s, a, ago, m]) => insPay.run(s, a, iso(new Date(Date.now() - ago * 864e5)), m));
    const insN = db.prepare('INSERT INTO notifications(ts,aud,text,sender,auto) VALUES(?,?,?,?,0)');
    insN.run(Date.now() - 3 * 864e5, 'all', 'Annual Day rehearsals begin next Monday. Please check your class timetable for changes.', 'Administrator');
    insN.run(Date.now() - 864e5, 'teachers', 'Staff meeting on Friday after school in the library.', 'Administrator');
  });
  tx();
  setSetting('seeded', '1');
}
module.exports = { seedAll };
