const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 5000;
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const FILE = path.join(__dirname, 'data.json');

// ---- tiny JSON-file database (swap for MongoDB/PostgreSQL in production) ----
let db = { users: [], tasks: [] };
if (fs.existsSync(FILE)) db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const save = () => fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const PRIORITY = ['Low', 'Medium', 'High'];
const CATEGORY = ['General', 'Work', 'Personal', 'Study', 'Health', 'Shopping'];

const app = express();
app.use(express.json());

// ---------------- auth ----------------
const sign = (u) => jwt.sign({ id: u.id, name: u.name, role: u.role }, SECRET, { expiresIn: '7d' });
const publicUser = (u) => ({ id: u.id, name: u.name, role: u.role });

function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  try { req.user = jwt.verify(token, SECRET); next(); }
  catch { res.status(401).json({ error: 'Please log in again.' }); }
}

app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required.' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  const mail = String(email).toLowerCase().trim();
  if (db.users.some((u) => u.email === mail)) return res.status(409).json({ error: 'That email is already registered.' });
  const user = {
    id: uid(), name: String(name).trim().slice(0, 60), email: mail,
    hash: bcrypt.hashSync(String(password), 10),
    role: db.users.length === 0 ? 'admin' : 'user', // first account is admin
  };
  db.users.push(user); save();
  res.status(201).json({ token: sign(user), user: publicUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db.users.find((u) => u.email === String(email || '').toLowerCase().trim());
  if (!user || !bcrypt.compareSync(String(password || ''), user.hash))
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  res.json({ token: sign(user), user: publicUser(user) });
});

// ---------------- tasks (CRUD) ----------------
// Users see their own tasks; admins see everyone's.
const canAccess = (user, task) => user.role === 'admin' || task.owner === user.id;

function clean(body, partial = false) {
  const t = {};
  if (!partial || 'title' in body) {
    t.title = String(body.title || '').trim().slice(0, 150);
    if (!t.title) return { error: 'Task title is required.' };
  }
  if ('priority' in body) {
    if (!PRIORITY.includes(body.priority)) return { error: 'Invalid priority.' };
    t.priority = body.priority;
  }
  if ('category' in body) {
    if (!CATEGORY.includes(body.category)) return { error: 'Invalid category.' };
    t.category = body.category;
  }
  if ('completed' in body) t.completed = Boolean(body.completed);
  return { t };
}

app.get('/api/tasks', auth, (req, res) => {
  const names = Object.fromEntries(db.users.map((u) => [u.id, u.name]));
  const list = db.tasks
    .filter((t) => canAccess(req.user, t))
    .map((t) => ({ ...t, ownerName: names[t.owner] }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(list);
});

app.post('/api/tasks', auth, (req, res) => {
  const { t, error } = clean(req.body);
  if (error) return res.status(400).json({ error });
  const task = {
    id: uid(), owner: req.user.id, priority: 'Medium', category: 'General',
    completed: false, createdAt: new Date().toISOString(), ...t,
  };
  db.tasks.push(task); save(); notify(task);
  res.status(201).json(task);
});

app.put('/api/tasks/:id', auth, (req, res) => {
  const task = db.tasks.find((x) => x.id === req.params.id);
  if (!task || !canAccess(req.user, task)) return res.status(404).json({ error: 'Task not found.' });
  const { t, error } = clean(req.body, true);
  if (error) return res.status(400).json({ error });
  Object.assign(task, t, { updatedAt: new Date().toISOString() });
  save(); notify(task);
  res.json(task);
});

app.delete('/api/tasks/:id', auth, (req, res) => {
  const i = db.tasks.findIndex((x) => x.id === req.params.id);
  if (i < 0 || !canAccess(req.user, db.tasks[i])) return res.status(404).json({ error: 'Task not found.' });
  const [task] = db.tasks.splice(i, 1);
  save(); notify(task);
  res.status(204).end();
});

// ---------------- serve built React app in production ----------------
const dist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api|ws).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// ---------------- real-time updates (WebSocket) ----------------
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  try {
    const token = new URL(req.url, 'http://localhost').searchParams.get('token');
    ws.user = jwt.verify(token, SECRET);
  } catch { ws.close(1008, 'Unauthorized'); }
});

function notify(task) {
  for (const c of wss.clients) {
    if (c.readyState === 1 && c.user && canAccess(c.user, task)) c.send(JSON.stringify({ type: 'tasks-changed' }));
  }
}

server.listen(PORT, () => console.log(`TaskBuddy API running on http://localhost:${PORT}`));
