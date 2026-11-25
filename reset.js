// Deletes the database file so the next start re-creates it (and the demo data).
const fs = require('fs'); const path = require('path');
const f = path.resolve(process.env.DB_PATH || path.join(__dirname, 'data', 'krillion.db'));
['', '-wal', '-shm'].forEach(s => { try { fs.unlinkSync(f + s); } catch (e) {} });
console.log('Database removed:', f);
