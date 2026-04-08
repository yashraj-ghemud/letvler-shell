"use client";

import { useEffect, useRef } from "react";
import { runIntroSequence } from "../lib/gsapAnimations";

type IntroSequenceProps = {
    onComplete: () => void;
};

export default function IntroSequence({ onComplete }: IntroSequenceProps) {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const titleRef = useRef<HTMLParagraphElement | null>(null);
    const logsRef = useRef<HTMLPreElement | null>(null);
    const accessRef = useRef<HTMLParagraphElement | null>(null);

    useEffect(() => {
        if (!rootRef.current || !titleRef.current || !logsRef.current || !accessRef.current) {
            return;
        }

        const cleanup = runIntroSequence({
            root: rootRef.current,
            title: titleRef.current,
            logs: logsRef.current,
            access: accessRef.current,
            onComplete
        });

        return cleanup;
    }, [onComplete]);

    return (
        <section ref={rootRef} className="intro-screen">
            <p ref={titleRef} className="intro-title" />
            <pre ref={logsRef} className="intro-logs" />
            <p ref={accessRef} className="intro-access">
                ACCESS GRANTED
            </p>
        </section>
    );
}