"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ConnectionStatus = "connecting" | "connected" | "disconnected";

type UseTerminalWSOptions = {
    onMessage?: (chunk: string) => void;
    onServerNotice?: (message: string) => void;
};

type ResizePayload = {
    type: "resize";
    cols: number;
    rows: number;
};

type SessionIdPayload = {
    type: "session_id";
    id: string;
};

type ServerNoticePayload = {
    type: "server_notice";
    message: string;
};

type ControlPayload = SessionIdPayload | ServerNoticePayload;

function decodeMessage(payload: Blob | ArrayBuffer | string): Promise<string> {
    if (typeof payload === "string") {
        return Promise.resolve(payload);
    }

    if (payload instanceof ArrayBuffer) {
        return Promise.resolve(new TextDecoder().decode(payload));
    }

    return payload.text();
}

function tryParseControlPayload(payload: string): ControlPayload | null {
    try {
        const parsed = JSON.parse(payload);
        if (!parsed || typeof parsed !== "object" || !("type" in parsed)) {
            return null;
        }

        if (parsed.type === "session_id" && typeof parsed.id === "string") {
            return {
                type: "session_id",
                id: parsed.id
            };
        }

        if (parsed.type === "server_notice" && typeof parsed.message === "string") {
            return {
                type: "server_notice",
                message: parsed.message
            };
        }
    } catch (_error) {
        return null;
    }

    return null;
}

function buildSocketUrl(baseUrl: string, sessionId: string | null): string {
    const resolved = new URL(baseUrl, window.location.href);
    if (sessionId) {
        resolved.searchParams.set("sessionId", sessionId);
    }

    return resolved.toString();
}

export default function useTerminalWS(wsUrl: string, options: UseTerminalWSOptions = {}) {
    const [status, setStatus] = useState<ConnectionStatus>("connecting");
    const [sessionId, setSessionId] = useState<string | null>(null);
    const socketRef = useRef<WebSocket | null>(null);
    const reconnectTimerRef = useRef<number | null>(null);
    const isActiveRef = useRef(false);
    const connectAttemptRef = useRef(0);
    const retriesRef = useRef(0);
    const messageHandlerRef = useRef(options.onMessage);
    const noticeHandlerRef = useRef(options.onServerNotice);
    const sessionIdRef = useRef<string | null>(null);

    useEffect(() => {
        messageHandlerRef.current = options.onMessage;
    }, [options.onMessage]);

    useEffect(() => {
        noticeHandlerRef.current = options.onServerNotice;
    }, [options.onServerNotice]);

    const clearReconnectTimer = () => {
        if (reconnectTimerRef.current !== null) {
            window.clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }
    };

    const connect = useCallback(() => {
        if (!isActiveRef.current) {
            return;
        }

        clearReconnectTimer();
        setStatus("connecting");

        if (
            socketRef.current &&
            (socketRef.current.readyState === WebSocket.OPEN ||
                socketRef.current.readyState === WebSocket.CONNECTING)
        ) {
            socketRef.current.onopen = null;
            socketRef.current.onmessage = null;
            socketRef.current.onerror = null;
            socketRef.current.onclose = null;
            socketRef.current.close();
        }

        const socket = new WebSocket(buildSocketUrl(wsUrl, sessionIdRef.current));
        const attemptId = ++connectAttemptRef.current;
        socketRef.current = socket;

        const isCurrentAttempt = () =>
            isActiveRef.current && socketRef.current === socket && connectAttemptRef.current === attemptId;

        socket.onopen = () => {
            if (!isCurrentAttempt()) {
                return;
            }

            retriesRef.current = 0;
            setStatus("connected");
        };

        socket.onmessage = async (event) => {
            if (!isCurrentAttempt()) {
                return;
            }

            const decoded = await decodeMessage(event.data as Blob | ArrayBuffer | string);

            const controlPayload = tryParseControlPayload(decoded);
            if (controlPayload?.type === "session_id") {
                sessionIdRef.current = controlPayload.id;
                setSessionId(controlPayload.id);
                return;
            }

            if (controlPayload?.type === "server_notice") {
                noticeHandlerRef.current?.(controlPayload.message);
                return;
            }

            messageHandlerRef.current?.(decoded);
        };

        socket.onclose = () => {
            if (!isCurrentAttempt()) {
                return;
            }

            setStatus("disconnected");
            const waitMs = Math.min(5000 * (retriesRef.current + 1), 12000);
            retriesRef.current += 1;
            reconnectTimerRef.current = window.setTimeout(connect, waitMs);
        };

        socket.onerror = () => {
            if (!isCurrentAttempt()) {
                return;
            }

            socket.close();
        };
    }, [wsUrl]);

    useEffect(() => {
        isActiveRef.current = true;
        connect();

        return () => {
            isActiveRef.current = false;
            clearReconnectTimer();

            if (socketRef.current) {
                socketRef.current.onopen = null;
                socketRef.current.onmessage = null;
                socketRef.current.onerror = null;
                socketRef.current.onclose = null;
                socketRef.current.close();
                socketRef.current = null;
            }
        };
    }, [connect]);

    const sendRaw = useCallback((chunk: string) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(chunk);
        }
    }, []);

    const sendResize = useCallback((cols: number, rows: number) => {
        if (socketRef.current?.readyState !== WebSocket.OPEN) {
            return;
        }

        const payload: ResizePayload = {
            type: "resize",
            cols,
            rows
        };

        socketRef.current.send(JSON.stringify(payload));
    }, []);

    return {
        status,
        sessionId,
        sendRaw,
        sendResize
    };
}