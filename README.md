# Terminal Website

Cinematic hacker-style web terminal with a static Next.js frontend (Cloudflare Pages) and a PTY backend (Render).

## Project Structure

- `frontend/`: Next.js 14 App Router static export with xterm.js, GSAP intro, matrix rain, and particle ambience.
- `backend/`: Node.js + Express + ws + node-pty server, one PTY session per WebSocket connection.

## Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env.local
# Set NEXT_PUBLIC_WS_URL to your Render backend URL, e.g. wss://my-backend.onrender.com/ws
npm run dev
```

## Backend Setup

```bash
cd backend
npm install
node server.js
```

Server defaults to `http://localhost:8080` and WebSocket endpoint `ws://localhost:8080/ws`.

## Cloudflare Pages Deploy (Frontend)

1. Connect `frontend/` directory as the Pages project root.
2. Build command: `npm run build`
3. Output directory: `out`
4. Environment variable:
   - `NEXT_PUBLIC_WS_URL=wss://your-backend.onrender.com/ws`

## Render Deploy (Backend)

1. Create a Web Service from `backend/`.
2. Build command: `npm install`
3. Start command: `node server.js`
4. Set env vars as needed:
   - `FRONTEND_ORIGIN=https://your-site.pages.dev`

## Notes

- Render free instances can sleep; first connect can take longer.
- Backend currently launches a real shell PTY. For internet-facing hardening, isolate in containers or switch to a command whitelist interpreter.# letvler-shell
