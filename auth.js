const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { db, file } = require('./db');

// Signing secret: env var, otherwise a random one stored next to the database.
function loadSecret() {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET !== 'change-me-to-a-long-random-string') return process.env.JWT_SECRET;
  const f = path.join(path.dirname(file), '.secret');
  try { return fs.readFileSync(f, 'utf8'); } catch (e) {}
  const s = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(f, s, { mode: 0o600 });
  return s;
}
const SECRET = loadSecret();

const hashPassword = (pw) => {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(pw, salt, 64).toString('hex');
};
const verifyPassword = (pw, stored) => {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, 'hex'), b = crypto.scryptSync(pw, salt, 64);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const b64 = (b) => Buffer.from(b).toString('base64url');
const sign = (data) => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
function makeToken(uid, hours = 12) {
  const body = b64(JSON.stringify({ uid, exp: Date.now() + hours * 3600e3 }));
  return body + '.' + sign(body);
}
function readToken(tok) {
  const [body, sig] = String(tok || '').split('.');
  if (!body || !sig) return null;
  const good = sign(body);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  try { const p = JSON.parse(Buffer.from(body, 'base64url').toString()); return p.exp > Date.now() ? p : null; } catch (e) { return null; }
}

// Express middleware: attaches req.user from "Authorization: Bearer <token>"
function requireAuth(req, res, next) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  const p = m && readToken(m[1]);
  const u = p && db.prepare('SELECT id, username, role, name, staff_id, student_id FROM users WHERE id=?').get(p.uid);
  if (!u) return res.status(401).json({ error: 'Please log in again.' });
  req.user = u; next();
}
const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'You do not have permission to do that.' });

// Simple brute-force protection: 5 failures per username+IP => 15 minute lock.
const fails = new Map();
function checkLock(key) { const f = fails.get(key); return f && f.n >= 5 && Date.now() < f.until ? Math.ceil((f.until - Date.now()) / 60000) : 0; }
function noteFail(key) { const f = fails.get(key) || { n: 0 }; f.n++; f.until = Date.now() + 15 * 60000; fails.set(key, f); return f.n; }
const clearFails = (key) => fails.delete(key);

module.exports = { hashPassword, verifyPassword, makeToken, requireAuth, requireRole, checkLock, noteFail, clearFails };
