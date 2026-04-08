"use client";

import { useMemo, useState } from "react";

type FileDownloaderProps = {
    backendUrl: string;
    sessionId: string | null;
};

function encodePathForRoute(filePath: string): string {
    return filePath
        .split("/")
        .filter((segment) => segment.length > 0)
        .map((segment) => encodeURIComponent(segment))
        .join("/");
}

function resolveFilename(filePath: string): string {
    const parts = filePath.split("/").filter(Boolean);
    if (parts.length === 0) {
        return "download.bin";
    }

    return parts[parts.length - 1];
}

export default function FileDownloader({ backendUrl, sessionId }: FileDownloaderProps) {
    const [filePath, setFilePath] = useState("/home/ctf/workspace/output.txt");
    const [status, setStatus] = useState("Idle");
    const [isDownloading, setIsDownloading] = useState(false);

    const normalizedBackend = useMemo(() => backendUrl.replace(/\/$/, ""), [backendUrl]);

    const handleDownload = async () => {
        const cleanedPath = filePath.trim();
        if (!sessionId) {
            setStatus("Session not ready");
            return;
        }

        if (!cleanedPath) {
            setStatus("Enter a file path");
            return;
        }

        setIsDownloading(true);
        setStatus("Downloading...");

        try {
            const encodedPath = encodePathForRoute(cleanedPath);
            const url = `${normalizedBackend}/api/download/${encodeURIComponent(sessionId)}/${encodedPath}`;
            const response = await fetch(url, {
                method: "GET"
            });

            if (!response.ok) {
                setStatus(response.status === 404 ? "File not found" : "Download failed");
                return;
            }

            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = objectUrl;
            anchor.download = resolveFilename(cleanedPath);
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(objectUrl);

            setStatus("Success [OK]");
        } catch (_error) {
            setStatus("Download failed");
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="download-panel">
            <label htmlFor="download-path" className="download-label">
                Artifact Path
            </label>
            <div className="download-controls">
                <input
                    id="download-path"
                    className="download-input"
                    type="text"
                    value={filePath}
                    onChange={(event) => setFilePath(event.target.value)}
                    placeholder="/home/ctf/workspace/notes.txt"
                    spellCheck={false}
                />
                <button
                    className="download-button"
                    onClick={handleDownload}
                    type="button"
                    disabled={isDownloading || !sessionId}
                >
                    {isDownloading ? "Working..." : "Download"}
                </button>
            </div>
            <p className="download-status">{status}</p>
        </div>
    );
}
