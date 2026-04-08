const archiver = require("archiver");
const cors = require("cors");
const express = require("express");
const fs = require("fs");
const fsp = require("fs/promises");
const http = require("http");
const os = require("os");
const path = require("path");
const { exec } = require("child_process");
const { promisify } = require("util");
const WebSocket = require("ws");
const DockerManager = require("./dockerManager");

const execAsync = promisify(exec);

const PORT = Number(process.env.PORT || 8080);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "*";
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 30 * 60 * 1000);
const CLEANUP_INTERVAL_MS = Number(process.env.CLEANUP_INTERVAL_MS || 5 * 60 * 1000);
const SESSIONS_ROOT = process.env.SESSIONS_ROOT || path.resolve(__dirname, "sessions");
const SANDBOX_MODE = process.env.SANDBOX_MODE || (process.env.CTF_MODE === "true" ? "docker" : "pty");
const CTF_IMAGE = process.env.CTF_IMAGE || "ctf-terminal:latest";
const ALLOW_PTY_FALLBACK = process.env.ALLOW_PTY_FALLBACK !== "false";

const app = express();
const server = http.createServer(app);
const dockerManager = new DockerManager({
    mode: SANDBOX_MODE,
    sessionsRoot: SESSIONS_ROOT,
    ctfImage: CTF_IMAGE,
    usePtyFallback: ALLOW_PTY_FALLBACK
});

app.use(
    cors({
        origin: FRONTEND_ORIGIN === "*" ? true : FRONTEND_ORIGIN,
        credentials: true
    })
);

app.use(express.json());

function toSafeSessionId(sessionId) {
    return dockerManager.isValidSessionId(sessionId) ? sessionId : null;
}

function normalizeDownloadPath(rawPath) {
    let decodedPath;
    try {
        decodedPath = decodeURIComponent(rawPath || "").trim();
    } catch (_error) {
        return null;
    }

    if (!decodedPath || decodedPath.includes("\0")) {
        return null;
    }

    const withRoot = decodedPath.startsWith("/") ? decodedPath : `/${decodedPath}`;
    const normalized = path.posix.normalize(withRoot);
    if (!/^\/[a-zA-Z0-9._/-]+$/.test(normalized)) {
        return null;
    }

    const allowedPrefix = "/home/ctf/workspace/";
    if (!normalized.startsWith(allowedPrefix)) {
        return null;
    }

    return normalized;
}

function mapContainerPathToHost(session, containerPath) {
    const relative = path.posix.relative("/home/ctf/workspace", containerPath);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
        return null;
    }

    return path.join(session.workspaceHostPath, relative);
}

async function copyFileFromDockerSession(session, containerPath) {
    const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), `ctf-download-${session.id}-`));
    const targetName = path.posix.basename(containerPath);
    const tempFilePath = path.join(tempDir, targetName);

    const command = `docker cp "${session.containerName}:${containerPath}" "${tempFilePath}"`;
    await execAsync(command);

    return {
        tempDir,
        tempFilePath
    };
}

app.get("/", (_req, res) => {
    res.json({
        status: "ok",
        message: "CTF terminal backend online",
        sandboxMode: SANDBOX_MODE,
        ctfMode: process.env.CTF_MODE === "true",
        activeSessions: dockerManager.count()
    });
});

app.get("/health", (_req, res) => {
    res.json({
        health: "ok",
        sandboxMode: SANDBOX_MODE,
        activeSessions: dockerManager.count(),
        sessions: dockerManager.getSessionMeta()
    });
});

app.get("/api/download/:sessionId/*", async (req, res) => {
    const sessionId = toSafeSessionId(req.params.sessionId);
    if (!sessionId) {
        res.status(400).json({ error: "Invalid session id" });
        return;
    }

    const session = dockerManager.getSession(sessionId);
    if (!session) {
        res.status(404).json({ error: "Session not found" });
        return;
    }

    const normalizedPath = normalizeDownloadPath(req.params[0]);
    if (!normalizedPath) {
        res.status(400).json({ error: "Invalid file path" });
        return;
    }

    let filePathToStream;
    let cleanup = async () => undefined;

    try {
        if (session.mode === "docker") {
            const copied = await copyFileFromDockerSession(session, normalizedPath);
            filePathToStream = copied.tempFilePath;
            cleanup = async () => {
                await fsp.rm(copied.tempDir, { recursive: true, force: true });
            };
        } else {
            const hostPath = mapContainerPathToHost(session, normalizedPath);
            if (!hostPath) {
                res.status(400).json({ error: "Path traversal blocked" });
                return;
            }

            filePathToStream = hostPath;
        }

        const stat = await fsp.stat(filePathToStream);
        if (!stat.isFile()) {
            await cleanup();
            res.status(404).json({ error: "Requested artifact is not a file" });
            return;
        }

        res.setHeader("Content-Disposition", `attachment; filename=\"${path.basename(filePathToStream)}\"`);
        res.setHeader("Content-Type", "application/octet-stream");

        const stream = fs.createReadStream(filePathToStream);
        stream.on("error", async () => {
            await cleanup();
            if (!res.headersSent) {
                res.status(500).json({ error: "Failed to stream file" });
            }
        });

        res.on("close", () => {
            cleanup().catch(() => undefined);
        });

        stream.pipe(res);
    } catch (error) {
        await cleanup();
        res.status(404).json({
            error: "File not found",
            details: error.message
        });
    }
});

app.get("/api/download-workspace/:sessionId", async (req, res) => {
    const sessionId = toSafeSessionId(req.params.sessionId);
    if (!sessionId) {
        res.status(400).json({ error: "Invalid session id" });
        return;
    }

    const session = dockerManager.getSession(sessionId);
    if (!session) {
        res.status(404).json({ error: "Session not found" });
        return;
    }

    const workspaceDir = session.workspaceHostPath;
    res.setHeader("Content-Disposition", `attachment; filename=\"workspace-${sessionId}.zip\"`);
    res.setHeader("Content-Type", "application/zip");

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", () => {
        if (!res.headersSent) {
            res.status(500).json({ error: "Archive creation failed" });
        }
    });

    archive.pipe(res);
    archive.directory(workspaceDir, false);
    await archive.finalize();
});

const wss = new WebSocket.Server({ server, path: "/ws" });

wss.on("connection", async (socket, request) => {
    const url = new URL(request.url || "/ws", "http://localhost");
    const requestedSessionId = url.searchParams.get("sessionId");
    let hasClosed = false;

    try {
        const session = await dockerManager.createOrResumeSession(requestedSessionId);
        const sessionId = session.id;

        dockerManager.markConnected(sessionId);
        dockerManager.touchSession(sessionId);

        const outputListener = (chunk) => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(chunk);
            }
        };

        dockerManager.addOutputListener(sessionId, outputListener);
        socket.send(JSON.stringify({ type: "session_id", id: sessionId }));

        socket.on("message", async (rawMessage) => {
            dockerManager.touchSession(sessionId);
            const payload = rawMessage.toString();

            try {
                const parsed = JSON.parse(payload);
                if (parsed.type === "resize") {
                    await dockerManager.resizeSession(sessionId, parsed.cols, parsed.rows);
                    return;
                }
            } catch (_error) {
                // Terminal keystroke streams are expected as raw text.
            }

            dockerManager.writeInput(sessionId, payload);
        });

        const closeHandler = () => {
            if (hasClosed) {
                return;
            }

            hasClosed = true;
            dockerManager.removeOutputListener(sessionId, outputListener);
            dockerManager.markDisconnected(sessionId);
        };

        socket.on("close", closeHandler);
        socket.on("error", closeHandler);
    } catch (error) {
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(`\r\n[backend-error] ${error.message}\r\n`);
        }

        socket.close();
    }
});

const cleanupTimer = setInterval(async () => {
    const expiredIds = dockerManager.getExpiredSessionIds(SESSION_TTL_MS);
    await Promise.all(expiredIds.map((sessionId) => dockerManager.destroySession(sessionId).catch(() => undefined)));
}, CLEANUP_INTERVAL_MS);

cleanupTimer.unref();

let shuttingDown = false;

async function gracefulShutdown(signal) {
    if (shuttingDown) {
        return;
    }

    shuttingDown = true;
    console.log(`[terminal-backend] received ${signal}, shutting down...`);

    clearInterval(cleanupTimer);

    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(
                JSON.stringify({
                    type: "server_notice",
                    message: "Server is restarting, session will reconnect automatically"
                })
            );
            client.close();
        }
    });

    await dockerManager.destroyAllSessions();

    server.close(() => {
        process.exit(0);
    });

    setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", () => {
    gracefulShutdown("SIGTERM").catch(() => process.exit(1));
});

process.on("SIGINT", () => {
    gracefulShutdown("SIGINT").catch(() => process.exit(1));
});

server.listen(PORT, async () => {
    await fsp.mkdir(SESSIONS_ROOT, { recursive: true });
    console.log(`[terminal-backend] listening on :${PORT} mode=${SANDBOX_MODE}`);
});