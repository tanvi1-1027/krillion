// Krillion School Management System - Express + SQLite backend that also serves the frontend.
const fs = require('fs');
const path = require('path');
try { // optional .env support without extra dependencies
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach(l => {
    const m = /^\s*([A-Z_]+)\s*=\s*(.*)\s*$/.exec(l); if (m && !l.trim().startsWith('#') && !(m[1] in process.env)) process.env[m[1]] = m[2];
  });
} catch (e) {}

const express = require('express');
const { seedAll } = require('./seed');
const routes = require('./routes');

seedAll();
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '100kb' }));
app.use((req, res, next) => { res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'same-origin' }); next(); });
app.use('/api', routes);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
const PUBLIC = { '/': 'index.html', '/index.html': 'index.html', '/style.css': 'style.css', '/app.js': 'app.js', '/logo.svg': 'logo.svg', '/logo-with-name.svg': 'logo-with-name.svg', '/favicon.svg': 'favicon.svg' };
app.get(Object.keys(PUBLIC), (req, res) => res.sendFile(path.join(__dirname, PUBLIC[req.path])));
app.use((err, req, res, next) => { console.error(err); res.status(400).json({ error: 'Bad request' }); });

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Krillion is running on http://localhost:' + port));
