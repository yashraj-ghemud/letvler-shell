"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "@xterm/xterm/css/xterm.css";
import useTerminalWS from "../hooks/useTerminalWS";

type TerminalProps = {
    onSpecialCommand: (command: "hack" | "matrix") => void;
    onSessionIdChange?: (sessionId: string | null) => void;
};

const SPECIAL = new Set(["hack", "matrix"]);

function normalizeSocketUrl(inputUrl: string): string {
    if (!inputUrl) {
        return "ws://localhost:8080/ws";
    }

    const hasWsPath = inputUrl.includes("/ws");
    if (hasWsPath) {
        return inputUrl;
    }

    return `${inputUrl.replace(/\/$/, "")}/ws`;
}

export default function Terminal({ onSpecialCommand, onSessionIdChange }: TerminalProps) {
    const terminalHostRef = useRef<HTMLDivElement | null>(null);
    const xtermRef = useRef<import("@xterm/xterm").Terminal | null>(null);
    const fitAddonRef = useRef<import("@xterm/addon-fit").FitAddon | null>(null);
    const [glow, setGlow] = useState(false);
    const commandBufferRef = useRef("");

    const wsUrl = useMemo(
        () => normalizeSocketUrl(process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080/ws"),
        []
    );

    const { status, sendRaw, sendResize, sessionId } = useTerminalWS(wsUrl, {
        onMessage: (chunk) => {
            xtermRef.current?.write(chunk);
        },
        onServerNotice: (message) => {
            xtermRef.current?.write(`\r\n[server] ${message}\r\n`);
        }
    });

    useEffect(() => {
        onSessionIdChange?.(sessionId);
    }, [onSessionIdChange, sessionId]);

    useEffect(() => {
        if (!terminalHostRef.current) {
            return;
        }
        let disposed = false;
        let teardown: (() => void) | undefined;

        const setup = async () => {
            const [{ Terminal: XTerm }, { FitAddon }, { WebLinksAddon }] = await Promise.all([
                import("@xterm/xterm"),
                import("@xterm/addon-fit"),
                import("@xterm/addon-web-links")
            ]);

            if (disposed || !terminalHostRef.current) {
                return;
            }

            const xterm = new XTerm({
                cursorBlink: true,
                rows: 24,
                cols: 100,
                fontSize: 14,
                fontFamily: "JetBrains Mono, monospace",
                theme: {
                    background: "#020703",
                    foreground: "#00ff41",
                    cursor: "#00d4ff",
                    selectionBackground: "rgba(0, 212, 255, 0.2)",
                    black: "#001100",
                    brightBlack: "#1a4a1a",
                    green: "#00ff41",
                    brightGreen: "#5dff8f",
                    red: "#ff2244",
                    brightRed: "#ff6179",
                    yellow: "#ffb800",
                    brightYellow: "#ffd973",
                    cyan: "#00d4ff",
                    brightCyan: "#67ebff"
                },
                allowProposedApi: true
            });

            const fitAddon = new FitAddon();
            xterm.loadAddon(fitAddon);
            xterm.loadAddon(new WebLinksAddon());
            xterm.open(terminalHostRef.current);
            fitAddon.fit();

            xtermRef.current = xterm;
            fitAddonRef.current = fitAddon;

            const pulse = () => {
                setGlow(true);
                window.setTimeout(() => setGlow(false), 240);
            };

            const disposable = xterm.onData((data) => {
                if (data === "\r") {
                    const command = commandBufferRef.current.trim().toLowerCase();
                    if (SPECIAL.has(command)) {
                        onSpecialCommand(command as "hack" | "matrix");
                    }
                    commandBufferRef.current = "";
                } else if (data === "\u007f") {
                    commandBufferRef.current = commandBufferRef.current.slice(0, -1);
                } else if (data >= " " && data !== "\u007f") {
                    commandBufferRef.current += data;
                }

                pulse();
                sendRaw(data);
            });

            const syncSize = () => {
                fitAddon.fit();
                sendResize(xterm.cols, xterm.rows);
            };

            syncSize();
            window.addEventListener("resize", syncSize);

            teardown = () => {
                disposable.dispose();
                window.removeEventListener("resize", syncSize);
                xterm.dispose();
                xtermRef.current = null;
                fitAddonRef.current = null;
            };
        };

        setup();

        return () => {
            disposed = true;
            teardown?.();
        };
    }, [onSpecialCommand, sendRaw, sendResize]);

    useEffect(() => {
        if (status === "connected" && xtermRef.current) {
            sendResize(xtermRef.current.cols, xtermRef.current.rows);
        }
    }, [sendResize, status]);

    return (
        <div className={`terminal-stage ${glow ? "terminal-stage-glow" : ""}`}>
            {status !== "connected" ? <div className="terminal-overlay">CONNECTING...</div> : null}
            <div ref={terminalHostRef} style={{ height: "100%", padding: "0.75rem" }} />
        </div>
    );
}