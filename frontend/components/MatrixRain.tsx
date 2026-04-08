"use client";

import { useEffect, useRef } from "react";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$#@%&*";

type MatrixRainProps = {
    intensity: number;
    cursor: {
        x: number;
        y: number;
    };
};

export default function MatrixRain({ intensity, cursor }: MatrixRainProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const intensityRef = useRef(intensity);
    const cursorRef = useRef(cursor);

    useEffect(() => {
        intensityRef.current = intensity;
    }, [intensity]);

    useEffect(() => {
        cursorRef.current = cursor;
    }, [cursor]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }

        const context = canvas.getContext("2d");
        if (!context) {
            return;
        }

        let animationId = 0;
        let width = 0;
        let height = 0;
        const fontSize = 16;
        let columns = 0;
        let drops: number[] = [];

        const resize = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;
            columns = Math.ceil(width / fontSize);
            drops = Array.from({ length: columns }, () => Math.random() * (height / fontSize));
        };

        const draw = () => {
            context.fillStyle = "rgba(0, 0, 0, 0.11)";
            context.fillRect(0, 0, width, height);

            context.font = `${fontSize}px var(--font-terminal), monospace`;

            for (let index = 0; index < columns; index += 1) {
                const char = CHARS[Math.floor(Math.random() * CHARS.length)];
                const x = index * fontSize;
                const y = drops[index] * fontSize;

                const cursorPoint = cursorRef.current;

                const distanceX = Math.abs(cursorPoint.x - x);
                const distanceY = Math.abs(cursorPoint.y - y);
                const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
                const cursorBoost = distance < 180 ? 0.9 : 0;

                context.fillStyle = distance < 150 ? "#00d4ff" : "#00ff41";
                context.fillText(char, x, y);

                const speed = 0.45 + intensityRef.current * 0.35 + cursorBoost;
                drops[index] += speed;

                if (y > height && Math.random() > 0.975) {
                    drops[index] = 0;
                }
            }

            animationId = window.requestAnimationFrame(draw);
        };

        resize();
        draw();

        window.addEventListener("resize", resize);
        return () => {
            window.removeEventListener("resize", resize);
            window.cancelAnimationFrame(animationId);
        };
    }, []);

    return <canvas ref={canvasRef} className="matrix" aria-hidden="true" />;
}