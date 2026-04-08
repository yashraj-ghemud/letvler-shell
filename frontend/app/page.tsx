"use client";

import dynamic from "next/dynamic";
import { useMemo, useEffect, useState, useCallback } from "react";
import FileDownloader from "../components/FileDownloader";
import GlitchText from "../components/GlitchText";
import IntroSequence from "../components/IntroSequence";
import MatrixRain from "../components/MatrixRain";
import Terminal from "../components/Terminal";

const ParticleField = dynamic(() => import("../components/ParticleField"), {
    ssr: false
});

type SpecialCommand = "hack" | "matrix";

function resolveBackendBaseUrl() {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080/ws";

    try {
        const resolved = new URL(wsUrl);
        const protocol = resolved.protocol === "wss:" ? "https:" : "http:";
        return `${protocol}//${resolved.host}`;
    } catch (_error) {
        return "http://localhost:8080";
    }
}

export default function Page() {
    const [introDone, setIntroDone] = useState(false);
    const [matrixBoost, setMatrixBoost] = useState(1);
    const [screenFlash, setScreenFlash] = useState(false);
    const [cursor, setCursor] = useState({ x: 0, y: 0 });
    const [sessionId, setSessionId] = useState<string | null>(null);
    const backendBaseUrl = useMemo(() => resolveBackendBaseUrl(), []);

    useEffect(() => {
        const onMove = (event: MouseEvent) => {
            setCursor({ x: event.clientX, y: event.clientY });
        };

        window.addEventListener("mousemove", onMove);
        return () => window.removeEventListener("mousemove", onMove);
    }, []);

    const handleSpecialCommand = useCallback((command: SpecialCommand) => {
        if (command === "matrix") {
            setMatrixBoost(4);
            window.setTimeout(() => setMatrixBoost(1), 3000);
            return;
        }

        if (command === "hack") {
            setScreenFlash(true);
            window.setTimeout(() => setScreenFlash(false), 900);
        }
    }, []);

    return (
        <main className={`scene ${screenFlash ? "scene-flash" : ""}`}>
            <MatrixRain intensity={matrixBoost} cursor={cursor} />
            {introDone ? <ParticleField cursor={cursor} /> : null}

            <div className="vignette" />
            <div className="scanlines" />
            <div
                className="cursor-dot"
                style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }}
            />

            {!introDone ? <IntroSequence onComplete={() => setIntroDone(true)} /> : null}

            <section className={`terminal-shell ${introDone ? "terminal-shell-ready" : ""}`}>
                <header className="terminal-header">
                    <GlitchText className="terminal-title">BLACKSITE ACCESS NODE</GlitchText>
                    <span className="terminal-status">LIVE LINK</span>
                </header>

                <Terminal
                    onSpecialCommand={handleSpecialCommand}
                    onSessionIdChange={setSessionId}
                />
                <FileDownloader backendUrl={backendBaseUrl} sessionId={sessionId} />
            </section>
        </main>
    );
}