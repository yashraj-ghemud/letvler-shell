const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { spawnSync } = require("child_process");
const Docker = require("dockerode");
const pty = require("node-pty");
const { v4: uuidv4, validate: validateUuid } = require("uuid");
const { buildSetupScript, seedHostWorkspace } = require("./ctfSetup");

class DockerManager {
    constructor(options = {}) {
        this.mode = options.mode || "docker";
        this.sessionsRoot = options.sessionsRoot || path.resolve(process.cwd(), "sessions");
        this.ctfImage = options.ctfImage || "ctf-terminal:latest";
        this.usePtyFallback = options.usePtyFallback !== false;
        this.sessions = new Map();

        this.docker = new Docker({
            socketPath: options.dockerSocketPath || process.env.DOCKER_SOCKET || "/var/run/docker.sock"
        });
    }

    isValidSessionId(sessionId) {
        return Boolean(sessionId) && validateUuid(sessionId);
    }

    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }

    count() {
        return this.sessions.size;
    }

    getAllSessionIds() {
        return Array.from(this.sessions.keys());
    }

    getSessionMeta() {
        return Array.from(this.sessions.values()).map((session) => ({
            id: session.id,
            mode: session.mode,
            disconnectedAt: session.disconnectedAt,
            lastActiveAt: session.lastActiveAt
        }));
    }

    getExpiredSessionIds(ttlMs) {
        const now = Date.now();
        return Array.from(this.sessions.values())
            .filter((session) => session.disconnectedAt !== null && now - session.disconnectedAt > ttlMs)
            .map((session) => session.id);
    }

    touchSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return;
        }

        session.lastActiveAt = Date.now();
    }

    markDisconnected(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return;
        }

        session.disconnectedAt = Date.now();
    }

    markConnected(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return;
        }

        session.disconnectedAt = null;
        session.lastActiveAt = Date.now();
    }

    addOutputListener(sessionId, listener) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return;
        }

        session.listeners.add(listener);
    }

    removeOutputListener(sessionId, listener) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return;
        }

        session.listeners.delete(listener);
    }

    emitOutput(session, chunk) {
        for (const listener of session.listeners) {
            listener(chunk);
        }
    }

    async createOrResumeSession(requestedSessionId) {
        if (this.isValidSessionId(requestedSessionId) && this.sessions.has(requestedSessionId)) {
            const existing = this.sessions.get(requestedSessionId);
            this.markConnected(existing.id);
            return existing;
        }

        const sessionId = uuidv4();
        const workspaceHostPath = path.join(this.sessionsRoot, sessionId);
        await fsp.mkdir(workspaceHostPath, { recursive: true });

        let session;
        if (this.mode === "docker") {
            try {
                session = await this.createDockerSession(sessionId, workspaceHostPath);
            } catch (error) {
                if (!this.usePtyFallback) {
                    throw error;
                }

                session = await this.createPtySession(sessionId, workspaceHostPath, error);
            }
        } else {
            session = await this.createPtySession(sessionId, workspaceHostPath);
        }

        this.sessions.set(sessionId, session);
        this.markConnected(sessionId);
        return session;
    }

    getSafeContainerName(sessionId) {
        const safeId = sessionId.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 24);
        return `ctf-${safeId}`;
    }

    async createDockerSession(sessionId, workspaceHostPath) {
        const containerName = this.getSafeContainerName(sessionId);

        const container = await this.docker.createContainer({
            Image: this.ctfImage,
            name: containerName,
            WorkingDir: "/home/ctf",
            Tty: true,
            OpenStdin: true,
            StdinOnce: false,
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
            HostConfig: {
                AutoRemove: true,
                Binds: [`${workspaceHostPath}:/home/ctf/workspace`],
                Memory: 256 * 1024 * 1024,
                NanoCpus: 500000000,
                PidsLimit: 100
            },
            Env: ["TERM=xterm-256color", "HOME=/home/ctf"],
            Cmd: ["/bin/sh", "-c", "tail -f /dev/null"]
        });

        await container.start();
        await this.runCtfSetup(container);

        const shellExec = await container.exec({
            Cmd: ["/bin/bash", "-i"],
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
            Tty: true
        });

        const shellStream = await this.startExec(shellExec, {
            hijack: true,
            stdin: true
        });

        const session = {
            id: sessionId,
            mode: "docker",
            workspaceHostPath,
            containerName,
            container,
            shellExec,
            stream: shellStream,
            listeners: new Set(),
            lastActiveAt: Date.now(),
            disconnectedAt: null
        };

        shellStream.on("data", (chunk) => {
            this.emitOutput(session, chunk.toString("utf8"));
        });

        shellStream.on("error", (error) => {
            this.emitOutput(session, `\r\n[stream-error] ${error.message}\r\n`);
        });

        return session;
    }

    async runCtfSetup(container) {
        const setupExec = await container.exec({
            Cmd: ["/bin/bash", "-lc", buildSetupScript()],
            AttachStdout: true,
            AttachStderr: true,
            Tty: false
        });

        const setupStream = await this.startExec(setupExec, {
            hijack: true,
            stdin: false
        });

        await this.waitForStreamEnd(setupStream);
        const inspect = await setupExec.inspect();
        if (inspect.ExitCode !== 0) {
            throw new Error(`CTF setup failed with exit code ${inspect.ExitCode}`);
        }
    }

    async startExec(execHandle, startOptions) {
        return new Promise((resolve, reject) => {
            execHandle.start(startOptions, (error, stream) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve(stream);
            });
        });
    }

    async waitForStreamEnd(stream) {
        return new Promise((resolve, reject) => {
            stream.on("data", () => {
                // Drain stream output; setup details are intentionally not broadcast.
            });
            stream.on("end", resolve);
            stream.on("close", resolve);
            stream.on("error", reject);
        });
    }

    hasWslDistribution() {
        try {
            const result = spawnSync("wsl.exe", ["-l", "-q"], {
                encoding: "utf8",
                windowsHide: true
            });

            return result.status === 0 && typeof result.stdout === "string" && result.stdout.trim().length > 0;
        } catch (_error) {
            return false;
        }
    }

    toWslPath(winPath) {
        const normalized = winPath.replace(/\\/g, "/");
        const driveMatch = normalized.match(/^([A-Za-z]):\/(.*)$/);
        if (!driveMatch) {
            return normalized;
        }

        const drive = driveMatch[1].toLowerCase();
        const rest = driveMatch[2];
        return `/mnt/${drive}/${rest}`;
    }

    quoteForBash(value) {
        return `'${String(value).replace(/'/g, `'"'"'`)}'`;
    }

    getWindowsLinuxShellCandidates(workspaceHostPath) {
        const baseEnv = {
            ...process.env,
            TERM: "xterm-256color"
        };

        const candidates = [];

        if (this.hasWslDistribution()) {
            const wslWorkspace = this.toWslPath(workspaceHostPath);
            const quoted = this.quoteForBash(wslWorkspace);
            const wslBootstrap = `mkdir -p ${quoted} && cd ${quoted} && exec bash -i`;

            candidates.push({
                name: "wsl-bash",
                shell: "wsl.exe",
                args: ["-e", "bash", "-lc", wslBootstrap],
                env: baseEnv,
                cwd: workspaceHostPath,
                linuxLike: true
            });
        }

        const gitBashPaths = [
            "C:\\Program Files\\Git\\bin\\bash.exe",
            "C:\\Program Files\\Git\\usr\\bin\\bash.exe"
        ];

        for (const gitPath of gitBashPaths) {
            if (fs.existsSync(gitPath)) {
                candidates.push({
                    name: "git-bash",
                    shell: gitPath,
                    args: ["--login", "-i"],
                    env: {
                        ...baseEnv,
                        CHERE_INVOKING: "1"
                    },
                    cwd: workspaceHostPath,
                    linuxLike: true
                });
                break;
            }
        }

        return candidates;
    }

    async createPtySession(sessionId, workspaceHostPath, dockerError) {
        seedHostWorkspace(workspaceHostPath);

        let selected;
        let ptyProcess;
        let lastSpawnError;

        if (process.platform === "win32") {
            const candidates = this.getWindowsLinuxShellCandidates(workspaceHostPath);

            for (const candidate of candidates) {
                try {
                    ptyProcess = pty.spawn(candidate.shell, candidate.args, {
                        name: "xterm-256color",
                        cols: 100,
                        rows: 28,
                        cwd: candidate.cwd,
                        env: candidate.env
                    });
                    selected = candidate;
                    break;
                } catch (error) {
                    lastSpawnError = error;
                }
            }

            if (!ptyProcess || !selected) {
                const detail = lastSpawnError ? ` (${lastSpawnError.message})` : "";
                throw new Error(
                    `No Linux shell available on Windows${detail}. Install Docker, a WSL distro, or Git Bash.`
                );
            }
        } else {
            selected = {
                name: "bash",
                linuxLike: true
            };

            ptyProcess = pty.spawn("/bin/bash", ["--noprofile", "--norc"], {
                name: "xterm-256color",
                cols: 100,
                rows: 28,
                cwd: workspaceHostPath,
                env: {
                    ...process.env,
                    TERM: "xterm-256color"
                }
            });
        }

        if (selected.linuxLike) {
            ptyProcess.write("export TERM=xterm-256color\r");
            ptyProcess.write("alias ll='ls -la'\r");
            ptyProcess.write("alias cls='clear'\r");
            ptyProcess.write("clear\r");
        }

        const session = {
            id: sessionId,
            mode: "pty",
            shellName: selected.name,
            workspaceHostPath,
            ptyProcess,
            listeners: new Set(),
            lastActiveAt: Date.now(),
            disconnectedAt: null,
            fallbackReason: dockerError ? dockerError.message : null
        };

        ptyProcess.onData((data) => {
            this.emitOutput(session, data);
        });

        if (dockerError) {
            this.emitOutput(
                session,
                `\r\n[notice] Docker unavailable, running fallback shell mode (${selected.name}).\r\n`
            );
        }

        return session;
    }

    writeInput(sessionId, input) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return;
        }

        this.touchSession(sessionId);

        if (session.mode === "docker") {
            if (session.stream && !session.stream.destroyed) {
                session.stream.write(input);
            }
            return;
        }

        session.ptyProcess.write(input);
    }

    async resizeSession(sessionId, cols, rows) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return;
        }

        const safeCols = Number.isFinite(cols) ? Math.max(20, Math.floor(cols)) : 100;
        const safeRows = Number.isFinite(rows) ? Math.max(8, Math.floor(rows)) : 28;

        if (session.mode === "docker") {
            if (session.shellExec && typeof session.shellExec.resize === "function") {
                await new Promise((resolve) => {
                    session.shellExec.resize({
                        w: safeCols,
                        h: safeRows
                    }, () => resolve());
                });
            }
            return;
        }

        session.ptyProcess.resize(safeCols, safeRows);
    }

    async destroySession(sessionId, options = {}) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return;
        }

        this.sessions.delete(sessionId);

        if (session.mode === "docker") {
            try {
                if (session.stream && !session.stream.destroyed) {
                    session.stream.end();
                    session.stream.destroy();
                }
            } catch (_error) {
                // Ignore stream closure errors.
            }

            try {
                await session.container.stop({ t: 2 });
            } catch (_error) {
                // Ignore already-stopped containers.
            }

            try {
                await session.container.remove({ force: true });
            } catch (_error) {
                // Ignore AutoRemove/no-such-container cases.
            }
        } else {
            try {
                session.ptyProcess.kill();
            } catch (_error) {
                // Ignore process teardown errors.
            }
        }

        if (options.deleteWorkspace !== false) {
            await fsp.rm(session.workspaceHostPath, {
                recursive: true,
                force: true
            });
        }
    }

    async destroyAllSessions() {
        const ids = this.getAllSessionIds();
        await Promise.all(ids.map((id) => this.destroySession(id).catch(() => undefined)));
    }
}

module.exports = DockerManager;
