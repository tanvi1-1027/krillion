/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const inr = n => '₹' + Number(n).toLocaleString('en-IN');
const iso = d => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth()+1).padStart(2,'0') + '-' + String(x.getDate()).padStart(2,'0'); };
const TODAY = iso(new Date());
const DAYS = ['Mon','Tue','Wed','Thu','Fri'];
const PERIODS = [1,2,3,4,5,6];
const PTIME = {1:'8:30',2:'9:20',3:'10:30',4:'11:20',5:'12:40',6:'1:30'};
const KEY = 'krillion-sms-v1';
const LOW = 75;

/* ---------- server connection ---------- */
const TKEY = 'krillion-token';
let TOKEN = null; try { TOKEN = sessionStorage.getItem(TKEY); } catch(e) {}
let DB = {school:'', classes:[], students:[], staff:[], timetable:[], att:[], fees:{}, payments:[], notes:[]};
let PUB = {school:'Your School', demo:false};
async function api(method, path, body){
  let r;
  try { r = await fetch('/api' + path, {method, headers:{'Content-Type':'application/json', ...(TOKEN ? {Authorization:'Bearer ' + TOKEN} : {})}, body: body === undefined ? undefined : JSON.stringify(body)}); }
  catch(e) { throw new Error('Cannot reach the server. Check your connection and try again.'); }
  let j = {}; try { j = await r.json(); } catch(e) {}
  if (r.status === 401 && TOKEN && path !== '/login'){ TOKEN = null; try { sessionStorage.removeItem(TKEY); } catch(e) {} S.user = null; S.err = 'Your session ended. Please log in again.'; render(); throw new Error(j.error || 'Session ended'); }
  if (!r.ok) throw new Error(j.error || 'Request failed (' + r.status + ')');
  return j;
}
async function load(){ DB = await api('GET', '/data'); }
let S = {user:null, view:'dash', q:'', cls:'', date:TODAY, err:'', att:null};

/* ---------- domain ---------- */
const stu = id => DB.students.find(s => s.id === id);
const staffOf = id => DB.staff.find(t => t.id === id);
const invoice = s => Object.values(DB.fees[s.cls] || {}).reduce((a,b) => a + Number(b), 0);
const paid = s => DB.payments.filter(p => p.sid === s.id).reduce((a,p) => a + p.amount, 0);
const balance = s => invoice(s) - paid(s);
function attStats(sid){ let t = 0, p = 0; DB.att.forEach(a => { if (a.marks[sid]) { t++; if (a.marks[sid] !== 'A') p++; } }); return {t, p, pct: t ? Math.round(p*100/t) : null}; }
function visibleNotes(){
  const u = S.user;
  return DB.notes.filter(n => {
    if (u.role === 'admin' || n.aud === 'all') return true;
    if (u.role === 'teacher') { const cl = staffOf(u.staffId).classes; return n.aud === 'teachers' || (n.aud.startsWith('class:') && cl.includes(n.aud.slice(6))); }
    const me = stu(u.studentId);
    return n.aud === 'students' || n.aud === 'class:' + me.cls || n.aud === 'student:' + me.id;
  });
}
const pill = (t, k) => `<span class="pill ${k}">${esc(t)}</span>`;
const pctBar = p => p === null ? '<span class="pill mute">No data</span>' : `<div class="row" style="margin:0;gap:8px;flex-wrap:nowrap"><div class="bar ${p < LOW ? 'low' : ''}" style="flex:1"><i style="width:${p}%"></i></div><b>${p}%</b></div>`;
const fmtDate = s => new Date(s + 'T00:00').toLocaleDateString('en-IN', {weekday:'short', day:'numeric', month:'short'});
const dayOf = s => DAYS[new Date(s + 'T00:00').getDay() - 1];
const timeAgo = ts => new Date(ts).toLocaleString('en-IN', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'});


const ICONS = {
 dash:'<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
 students:'<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.4"/><path d="M17 14c2.5 0 4.5 2 4.5 4.5"/>',
 staff:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M3 13h18"/>',
 attendance:'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M8.5 15l2.5 2.5 4.5-5"/>',
 fees:'<rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20M6 15h4"/>',
 timetable:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
 notices:'<path d="M6 9a6 6 0 0112 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9zM10 20a2 2 0 004 0"/>',
 logout:'<path d="M9 4H5a2 2 0 00-2 2v12a2 2 0 002 2h4M16 8l4 4-4 4M20 12H9"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 alert:'<path d="M12 3l10 18H2L12 3zM12 10v5M12 18h.01"/>',
 check:'<path d="M5 12.5l4.5 4.5L19 7"/>',
 settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3h0a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5h0a1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8v0a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
 key:'<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2L20 3M16 7l3 3"/>',
 rupee:'<path d="M7 5h10M7 9h10M7 5c5 0 7 1.5 7 4s-2.5 4-7 4l6 6"/>'
};
let LOGO_N = 0;
const logo = px => { const id = 'kg' + (LOGO_N++); return `<svg class="logo" width="${px}" height="${px}" viewBox="0 0 64 64" role="img" aria-label="Krillion logo"><defs><linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f8cff"/><stop offset="1" stop-color="#1a2a6c"/></linearGradient><linearGradient id="${id}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd166"/><stop offset="1" stop-color="#f08c1a"/></linearGradient><linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="url(#${id}b)"/><rect width="64" height="64" rx="16" fill="url(#${id}s)"/><path d="M26 33L45 15" stroke="#fff" stroke-width="9" stroke-linecap="round"/><path d="M26 31L45 49" stroke="url(#${id}a)" stroke-width="9" stroke-linecap="round"/><path d="M21 14v36" stroke="#fff" stroke-width="9" stroke-linecap="round"/></svg>`; };
const ico = k => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k] || ''}</svg>`;
const initials = n => n.replace(/^(Ms|Mr|Mrs|Dr)\.\s*/,'').split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
const hue = n => { let h = 0; for (const c of n) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const av = (n, lg) => `<span class="av ${lg ? 'lg' : ''}" style="background:hsl(${hue(n)} 48% 42%)" aria-hidden="true">${esc(initials(n))}</span>`;
const stat = (label, val, sub, icon, tone) => `<div class="stat tone-${tone}"><div class="ico">${ico(icon)}</div><div class="tx"><span>${label}</span><b>${val}</b><small>${sub || ''}</small></div></div>`;
const subCls = s => 'sub-' + String(s).replace(/\W/g,'');
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
const hello = (title, sub, right) => `<section class="hello"><div><h1>${title}</h1><p>${sub}</p></div>${right || `<span class="chip">${new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</span>`}</section>`;
function ring(p, label){
  const c = 2 * Math.PI * 44, v = p === null ? 0 : p, col = p !== null && p < LOW ? 'var(--bad)' : 'var(--ok)';
  return `<svg class="ring" viewBox="0 0 110 110" width="130" height="130" role="img" aria-label="${label} ${p === null ? 'no data' : p + ' percent'}"><circle cx="55" cy="55" r="44" fill="none" stroke="var(--line)" stroke-width="10"/><circle cx="55" cy="55" r="44" fill="none" stroke="${col}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${c * v / 100} ${c}" transform="rotate(-90 55 55)"/><text x="55" y="58" text-anchor="middle">${p === null ? '-' : p + '%'}</text><text class="s" x="55" y="74" text-anchor="middle">${label}</text></svg>`;
}
function trendChart(){
  const byDate = {}; DB.att.forEach(a => { const o = byDate[a.date] ||= {t:0,p:0}; Object.values(a.marks).forEach(m => { o.t++; if (m !== 'A') o.p++; }); });
  const days = Object.keys(byDate).sort().slice(-10); if (!days.length) return '<div class="empty">No attendance recorded yet.</div>';
  const W = 420, H = 190, L = 30, B = 26, T = 14, bw = (W - L - 6) / days.length;
  const y = v => T + (H - T - B) * (1 - v / 100);
  let g = [50, 75, 100].map(v => `<line x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="${v === 75 ? 'var(--t-amber)' : 'var(--line)'}" ${v === 75 ? 'stroke-dasharray="4 4"' : ''}/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('');
  const bars = days.map((d, i) => { const p = Math.round(byDate[d].p * 100 / byDate[d].t), x = L + i * bw + bw * .16, w = bw * .68, last = i === days.length - 1;
    return `<rect x="${x}" y="${y(p)}" width="${w}" height="${H - B - y(p)}" rx="4" fill="${last ? 'var(--accent)' : 'var(--t-blue-s)'}" stroke="var(--accent)" stroke-width="${last ? 0 : 1}"/><text x="${x + w / 2}" y="${H - 8}" text-anchor="middle">${d.slice(8)}</text>${last ? `<text class="val" x="${x + w / 2}" y="${y(p) - 5}" text-anchor="middle">${p}%</text>` : ''}`; }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily attendance percentage for the last ${days.length} school days">${g}${bars}</svg>`;
}

/* ---------- shell ---------- */
const NAV = {
  admin:[['dash','Dashboard'],['students','Students'],['staff','Staff'],['attendance','Attendance'],['fees','Fees'],['timetable','Timetable'],['notices','Notifications'],['settings','Settings']],
  teacher:[['dash','Dashboard'],['attendance','Mark attendance'],['timetable','My timetable'],['notices','Notices']],
  student:[['dash','Dashboard'],['attendance','My attendance'],['fees','My fees'],['timetable','Timetable'],['notices','Notifications']]};
function render(){
  const app = $('#app');
  if (!S.user){ app.innerHTML = loginView(); return; }
  const nav = NAV[S.user.role].map(([k,l]) => `<button data-act="nav" data-v="${k}" ${S.view===k?'aria-current="page"':''}>${ico(k === 'dash' ? 'dash' : k)}${l}</button>`).join('');
  app.innerHTML = `<div class="app"><aside class="side"><div class="brand"><div class="crest">${logo(36)}</div><div><b>Krillion</b><small>${esc(DB.school || PUB.school)}</small></div></div>
    <nav class="nav" aria-label="Main">${nav}</nav>
    <div class="who">${av(S.user.name, true)}<div class="meta"><b>${esc(S.user.name)}</b><span class="role">${S.user.role[0].toUpperCase()+S.user.role.slice(1)}</span></div><button class="btn sm" style="width:100%;margin-bottom:6px" data-act="pw">${ico('key')}Change password</button><button class="btn sm" style="width:100%" data-act="logout">${ico('logout')}Log out</button></div></aside>
    <main class="main">${view()}</main></div>`;
}
function view(){
  const r = S.user.role, v = S.view;
  if (v === 'dash') return r === 'admin' ? adminDash() : r === 'teacher' ? teacherDash() : studentDash();
  if (v === 'students') return studentsView();
  if (v === 'staff') return staffView();
  if (v === 'attendance') return r === 'admin' ? attAdmin() : r === 'teacher' ? attTeacher() : attStudent();
  if (v === 'fees') return r === 'admin' ? feesAdmin() : feesStudent();
  if (v === 'timetable') return ttView();
  if (v === 'notices') return noticesView();
  if (v === 'settings') return settingsView();
  return '';
}
const head = (t, sub, extra) => `<div class="top"><div><h1>${t}</h1><p>${sub || ''}</p></div><div>${extra || ''}</div></div>`;

/* ---------- login ---------- */
function loginView(){
  const art = `<svg class="art" viewBox="0 0 420 300" fill="none" aria-hidden="true"><rect x="70" y="120" width="280" height="170" rx="6" fill="rgba(255,255,255,.12)"/><path d="M50 125L210 40l160 85z" fill="rgba(255,255,255,.2)"/><rect x="185" y="190" width="50" height="100" rx="4" fill="rgba(242,169,59,.9)"/><g fill="rgba(255,255,255,.32)"><rect x="95" y="150" width="40" height="38" rx="4"/><rect x="95" y="205" width="40" height="38" rx="4"/><rect x="285" y="150" width="40" height="38" rx="4"/><rect x="285" y="205" width="40" height="38" rx="4"/></g><circle cx="210" cy="95" r="14" fill="rgba(255,255,255,.7)"/><path d="M210 40V12" stroke="rgba(255,255,255,.8)" stroke-width="3"/><path d="M210 12l28 8-28 8z" fill="#f2a93b"/></svg>`;
  return `<div class="login"><section class="hero">
    <div class="brand herobrand">${logo(60)}<b>Krillion</b></div>
    <ul><li><span>${ico('attendance')}</span>Teachers mark attendance in under a minute</li><li><span>${ico('fees')}</span>Fee balances and receipts always up to date</li><li><span>${ico('notices')}</span>Guardians alerted when attendance drops</li></ul>${art}</section>
    <div class="formside"><form class="box" id="loginForm" autocomplete="off">
    <h1>Welcome back</h1><p class="sub">Sign in to your portal.</p>
    <label for="lu">Username<input id="lu" name="u" required value="${esc(S.lu || '')}" autocapitalize="none"></label>
    <label for="lp">Password<input id="lp" name="p" type="password" required></label>
    ${S.err ? `<p class="err" role="alert">${esc(S.err)}</p>` : ''}
    <button class="btn primary" style="width:100%;padding:10px" type="submit">Log in</button>
    ${PUB.demo ? `<div class="demo"><small>Try a demo account</small>
      <button type="button" class="btn" data-act="fill" data-u="admin" data-p="admin123">${av('Administrator')}<span>Administrator<small>admin / admin123</small></span></button>
      <button type="button" class="btn" data-act="fill" data-u="rao" data-p="teach123">${av('Meera Rao')}<span>Teacher<small>rao / teach123</small></span></button>
      <button type="button" class="btn" data-act="fill" data-u="aarav" data-p="stud123">${av('Aarav Sharma')}<span>Student<small>aarav / stud123</small></span></button></div>` : ''}
    <p class="sub" style="margin-top:14px;font-size:12px">Krillion School Management System. Email and SMS notifications are simulated.</p></form></div></div>`;
}

/* ---------- dashboards ---------- */
function adminDash(){
  const act = DB.students.filter(s => s.active);
  const inv = act.reduce((a,s) => a + invoice(s), 0), pd = act.reduce((a,s) => a + paid(s), 0);
  const low = act.filter(s => { const p = attStats(s.id).pct; return p !== null && p < LOW; });
  const lastDate = DB.att.map(a => a.date).sort().pop();
  const day = DB.att.filter(a => a.date === lastDate); let t = 0, p = 0; day.forEach(a => Object.values(a.marks).forEach(m => { t++; if (m !== 'A') p++; }));
  const rate = inv ? Math.round(pd * 100 / inv) : 0, c = 2 * Math.PI * 52;
  return hello(greeting() + ', Administrator', 'Here is how the school is doing today.') + `<div class="cards">
    ${stat('Active students', act.length, DB.classes.length + ' classes', 'students', 'blue')}
    ${stat('Attendance, ' + (lastDate ? fmtDate(lastDate) : '-'), (t ? Math.round(p*100/t) : 0) + '%', 'last recorded day', 'attendance', 'green')}
    ${stat('Fees collected', inr(pd), 'of ' + inr(inv) + ' billed', 'fees', 'vio')}
    ${stat('Fees outstanding', inr(inv - pd), act.filter(s => balance(s) > 0).length + ' students', 'rupee', 'amber')}
    ${stat('Low attendance', low.length, 'below ' + LOW + '%', 'alert', low.length ? 'red' : 'green')}</div>
    <div class="grid2"><div class="panel"><h2>Attendance, last 10 school days<span class="sub">dashed line = ${LOW}%</span></h2>${trendChart()}</div>
    <div class="panel"><h2>Fee collection</h2><div class="donut"><svg viewBox="0 0 130 130" width="150" height="150" class="ring" role="img" aria-label="${rate} percent of fees collected"><circle cx="65" cy="65" r="52" fill="none" stroke="var(--line)" stroke-width="14"/><circle cx="65" cy="65" r="52" fill="none" stroke="var(--t-vio)" stroke-width="14" stroke-linecap="round" stroke-dasharray="${c * rate / 100} ${c}" transform="rotate(-90 65 65)"/><text x="65" y="70" text-anchor="middle">${rate}%</text></svg>
      <div class="legend"><div><i style="background:var(--t-vio)"></i>Collected <b>${inr(pd)}</b></div><div><i style="background:var(--line)"></i>Outstanding <b>${inr(inv - pd)}</b></div><button class="btn sm" data-act="nav" data-v="fees">Open fees</button></div></div></div></div>
    <div class="grid2"><div class="panel"><h2>Below ${LOW}% attendance</h2>${low.length ? `<div class="tw"><table><tr><th>Student</th><th>Class</th><th style="min-width:140px">Attendance</th></tr>${low.map(s => `<tr><td><div class="namecell">${av(s.name)}${esc(s.name)}</div></td><td>${s.cls}</td><td>${pctBar(attStats(s.id).pct)}</td></tr>`).join('')}</table></div>` : '<div class="empty">' + ico('check') + 'Everyone is above the threshold.</div>'}</div>
    <div class="panel"><h2>Latest notifications</h2>${feed(DB.notes.slice(0,4))}</div></div>`;
}
function teacherDash(){
  const t = staffOf(S.user.staffId), d = dayOf(TODAY);
  const mine = DB.timetable.filter(x => x.teacher === t.id && x.day === d).sort((a,b) => a.period - b.period);
  const done = t.classes.map(c => [c, DB.att.some(a => a.cls === c && a.date === TODAY)]);
  const pending = done.filter(x => !x[1]).length;
  return hello(greeting() + ', ' + esc(t.name.split(' ').slice(1).join(' ')), t.subject + ' teacher') + `<div class="cards">
    ${stat('Attendance duty', t.classes.length, 'Class ' + t.classes.join(', '), 'attendance', 'blue')}
    ${stat('Periods today', mine.length, d || 'Weekend', 'timetable', 'vio')}
    ${stat('Attendance pending', pending, pending ? 'needs your attention' : 'all recorded', pending ? 'alert' : 'check', pending ? 'amber' : 'green')}</div>
    <div class="grid2"><div class="panel"><h2>Today's attendance</h2>${done.map(([c, ok]) => `<div class="period"><div class="pn">${c}</div><div><b>Class ${c}</b><br><small style="color:var(--muted)">${DB.students.filter(s => s.cls === c && s.active).length} students</small></div><div class="pt">${ok ? pill('Recorded','ok') : `<button class="btn primary sm" data-act="goatt" data-c="${c}">Mark now</button>`}</div></div>`).join('')}</div>
    <div class="panel"><h2>Today's periods</h2>${mine.length ? mine.map(x => `<div class="period"><div class="pn">${x.period}</div><div><span class="slot ${subCls(x.subject)}"><b>${esc(x.subject)}</b><small>Class ${x.cls}</small></span></div><div class="pt">${PTIME[x.period]}</div></div>`).join('') : '<div class="empty">' + ico('timetable') + 'No periods scheduled today.</div>'}</div></div>`;
}
function studentDash(){
  const s = stu(S.user.studentId), a = attStats(s.id), d = dayOf(TODAY);
  const today = DB.timetable.filter(x => x.cls === s.cls && x.day === d).sort((x,y) => x.period - y.period);
  const inv = invoice(s), pd = paid(s), fp = inv ? Math.round(pd * 100 / inv) : 0;
  return hello(greeting() + ', ' + esc(s.name.split(' ')[0]), 'Class ' + s.cls + ' · Roll ' + s.roll) + `<div class="grid2">
    <div class="panel"><h2>Attendance</h2><div class="donut">${ring(a.pct, 'present')}<div class="legend"><div>${a.p} of ${a.t} days present</div>${a.pct !== null && a.pct < LOW ? pill('Below ' + LOW + '%','bad') : a.pct !== null ? pill('On track','ok') : ''}<button class="btn sm" data-act="nav" data-v="attendance">View history</button></div></div></div>
    <div class="panel"><h2>Fees</h2><div class="stat tone-${balance(s) > 0 ? 'amber' : 'green'}" style="border:0;padding:0;background:none"><div class="ico">${ico('fees')}</div><div class="tx"><span>Balance due</span><b>${inr(balance(s))}</b><small>${inr(pd)} paid of ${inr(inv)}</small></div></div>
      <div class="bar" style="margin:14px 0"><i style="width:${fp}%;background:var(--t-vio)"></i></div><button class="btn sm" data-act="nav" data-v="fees">View invoice</button></div></div>
    <div class="grid2"><div class="panel"><h2>Today's timetable</h2>${today.length ? today.map(x => `<div class="period"><div class="pn">${x.period}</div><div><span class="slot ${subCls(x.subject)}"><b>${esc(x.subject)}</b><small>${esc(staffOf(x.teacher).name)}</small></span></div><div class="pt">${PTIME[x.period]}</div></div>`).join('') : '<div class="empty">' + ico('timetable') + 'No classes today.</div>'}</div>
    <div class="panel"><h2>Latest notifications</h2>${feed(visibleNotes().slice(0,3))}</div></div>`;
}
const feed = list => list.length ? `<div class="feed">${list.map(n => `<div class="msg ${n.auto ? 'auto' : ''}"><small>${timeAgo(n.ts)} · ${esc(n.from)} · to ${esc(audLabel(n.aud))}${n.auto ? ' · automatic' : ''}</small><div>${esc(n.text)}</div></div>`).join('')}</div>` : '<p>No notifications.</p>';
const audLabel = a => a === 'all' ? 'everyone' : a === 'teachers' ? 'teachers' : a === 'students' ? 'students' : a.startsWith('class:') ? 'class ' + a.slice(6) : a.startsWith('student:') ? (stu(a.slice(8))?.name || 'student') : a;

/* ---------- students & staff (admin) ---------- */
function studentsView(){
  const q = S.q.toLowerCase();
  const rows = DB.students.filter(s => !q || s.name.toLowerCase().includes(q) || (s.cls + '-' + s.roll).toLowerCase().includes(q) || s.guardian.toLowerCase().includes(q));
  return head('Students', 'Admission and records (FR-STU)', '<button class="btn primary" data-act="addStu">' + ico('plus') + 'Register student</button>') +
   `<div class="panel"><div class="row"><input id="q" type="search" placeholder="Search name, class or guardian" value="${esc(S.q)}" aria-label="Search students" class="grow"><span>${rows.length} shown</span></div>
   <div class="tw"><table><tr><th>Name</th><th>Class</th><th>Roll</th><th>Guardian</th><th>Phone</th><th>Status</th><th></th></tr>
   ${rows.map(s => `<tr><td><div class="namecell">${av(s.name)}${esc(s.name)}</div></td><td>${s.cls}</td><td>${s.roll}</td><td>${esc(s.guardian)}</td><td>${esc(s.phone)}</td><td>${s.active ? pill('Active','ok') : pill('Inactive','mute')}</td>
   <td style="white-space:nowrap"><button class="btn sm" data-act="editStu" data-id="${s.id}">Edit</button> <button class="btn sm" data-act="togStu" data-id="${s.id}">${s.active ? 'Deactivate' : 'Activate'}</button></td></tr>`).join('') || '<tr><td colspan="7">No student matches the search.</td></tr>'}</table></div></div>`;
}
function stuForm(s){
  return `<label for="f_name">Full name<input id="f_name" name="name" required value="${esc(s?.name)}"></label>
  <label for="f_cls">Class<select id="f_cls" name="cls">${DB.classes.map(c => `<option ${s?.cls===c?'selected':''}>${c}</option>`).join('')}</select></label>
  <label for="f_roll">Roll number<input id="f_roll" name="roll" type="number" min="1" required value="${s?.roll ?? ''}"></label>
  <label for="f_g">Guardian name<input id="f_g" name="guardian" required value="${esc(s?.guardian)}"></label>
  <label for="f_ph">Guardian phone (10 digits)<input id="f_ph" name="phone" required inputmode="numeric" value="${esc(s?.phone)}"></label>`;
}
function staffView(){
  return head('Staff', 'Teachers and class assignments (FR-STF)', '<button class="btn primary" data-act="addStaff">' + ico('plus') + 'Add teacher</button>') +
  `<div class="panel"><div class="tw"><table><tr><th>Name</th><th>Subject</th><th>Attendance duty</th><th>Periods per week</th></tr>
  ${DB.staff.map(t => `<tr><td><div class="namecell">${av(t.name)}${esc(t.name)}</div></td><td><span class="slot ${subCls(t.subject)}" style="padding:2px 10px">${esc(t.subject)}</span></td><td>${t.classes.join(', ') || '-'}</td><td class="num">${DB.timetable.filter(x => x.teacher === t.id).length}</td></tr>`).join('')}</table></div></div>`;
}

/* ---------- attendance ---------- */
function attTeacher(){
  const t = staffOf(S.user.staffId);
  if (!t.classes.length) return head('Mark attendance') + '<div class="panel">No class is assigned to you.</div>';
  if (!t.classes.includes(S.cls)) S.cls = t.classes[0];
  const existing = DB.att.find(a => a.cls === S.cls && a.date === S.date);
  const list = DB.students.filter(s => s.cls === S.cls && s.active);
  const wk = [0,6].includes(new Date(S.date + 'T00:00').getDay());
  return head('Mark attendance', 'One record per class and day (FR-ATT-01, FR-ATT-02)') + `<div class="panel">
   <div class="row"><label for="ac" style="margin:0">Class <select id="ac" data-ch="cls">${t.classes.map(c => `<option ${c===S.cls?'selected':''}>${c}</option>`).join('')}</select></label>
   <label for="ad" style="margin:0">Date <input id="ad" type="date" max="${TODAY}" value="${S.date}" data-ch="date"></label></div>
   ${wk ? '<p class="note">This date is a weekend. Choose a school day.</p>' : existing ? `<p class="note">Attendance for ${S.cls} on ${fmtDate(S.date)} is already recorded, so it cannot be entered twice. Review it below.</p>` : ''}
   <div class="tw"><table><tr><th>Roll</th><th>Student</th><th>${existing ? 'Recorded' : 'Status'}</th></tr>
   ${list.map(s => { const m = existing?.marks[s.id];
     return `<tr><td>${s.roll}</td><td>${esc(s.name)}</td><td>${existing ? (m ? pill({P:'Present',A:'Absent',L:'Late'}[m], m==='A'?'bad':m==='L'?'warn':'ok') : '-') :
     `<div class="seg" role="radiogroup" aria-label="${esc(s.name)}">${[['P','Present'],['A','Absent'],['L','Late']].map(([v,l]) => `<label><input type="radio" name="m_${s.id}" value="${v}" ${v==='P'?'checked':''}>${l}</label>`).join('')}</div>`}</td></tr>`; }).join('')}</table></div>
   ${existing || wk ? '' : '<div class="row" style="margin-top:12px"><button class="btn primary" data-act="saveAtt">Save attendance</button><button class="btn" data-act="allP">Mark all present</button></div>'}</div>`;
}
function attAdmin(){
  const list = DB.students.filter(s => s.cls === S.cls && s.active);
  const days = DB.att.filter(a => a.cls === S.cls).length;
  return head('Attendance report', 'Class summary and low-attendance flags (FR-ATT-04)') + `<div class="panel"><div class="row"><label for="ac" style="margin:0">Class <select id="ac" data-ch="cls">${DB.classes.map(c => `<option ${c===S.cls?'selected':''}>${c}</option>`).join('')}</select></label><span>${days} days recorded</span></div>
   <div class="tw"><table><tr><th>Roll</th><th>Student</th><th class="num">Present</th><th class="num">Days</th><th style="min-width:160px">Attendance</th><th>Flag</th></tr>
   ${list.map(s => { const a = attStats(s.id); return `<tr><td>${s.roll}</td><td>${esc(s.name)}</td><td class="num">${a.p}</td><td class="num">${a.t}</td><td>${pctBar(a.pct)}</td><td>${a.pct !== null && a.pct < LOW ? pill('Below ' + LOW + '%','bad') : ''}</td></tr>`; }).join('')}</table></div></div>`;
}
function attStudent(){
  const s = stu(S.user.studentId), a = attStats(s.id);
  const rec = DB.att.filter(x => x.cls === s.cls && x.marks[s.id]).sort((x,y) => y.date.localeCompare(x.date));
  return head('My attendance', 'Class ' + s.cls) + `<div class="cards"><div class="stat"><span>Overall</span><b>${a.pct === null ? '-' : a.pct + '%'}</b><small>${a.p} of ${a.t} days</small></div></div>
  ${a.pct !== null && a.pct < LOW ? `<p class="note">Your attendance is below ${LOW}%. Your guardian has been notified.</p>` : ''}
  <div class="panel"><h2>History</h2><div class="tw"><table><tr><th>Date</th><th>Status</th></tr>${rec.map(x => { const m = x.marks[s.id]; return `<tr><td>${fmtDate(x.date)}</td><td>${pill({P:'Present',A:'Absent',L:'Late'}[m], m==='A'?'bad':m==='L'?'warn':'ok')}</td></tr>`; }).join('')}</table></div></div>`;
}

/* ---------- fees ---------- */
const feeStatus = s => { const b = balance(s); return b <= 0 ? pill('Paid','ok') : paid(s) > 0 ? pill('Partly paid','warn') : pill('Unpaid','bad'); };
function feesAdmin(){
  const list = DB.students.filter(s => s.active);
  return head('Fees', 'Fee structure, invoices and payments (FR-FEE)') +
  `<div class="panel"><h2>Fee structure</h2><div class="tw"><table><tr><th>Class</th>${Object.keys(DB.fees[DB.classes[0]] || {}).map(k => `<th class="num">${k}</th>`).join('')}<th class="num">Total</th><th></th></tr>
  ${DB.classes.map(c => `<tr><td>${c}</td>${Object.values(DB.fees[c]).map(v => `<td class="num">${inr(v)}</td>`).join('')}<td class="num"><b>${inr(Object.values(DB.fees[c]).reduce((a,b) => a + b, 0))}</b></td><td><button class="btn sm" data-act="editFee" data-c="${c}">Edit</button></td></tr>`).join('')}</table></div></div>
  <div class="panel"><h2>Student accounts</h2><div class="tw"><table><tr><th>Student</th><th>Class</th><th class="num">Invoice</th><th class="num">Paid</th><th class="num">Balance</th><th>Status</th><th></th></tr>
  ${list.map(s => `<tr><td>${esc(s.name)}</td><td>${s.cls}</td><td class="num">${inr(invoice(s))}</td><td class="num">${inr(paid(s))}</td><td class="num">${inr(balance(s))}</td><td>${feeStatus(s)}</td>
  <td style="white-space:nowrap">${balance(s) > 0 ? `<button class="btn sm" data-act="pay" data-id="${s.id}">Record payment</button> <button class="btn sm" data-act="remind" data-id="${s.id}">Remind</button>` : ''} ${paid(s) > 0 ? `<button class="btn sm" data-act="hist" data-id="${s.id}">Receipts</button>` : ''}</td></tr>`).join('')}</table></div></div>`;
}
function feesStudent(){
  const s = stu(S.user.studentId), pays = DB.payments.filter(p => p.sid === s.id);
  return head('My fees', 'Class ' + s.cls) + `<div class="cards"><div class="stat"><span>Invoice</span><b>${inr(invoice(s))}</b></div><div class="stat"><span>Paid</span><b>${inr(paid(s))}</b></div><div class="stat"><span>Balance</span><b>${inr(balance(s))}</b><small>${feeStatus(s)}</small></div></div>
  <div class="panel"><h2>Invoice</h2><div class="tw"><table>${Object.entries(DB.fees[s.cls]).map(([k,v]) => `<tr><td>${k}</td><td class="num">${inr(v)}</td></tr>`).join('')}<tr><td><b>Total</b></td><td class="num"><b>${inr(invoice(s))}</b></td></tr></table></div></div>
  <div class="panel"><h2>Payment history</h2>${pays.length ? `<div class="tw"><table><tr><th>Receipt</th><th>Date</th><th>Mode</th><th class="num">Amount</th></tr>${pays.map(p => `<tr><td>${p.id}</td><td>${fmtDate(p.date)}</td><td>${p.mode}</td><td class="num">${inr(p.amount)}</td></tr>`).join('')}</table></div>` : '<p>No payment recorded yet.</p>'}</div>`;
}
const receiptText = p => { const s = stu(p.sid); return `${DB.school.toUpperCase()}\nFEE RECEIPT ${p.id}\n------------------------------\nStudent : ${s.name}\nClass   : ${s.cls}  Roll ${s.roll}\nDate    : ${p.date}\nMode    : ${p.mode}\nAmount  : ${inr(p.amount)}\nBalance : ${inr(balance(s))} (after all payments)\n------------------------------\nThank you.`; };

/* ---------- timetable ---------- */
function ttView(){
  const r = S.user.role; let cells, title, sub = '';
  if (r === 'teacher'){ const t = staffOf(S.user.staffId); cells = (d,p) => DB.timetable.find(x => x.day === d && x.period === p && x.teacher === t.id); title = 'My timetable'; }
  else { const c = r === 'student' ? stu(S.user.studentId).cls : S.cls; cells = (d,p) => DB.timetable.find(x => x.day === d && x.period === p && x.cls === c); title = r === 'student' ? 'Timetable, class ' + c : 'Timetable'; }
  const adm = r === 'admin';
  return head(title, adm ? 'Teacher double-booking is blocked (FR-TT-02)' : '', adm ? '<button class="btn primary" data-act="addSlot">' + ico('plus') + 'Add period</button>' : '') +
  `<div class="panel">${adm ? `<div class="row"><label for="ac" style="margin:0">Class <select id="ac" data-ch="cls">${DB.classes.map(c => `<option ${c===S.cls?'selected':''}>${c}</option>`).join('')}</select></label></div>` : ''}
  <div class="tw"><table class="tt"><tr><th>Period</th>${DAYS.map(d => `<th class="${d === dayOf(TODAY) ? 'today' : ''}">${d}${d === dayOf(TODAY) ? '<span class="today-tag">TODAY</span>' : ''}</th>`).join('')}</tr>
  ${PERIODS.map(p => `<tr><th>${p}<br><small>${PTIME[p]}</small></th>${DAYS.map(d => { const x = cells(d,p);
    return `<td class="${d === dayOf(TODAY) ? 'today' : ''}">${x ? `<span class="slot ${subCls(x.subject)}"><b>${esc(x.subject)}</b><small>${r === 'teacher' ? 'Class ' + x.cls : esc(staffOf(x.teacher).name)}</small></span>${adm ? `<br><button class="btn sm danger" style="margin-top:4px" data-act="delSlot" data-d="${d}" data-p="${p}" data-c="${x.cls}">Remove</button>` : ''}` : '<span class="free">Free</span>'}</td>`; }).join('')}</tr>`).join('')}</table></div></div>`;
}

/* ---------- notifications ---------- */
function noticesView(){
  const r = S.user.role, can = r !== 'student';
  const audOpts = r === 'admin' ? [['all','Everyone'],['teachers','Teachers'],['students','All students'],...DB.classes.map(c => ['class:' + c, 'Class ' + c])] : staffOf(S.user.staffId).classes.map(c => ['class:' + c, 'Class ' + c]);
  return head('Notifications', r === 'admin' ? 'Announcements and automatic alerts (FR-NOT)' : r === 'teacher' ? 'Send notices to your classes' : '') +
  (can ? `<div class="panel"><h2>${r === 'admin' ? 'New announcement' : 'New class notice'}</h2><form id="noteForm"><label for="na">Send to<select id="na" name="aud">${audOpts.map(([v,l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
   <label for="nt">Message<textarea id="nt" name="text" rows="3" maxlength="400" required></textarea></label><button class="btn primary" type="submit">Send</button> <small style="color:var(--muted)">Email/SMS delivery is simulated.</small></form></div>` : '') +
  `<div class="panel"><h2>Inbox</h2>${feed(visibleNotes())}</div>`;
}

/* ---------- settings (admin) ---------- */
function settingsView(){
  return head('Settings', 'School details and classes') +
  `<div class="panel"><h2>School</h2><form id="schoolForm"><label for="sn">School name<input id="sn" name="school" required maxlength="80" value="${esc(DB.school)}"></label><button class="btn primary" type="submit">Save name</button></form></div>
   <div class="panel"><h2>Classes</h2><div class="tw"><table><tr><th>Class</th><th>Students</th><th></th></tr>
   ${DB.classes.map(c => { const n = DB.students.filter(s => s.cls === c).length; return `<tr><td>${esc(c)}</td><td>${n}</td><td>${n ? '' : `<button class="btn sm" data-act="delCls" data-c="${esc(c)}">Remove</button>`}</td></tr>`; }).join('') || '<tr><td colspan="3">No classes yet. Add your first class below.</td></tr>'}</table></div>
   <form id="classForm" class="row" style="margin-top:12px"><input name="name" required maxlength="20" placeholder="New class, e.g. 9-A" aria-label="New class name" class="grow"><button class="btn primary" type="submit">${ico('plus')}Add class</button></form></div>`;
}

/* ---------- modal ---------- */
let modalSubmit = null;
function openModal(title, body, onSubmit, okLabel){
  modalSubmit = onSubmit;
  const o = document.createElement('div'); o.className = 'overlay'; o.id = 'ov';
  o.innerHTML = `<form class="modal" id="mf" role="dialog" aria-modal="true" aria-labelledby="mt"><h2 id="mt">${title}</h2>${body}<p class="err" id="merr" role="alert"></p><div class="acts"><button type="button" class="btn" data-act="close">${onSubmit ? 'Cancel' : 'Close'}</button>${onSubmit ? `<button class="btn primary" type="submit">${okLabel || 'Save'}</button>` : ''}</div></form>`;
  document.body.appendChild(o);
  const f = o.querySelector('input,select,textarea'); if (f) f.focus();
}
const closeModal = () => { $('#ov')?.remove(); modalSubmit = null; };
const merr = t => { $('#merr').textContent = t; };
function toast(t){ const e = document.createElement('div'); e.className = 'toast'; e.setAttribute('role','status'); e.textContent = t; document.body.appendChild(e); setTimeout(() => e.remove(), 2800); }
const go = async () => { try { await load(); } catch(e) { return; } render(); };
async function run(fn){ try { await fn(); } catch(e) { if ($('#merr')) merr(e.message); else toast(e.message); } }
const credsModal = (title, c) => openModal(title, `<p>Share these sign-in details with the user. The password is shown only once.</p><div class="receipt">Username: ${esc(c.username)}\nPassword: ${esc(c.password)}</div>`, null);

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const d = b.dataset, a = d.act;
  if (a === 'close') return closeModal();
  if (a === 'fill'){ $('#lu').value = d.u; $('#lp').value = d.p; return; }
  if (a === 'nav'){ S.view = d.v; S.q = ''; return render(); }
  if (a === 'logout'){ TOKEN = null; try { sessionStorage.removeItem(TKEY); } catch(x) {} S.user = null; S.err = ''; DB = {school:'', classes:[], students:[], staff:[], timetable:[], att:[], fees:{}, payments:[], notes:[]}; return render(); }
  if (a === 'goatt'){ S.view = 'attendance'; S.cls = d.c; S.date = TODAY; return render(); }
  if (a === 'pw') return openModal('Change password', `<label for="o_p">Current password<input id="o_p" name="old" type="password" required autocomplete="current-password"></label><label for="n_p">New password (6+ characters)<input id="n_p" name="neu" type="password" required minlength="6" autocomplete="new-password"></label>`,
     f => run(async () => { await api('POST', '/password', {oldPassword:f.old.value, newPassword:f.neu.value}); closeModal(); toast('Password changed'); }), 'Change');
  if (a === 'addStu') return openModal('Register student', stuForm(null), f => saveStu(f, null), 'Register');
  if (a === 'editStu'){ const s = stu(d.id); return openModal('Edit student', stuForm(s), f => saveStu(f, s)); }
  if (a === 'togStu') return run(async () => { const s = stu(d.id); await api('PATCH', '/students/' + s.id + '/active', {active: !s.active}); toast(s.name + (s.active ? ' deactivated' : ' activated')); await go(); });
  if (a === 'addStaff') return openModal('Add teacher', `<label for="t_n">Name<input id="t_n" name="name" required></label><label for="t_s">Subject<input id="t_s" name="subject" required></label>
     <fieldset style="border:0;padding:0;margin:0 0 10px"><legend style="font-size:13px;color:var(--muted)">Attendance duty</legend>${DB.classes.map(c => `<label style="display:inline-block;margin-right:12px;color:var(--text)"><input type="checkbox" name="cls" value="${esc(c)}" style="width:auto"> ${esc(c)}</label>`).join('')}</fieldset>`,
     f => run(async () => { const name = f.name.value.trim(), subject = f.subject.value.trim(); if (!name || !subject) return merr('Enter a name and a subject.');
       const r = await api('POST', '/staff', {name, subject, classes:[...f.querySelectorAll('[name=cls]:checked')].map(x => x.value)}); closeModal(); await go(); credsModal('Teacher added', r.credentials); }), 'Add');
  if (a === 'saveAtt') return run(saveAtt);
  if (a === 'allP'){ document.querySelectorAll('input[type=radio][value=P]').forEach(r => r.checked = true); return; }
  if (a === 'editFee'){ const c = d.c; return openModal('Fee structure, class ' + esc(c), Object.entries(DB.fees[c]).map(([k,v]) => `<label for="fe_${esc(k)}">${esc(k)} (₹)<input id="fe_${esc(k)}" name="${esc(k)}" type="number" min="0" step="1" required value="${v}"></label>`).join(''),
     f => run(async () => { const nf = {}; for (const k of Object.keys(DB.fees[c])) nf[k] = Number(f[k].value); await api('PUT', '/fees/' + encodeURIComponent(c), {fees:nf}); toast('Fee structure updated'); closeModal(); await go(); })); }
  if (a === 'pay'){ const s = stu(d.id), bal = balance(s);
    return openModal('Record payment', `<p><b>${esc(s.name)}</b> (${esc(s.cls)}) owes ${inr(bal)}. Partial payments are allowed.</p><label for="p_a">Amount (₹)<input id="p_a" name="amount" type="number" min="1" max="${bal}" step="1" required value="${bal}"></label>
      <label for="p_m">Mode<select id="p_m" name="mode"><option>Cash</option><option>UPI</option><option>Card</option><option>Bank transfer</option></select></label>`,
      f => run(async () => { const amt = Number(f.amount.value); if (!(amt > 0)) return merr('Enter an amount above zero.'); if (amt > bal) return merr('The amount is more than the balance of ' + inr(bal) + '.');
        const r = await api('POST', '/payments', {studentId:s.id, amount:amt, mode:f.mode.value}); closeModal(); await go(); showReceipt(DB.payments.find(p => p.id === r.id)); }), 'Save payment'); }
  if (a === 'remind') return run(async () => { await api('POST', '/fees/remind/' + d.id); toast('Reminder sent (simulated)'); await go(); });
  if (a === 'hist'){ const s = stu(d.id); return openModal('Receipts, ' + esc(s.name), DB.payments.filter(p => p.sid === s.id).map(p => `<div class="row"><span>${p.id} · ${fmtDate(p.date)} · ${inr(p.amount)}</span><button type="button" class="btn sm" data-act="rcpt" data-id="${p.id}">View</button></div>`).join(''), null); }
  if (a === 'rcpt'){ closeModal(); return showReceipt(DB.payments.find(p => p.id === d.id)); }
  if (a === 'copy'){ try { navigator.clipboard.writeText(d.t.replace(/\\n/g, '\n')).then(() => toast('Receipt copied'), () => toast('Copy was blocked')); } catch(x) { toast('Copy was blocked'); } return; }
  if (a === 'addSlot') return openModal('Add period', `<label for="s_c">Class<select id="s_c" name="cls">${DB.classes.map(c => `<option ${c===S.cls?'selected':''}>${esc(c)}</option>`).join('')}</select></label>
     <label for="s_d">Day<select id="s_d" name="day">${DAYS.map(x => `<option>${x}</option>`).join('')}</select></label>
     <label for="s_p">Period<select id="s_p" name="period">${PERIODS.map(x => `<option>${x}</option>`).join('')}</select></label>
     <label for="s_t">Teacher<select id="s_t" name="teacher">${DB.staff.map(t => `<option value="${t.id}">${esc(t.name)} (${esc(t.subject)})</option>`).join('')}</select></label>`,
     f => run(async () => { const cls = f.cls.value; await api('POST', '/timetable', {cls, day:f.day.value, period:Number(f.period.value), teacher:f.teacher.value}); S.cls = cls; toast('Period added and class notified'); closeModal(); await go(); }), 'Add period');
  if (a === 'delSlot') return run(async () => { await api('DELETE', '/timetable', {cls:d.c, day:d.d, period:Number(d.p)}); toast('Period removed'); await go(); });
  if (a === 'delCls') return run(async () => { await api('DELETE', '/classes/' + encodeURIComponent(d.c)); toast('Class removed'); await go(); });
});
function showReceipt(p){ const t = receiptText(p); openModal('Receipt ' + p.id, `<div class="receipt">${esc(t)}</div><div class="row" style="margin-top:10px"><button type="button" class="btn sm" data-act="copy" data-t="${esc(t.replace(/\n/g,'\\n'))}">Copy receipt text</button></div>`, null); }
function saveStu(f, s){
  const body = {name:f.name.value.trim(), cls:f.cls.value, roll:Number(f.roll.value), guardian:f.guardian.value.trim(), phone:f.phone.value.trim()};
  return run(async () => {
    if (!body.name || !body.guardian) return merr('Name and guardian are required.');
    if (!/^\d{10}$/.test(body.phone)) return merr('The phone number must have exactly 10 digits.');
    if (!(body.roll > 0)) return merr('The roll number must be above zero.');
    if (s){ await api('PUT', '/students/' + s.id, body); toast('Student updated'); closeModal(); return go(); }
    const r = await api('POST', '/students', body); closeModal(); await go(); credsModal('Student registered', r.credentials);
  });
}
async function saveAtt(){
  const marks = {};
  DB.students.filter(s => s.cls === S.cls && s.active).forEach(s => { marks[s.id] = document.querySelector(`input[name="m_${s.id}"]:checked`).value; });
  const r = await api('POST', '/attendance', {cls:S.cls, date:S.date, marks});
  toast('Attendance saved' + (r.flagged ? ', ' + r.flagged + ' low-attendance alert' + (r.flagged > 1 ? 's' : '') + ' sent' : '')); await go();
}
async function startSession(u){
  S.user = u; S.err = ''; S.view = 'dash'; S.date = TODAY;
  await load();
  if (u.role === 'teacher') S.cls = staffOf(u.staffId)?.classes[0] || DB.classes[0] || '';
  else S.cls = DB.classes[0] || '';
  render();
}
document.addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  if (f.id === 'loginForm'){
    try { const r = await api('POST', '/login', {username:f.u.value.trim(), password:f.p.value}); TOKEN = r.token; try { sessionStorage.setItem(TKEY, TOKEN); } catch(x) {} await startSession(r.user); }
    catch(x) { S.err = x.message; S.lu = f.u.value; render(); }
    return;
  }
  if (f.id === 'mf' && modalSubmit) return modalSubmit(f);
  if (f.id === 'noteForm'){
    const text = f.text.value.trim(); if (!text) return;
    try { await api('POST', '/notifications', {aud:f.aud.value, text}); toast('Sent (simulated delivery)'); S.view = 'notices'; await go(); } catch(x) { toast(x.message); }
    return;
  }
  if (f.id === 'schoolForm'){ try { await api('PUT', '/settings', {school:f.school.value}); toast('School name saved'); await go(); } catch(x) { toast(x.message); } return; }
  if (f.id === 'classForm'){ try { await api('POST', '/classes', {name:f.name.value}); toast('Class added'); await go(); } catch(x) { toast(x.message); } return; }
});
document.addEventListener('change', e => {
  const c = e.target.dataset.ch; if (!c) return;
  S[c] = e.target.value; render();
});
document.addEventListener('input', e => {
  if (e.target.id === 'q'){ S.q = e.target.value; const pos = e.target.selectionStart; render(); const q = $('#q'); q.focus(); q.setSelectionRange(pos, pos); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/* ---------- start ---------- */
(async function boot(){
  try { PUB = await api('GET', '/public'); document.title = 'Krillion - ' + PUB.school; } catch(e) {}
  if (TOKEN){ try { const r = await api('GET', '/me'); await startSession(r.user); return; } catch(e) { TOKEN = null; } }
  render();
})();
