"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type ParticleFieldProps = {
    cursor: {
        x: number;
        y: number;
    };
};

export default function ParticleField({ cursor }: ParticleFieldProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const mouseRef = useRef(new THREE.Vector2(0, 0));

    useEffect(() => {
        const x = (cursor.x / window.innerWidth) * 2 - 1;
        const y = -(cursor.y / window.innerHeight) * 2 + 1;
        mouseRef.current.set(x, y);
    }, [cursor.x, cursor.y]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }

        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = 60;

        const particleCount = 350;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const base = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount; i += 1) {
            const i3 = i * 3;
            const x = (Math.random() - 0.5) * 140;
            const y = (Math.random() - 0.5) * 90;
            const z = (Math.random() - 0.5) * 70;

            positions[i3] = x;
            positions[i3 + 1] = y;
            positions[i3 + 2] = z;

            base[i3] = x;
            base[i3 + 1] = y;
            base[i3 + 2] = z;
        }

        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            color: "#00d4ff",
            size: 0.45,
            transparent: true,
            opacity: 0.6
        });

        const points = new THREE.Points(geometry, material);
        scene.add(points);

        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(window.innerWidth, window.innerHeight);

        let raf = 0;

        const onResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        };

        const animate = () => {
            const positionAttribute = geometry.getAttribute("position") as THREE.BufferAttribute;

            for (let i = 0; i < particleCount; i += 1) {
                const i3 = i * 3;
                const baseX = base[i3];
                const baseY = base[i3 + 1];
                const sway = Math.sin((Date.now() * 0.0006) + i * 0.11) * 0.17;

                const nx = baseX + sway;
                const ny = baseY + sway;
                const dx = mouseRef.current.x * 35 - nx;
                const dy = mouseRef.current.y * 22 - ny;
                const d2 = dx * dx + dy * dy;
                const influence = d2 < 520 ? 0.024 : 0;

                positions[i3] += (baseX + dx * influence - positions[i3]) * 0.03;
                positions[i3 + 1] += (baseY + dy * influence - positions[i3 + 1]) * 0.03;
                positions[i3 + 2] += (base[i3 + 2] - positions[i3 + 2]) * 0.03;

                positionAttribute.setXYZ(i, positions[i3], positions[i3 + 1], positions[i3 + 2]);
            }

            positionAttribute.needsUpdate = true;
            points.rotation.y += 0.0005;
            renderer.render(scene, camera);
            raf = window.requestAnimationFrame(animate);
        };

        window.addEventListener("resize", onResize);
        animate();

        return () => {
            window.removeEventListener("resize", onResize);
            window.cancelAnimationFrame(raf);
            geometry.dispose();
            material.dispose();
            renderer.dispose();
        };
    }, []);

    return <canvas ref={canvasRef} className="particles" aria-hidden="true" />;
}