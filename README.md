# TaskBuddy

A full-stack task management app: **React (Vite)** front end, **Express** REST API, **JWT** authentication and **WebSocket** real-time updates.

## Features
- User registration and login (bcrypt-hashed passwords, JWT sessions)
- Authorization: every user sees only their own tasks. The first registered account is an **admin** and can see all tasks.
- Create, read, update (rename, complete/uncomplete) and delete tasks
- Priority (Low / Medium / High) and category (General, Work, Personal, Study, Health, Shopping)
- Progress bar with "x of y tasks completed", plus All / Active / Completed filters
- Real-time sync across tabs and devices (green dot = connected)
- Responsive layout for desktop and mobile

## Project structure
```
taskbuddy/
├── client/            # React + Vite front end
│   └── src/ (App.jsx, api.js, components/, index.css)
├── server/            # Express API + WebSocket server
│   └── index.js
└── package.json       # root scripts
```

## Getting started
Requires Node.js 18+.

```bash
git clone <your-repo-url>
cd taskbuddy
npm run install:all    # installs root, server and client dependencies
npm run dev            # starts API (port 5000) and React app (port 5173)
```

Open http://localhost:5173 and register an account.

## Production
```bash
npm run build          # builds the React app into client/dist
npm start              # Express serves the API and the built app on port 5000
```
Set `JWT_SECRET` (required) and `PORT` (optional) as environment variables before deploying.

## API
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create an account |
| POST | `/api/auth/login` | Log in, returns token |
| GET | `/api/tasks` | List tasks (auth required) |
| POST | `/api/tasks` | Create a task |
| PUT | `/api/tasks/:id` | Update a task |
| DELETE | `/api/tasks/:id` | Delete a task |

WebSocket: `ws://host/ws?token=<jwt>` sends `{"type":"tasks-changed"}` whenever a visible task changes.

## Notes
Data is stored in `server/data.json` (git-ignored, created automatically). For production, replace it with a real database such as MongoDB or PostgreSQL.

## License
MIT
