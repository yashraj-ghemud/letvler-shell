import { gsap } from "gsap";
import { TextPlugin } from "gsap/TextPlugin";

gsap.registerPlugin(TextPlugin);

type IntroRefs = {
    root: HTMLDivElement;
    title: HTMLParagraphElement;
    logs: HTMLPreElement;
    access: HTMLParagraphElement;
    onComplete: () => void;
};

const BOOT_LOGS = [
    "[00:00:01] Resolving tunnel nodes...",
    "[00:00:02] Handshake: 185.74.12.22 > 10.91.44.7",
    "[00:00:03] Decrypting stream key...",
    "[00:00:03] Signature accepted: BLACKSITE-DELTA",
    "[00:00:04] Establishing shell session...",
    "[00:00:05] Forwarding secure socket..."
];

export function runIntroSequence({ root, title, logs, access, onComplete }: IntroRefs) {
    const timeline = gsap.timeline({ defaults: { ease: "power2.out" } });

    const appendLogs = () => {
        logs.textContent = "";
        BOOT_LOGS.forEach((line, index) => {
            timeline.call(
                () => {
                    logs.textContent = `${logs.textContent}${line}\n`;
                },
                [],
                `>+=${index === 0 ? 0 : 0.12}`
            );
        });
    };

    timeline
        .set(root, { autoAlpha: 1 })
        .fromTo(root, { opacity: 0 }, { opacity: 1, duration: 0.35 })
        .to(title, { text: "CONNECTING TO SECURE SERVER...", duration: 1.05 }, ">+0.25")
        .call(appendLogs)
        .fromTo(access, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.28 }, ">+0.4")
        .to(access, { opacity: 0.55, repeat: 3, yoyo: true, duration: 0.14 }, ">")
        .to(root, { opacity: 0, duration: 0.6 }, ">+0.5")
        .call(onComplete)
        .set(root, { display: "none" });

    return () => {
        timeline.kill();
    };
}