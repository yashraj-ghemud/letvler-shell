# letvler-shell
> Cinematic hacker-style web terminal: a static Next.js frontend that connects over WebSocket to a Node.js backend which creates an interactive PTY per client. Backend supports Docker-based sandbox sessions (dockerode) and a node-pty fallback.

## Overview
A split frontend/backend project intended to serve a cinematic, xterm.js-based web terminal UI that opens an interactive shell per connected client. Frontend is implemented as a static Next.js export; backend is an Express + ws server that manages PTYs or Docker container sessions and exposes health, session metadata, and file-download endpoints.

## What it does
- Serves a static Next.js frontend (frontend/) that connects to the backend over WebSocket.
- Backend creates one PTY-like interactive session per WebSocket connection.
- Sessions can be backed by Docker containers (recommended) or by spawning host PTYs as a fallback.
- Backend exposes HTTP endpoints for health, session metadata and downloading files from a session workspace.

## Key capabilities
- WebSocket-backed interactive PTY per client (node-pty or Docker container).
- Docker-based sandbox session lifecycle management (DockerManager).
- Static frontend export configured (next.config.js output: 'export').
- Tools and scripts to seed CTF content (backend/ctfSetup.js) and helpers (tools/decoder.py).
- Download endpoint that maps container paths to host temporary files.

## Technology
- Next.js 14 (App Router)
- React 18
- Tailwind CSS, GSAP, three.js, xterm.js
- Node.js 18
- Express
- ws (WebSocket)
- node-pty
- dockerode (Docker control)
- Docker (container sandboxing)
- uuid

## Repository structure
Top-level:
- README.md
- frontend/ — Next.js static-export frontend (xterm.js, GSAP, matrix/particle effects)
- backend/ — Node.js backend with session and Docker management
- project.md

Notable backend files and areas (as present in repository evidence):
- backend/server.js — primary HTTP and WebSocket entrypoint, session endpoints, download flow
- backend/dockerManager.js — Docker-based session creation and copy-from-container helpers
- backend/sessionManager.js — PTY fallback session spawning and session metadata handling
- backend/ctfSetup.js — scripts to create CTF content and seed environments
- backend/sessions/* — session metadata directories (repository contains session artifacts)
- frontend/next.config.js, tsconfig.json, and Tailwind setup

## Getting started
The repository contains a README excerpt with concrete local development steps for frontend and backend:

Frontend (from repository README excerpt)
- cd frontend
- npm install
- cp .env.example .env.local
- Set NEXT_PUBLIC_WS_URL to your backend WS URL (e.g. wss://your-backend.example.com/ws)
- npm run dev

Backend (from repository README excerpt)
- cd backend
- npm install
- node server.js

By default the server is described as listening on http://localhost:8080 and WebSocket endpoint ws://localhost:8080/ws (per repository README excerpt).

Cloudflare Pages / Render deploy guidance (documented in repository excerpt)
- Frontend: configure frontend/ as Pages project, build with npm run build, output directory out, set NEXT_PUBLIC_WS_URL for the deployed backend.
- Backend: documented steps to create a Web Service from backend/, build with npm install and start with node server.js; set FRONTEND_ORIGIN to your frontend URL.

## Configuration
Environment variables and configuration items evident in repository:
- NEXT_PUBLIC_WS_URL — used by the frontend to point to the backend WebSocket endpoint.
- FRONTEND_ORIGIN — used by backend CORS/Origin handling; audit shows it defaults to '*' if not set (backend/server.js).
- SANDBOX_MODE — backend supports modes; 'docker' is recommended and a 'pty' fallback exists (backend/sessionManager.js).
- ALLOW_PTY_FALLBACK — flag suggested in repository analysis to enable/disable PTY fallback.
- Session TTL and cleanup interval variables — present in backend/server.js for session lifecycle management.
- Docker connection: dockerode defaults to socketPath /var/run/docker.sock (backend/dockerManager.js).

If you need to inspect or change configuration, review:
- backend/server.js
- backend/dockerManager.js
- backend/sessionManager.js
- frontend/.env.example and frontend/next.config.js

## Development and quality notes
- The repository has clear frontend/backend separation and tooling for CTF content, but:
  - There are no automated tests or test folders present in the repository evidence.
  - No CI configuration files were found (no GitHub Actions, etc.).
  - No linting or pre-commit hooks were evidenced.
  - Some session directories appear committed under backend/sessions/ in the repository — review before reuse.
- Static export of frontend is configured; frontend is suitable for hosting on static platforms (Cloudflare Pages mentioned in repo).

## Safety and responsible use
Relevant security considerations surfaced in repository analysis — review carefully before running or exposing this service to untrusted networks:
- PTY fallback risk: if SANDBOX_MODE='pty' and ALLOW_PTY_FALLBACK is enabled, the backend may spawn real host shells (node-pty), allowing remote command execution on the host.
- Docker socket exposure: dockerode uses the Docker socket by default (/var/run/docker.sock); mounting host docker.sock into the backend process can lead to host compromise.
- CORS/Origin: FRONTEND_ORIGIN defaults to '*' in server.js (per evidence), which allows cross-origin requests from any origin.
- No authentication/authorization: sessions are identified by UUIDs and no authentication was evidenced; knowledge of a session ID may allow rejoining.
- Download flow risks: backend uses docker cp and shell exec in copyFileFromDockerSession; this flow must be reviewed and hardened to avoid path injection or host-side exposure.
- No rate limiting or request throttling was found for WebSocket or HTTP endpoints.
- No per-container CPU/memory limits or explicit container hardening were evident.

Suggested immediate safety steps (from repository analysis):
- Prefer SANDBOX_MODE='docker' and set ALLOW_PTY_FALLBACK=false for internet-facing deployments.
- Do not mount /var/run/docker.sock into the backend in production; use stronger sandboxing/orchestration.
- Restrict FRONTEND_ORIGIN to a known URL rather than '*' and add authentication to session endpoints.
- Review and replace shell-based docker cp usages with Docker APIs (dockerode copy) and add strict path whitelisting.

## Contributing
- Contributions are welcome via issues and pull requests.
- To evaluate behavior or configuration, inspect the server and manager code in backend/ (server.js, dockerManager.js, sessionManager.js) and the frontend config in frontend/.
- The repository does not include automated tests or CI; contributors should document and include tests and CI changes in PRs.

## License
No license file or explicit license information was found in the supplied repository evidence. Do not assume a license when using or redistributing this code.
