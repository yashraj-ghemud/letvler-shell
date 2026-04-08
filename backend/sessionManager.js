const pty = require("node-pty");

class SessionManager {
    constructor() {
        this.sessions = new Map();
    }

    createSession(sessionId) {
        const shell = process.platform === "win32" ? "powershell.exe" : process.env.SHELL || "/bin/bash";
        const shellArgs = shell.includes("bash") ? ["--noprofile", "--norc"] : [];

        const ptyProcess = pty.spawn(shell, shellArgs, {
            name: "xterm-256color",
            cols: 100,
            rows: 28,
            cwd: process.env.HOME || process.cwd(),
            env: {
                ...process.env,
                TERM: "xterm-256color",
                COLORTERM: "truecolor"
            }
        });

        this.sessions.set(sessionId, {
            pty: ptyProcess,
            shell
        });

        if (shell.includes("bash")) {
            this.bootstrapBash(ptyProcess);
        }

        return ptyProcess;
    }

    bootstrapBash(ptyProcess) {
        const initScript = [
            "export PS1='visitor@blacksite:\\w$ '",
            "help(){",
            "cat <<'EOF'",
            "+---------------------------------------------+",
            "| AVAILABLE COMMANDS                          |",
            "+---------------------------------------------+",
            "| ls, cd, cat, pwd, echo, clear               |",
            "| whoami, help, neofetch, hack, matrix        |",
            "+---------------------------------------------+",
            "EOF",
            "}",
            "whoami(){",
            "printf 'intruder\\nrole: stealth operator\\nclearance: delta-7\\n'",
            "}",
            "neofetch(){",
            "cat <<'EOF'",
            "   ____  _            _    ____  _ _       ",
            "  | __ )| | __ _  ___| | _/ ___|(_) |_ ___ ",
            "  |  _ \\| |/ _` |/ __| |/ \\___ \\| | __/ _ \\",
            "  | |_) | | (_| | (__|   < ___) | | ||  __/",
            "  |____/|_|\\__,_|\\___|_|\\_\\____/|_|\\__\\___|",
            "",
            "OS: HackerOS v4.2",
            "Host: Blacksite Node",
            "Kernel: 6.6-neural",
            "Uptime: classified",
            "CPU: Neural Engine",
            "GPU: Cipher Core",
            "Memory: 404MB free",
            "EOF",
            "}",
            "hack(){",
            "echo '[*] Enumerating access points...'",
            "echo '[*] Injecting phantom credentials...'",
            "echo '[*] Breaching perimeter firewall...'",
            "echo '[+] Access key acquired: NX-ALPHA-117'",
            "}",
            "matrix(){",
            "for i in {1..28}; do",
            "  printf '%s\\n' \"$(cat /dev/urandom | tr -dc '01ABCDEF' | fold -w 80 | head -n 1)\"",
            "done",
            "}",
            "clear"
        ].join("\n");

        ptyProcess.write(`${initScript}\r`);
    }

    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }

    resizeSession(sessionId, cols, rows) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return;
        }

        const safeCols = Number.isFinite(cols) ? Math.max(20, Math.floor(cols)) : 100;
        const safeRows = Number.isFinite(rows) ? Math.max(8, Math.floor(rows)) : 28;
        session.pty.resize(safeCols, safeRows);
    }

    removeSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return;
        }

        session.pty.kill();
        this.sessions.delete(sessionId);
    }

    count() {
        return this.sessions.size;
    }
}

module.exports = SessionManager;