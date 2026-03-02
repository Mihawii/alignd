"use client";

import { useRef, useEffect, useState } from "react";

interface DonutChartProps {
    value: number;       // 0-100
    label: string;
    size?: number;
    color?: string;
}

export default function DonutChart({ value, label, size = 120, color = "#4ade80" }: DonutChartProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        let frame: number;
        let start: number | null = null;
        const duration = 900;

        const tick = (ts: number) => {
            if (!start) start = ts;
            const p = Math.min((ts - start) / duration, 1);
            setProgress(1 - Math.pow(1 - p, 3)); // ease-out cubic
            if (p < 1) frame = requestAnimationFrame(tick);
        };

        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.scale(dpr, dpr);

        const cx = size / 2;
        const cy = size / 2;
        const radius = size / 2 - 12;
        const lineWidth = 8;

        ctx.clearRect(0, 0, size, size);

        // Track
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(0, 0, 0, 0.05)";
        ctx.lineWidth = lineWidth;
        ctx.lineCap = "round";
        ctx.stroke();

        // Fill arc
        const angle = (value / 100) * Math.PI * 2 * progress;
        if (angle > 0) {
            ctx.beginPath();
            ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + angle);
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.lineCap = "round";
            ctx.stroke();
        }

        // Center text
        const displayVal = Math.round(value * progress);
        ctx.fillStyle = "#fafafa";
        ctx.font = `500 ${size * 0.2}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${displayVal}%`, cx, cy - 4);

        ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
        ctx.font = `500 ${size * 0.08}px Inter, system-ui, sans-serif`;
        ctx.fillText(label, cx, cy + size * 0.14);
    }, [value, progress, size, color, label]);

    return (
        <canvas
            ref={canvasRef}
            style={{ width: size, height: size, display: "block" }}
        />
    );
}
