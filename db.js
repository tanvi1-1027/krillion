const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const file = path.resolve(process.env.DB_PATH || path.join(__dirname, 'data', 'krillion.db'));
fs.mkdirSync(path.dirname(file), { recursive: true });

const db = new Database(file);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

const getSetting = (k, d) => { const r = db.prepare('SELECT value FROM settings WHERE key=?').get(k); return r ? r.value : d; };
const setSetting = (k, v) => db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k, String(v));

module.exports = { db, file, getSetting, setSetting };
