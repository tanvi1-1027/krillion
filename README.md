# Krillion – School Management System

A full-stack web application for any school: **frontend** (HTML/CSS/JavaScript), **backend** (Node.js + Express REST API) and **database** (SQLite).

## Features
- Login for **Admin, Teacher and Student** (passwords hashed with scrypt, signed tokens, lock after 5 failed attempts)
- Students and staff management (login accounts are created automatically)
- Attendance: one record per class per day, automatic low-attendance alerts (below 75%)
- Fees: fee structure per class, payments, receipts, reminders
- Timetable with teacher double-booking protection
- Notifications by audience (email/SMS delivery is simulated)
- Settings: school name and classes – the system is not tied to one school
- Role-based data access enforced on the server

## Project structure
All files sit in one folder: `server.js` (Express app), `routes.js` (API and rules), `auth.js` (login security), `db.js` + `schema.sql` (SQLite database), `seed.js` (demo data), `index.html`, `style.css`, `app.js` (frontend).

## Run on your computer
Requires Node.js 18 or newer.
```
npm install
npm start
```
Open http://localhost:3000

## Demo logins (when DEMO_DATA=true, the default)
| Role    | Username | Password |
|---------|----------|----------|
| Admin   | admin    | admin123 |
| Teacher | rao      | teach123 |
| Student | aarav    | stud123  |

To start with an empty school instead, copy `.env.example` to `.env`, set `DEMO_DATA=false`, set `ADMIN_PASSWORD`, and delete the `data/` folder. Then log in as `admin`, set the school name and add classes in **Settings**.

## Put it online (so friends can open a link)
The app needs a host that runs Node.js. Free options: **Render**, **Railway**, **Fly.io**.

Render (simple):
1. Upload this folder to a GitHub repository.
2. On render.com choose **New → Web Service** and select the repository. (`render.yaml` is included.)
3. Build command `npm install`, start command `npm start`.
4. Set `JWT_SECRET` to a long random string. Deploy and share the URL.

Note: free hosts may erase local files on restart. For lasting data, attach a persistent disk and set `DB_PATH` to a path on it (Render: add a Disk mounted at `/var/data`, `DB_PATH=/var/data/krillion.db`).

## API overview
All routes are under `/api`. Send `Authorization: Bearer <token>` after `POST /api/login`.

| Method | Route | Who |
|---|---|---|
| POST | /login, /password | everyone |
| GET | /data | everyone (filtered by role) |
| POST/PUT/PATCH | /students, /students/:id, /students/:id/active | admin |
| POST | /staff | admin |
| POST | /attendance | admin, teacher (own classes) |
| PUT | /fees/:class | admin |
| POST | /payments, /fees/remind/:id | admin |
| POST/DELETE | /timetable | admin |
| POST | /notifications | admin, teacher (own classes) |
| PUT | /settings | admin |
| POST/DELETE | /classes, /classes/:name | admin |

## Reset the database
`npm run reset-db`, then start again.
