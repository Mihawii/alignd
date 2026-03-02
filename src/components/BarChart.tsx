"use client";

import { useRef, useEffect, useState, useCallback } from "react";

interface BarData {
    label: string;
    value: number | string;
    percentage: number;
}

interface BarChartProps {
    title: string;
    data: BarData[];
    height?: number;
}

const COLORS = [
    "rgba(0, 0, 0, 0.5)",
    "rgba(0, 0, 0, 0.4)",
    "rgba(0, 0, 0, 0.35)",
    "rgba(0, 0, 0, 0.25)",
    "rgba(0, 0, 0, 0.2)",
    "rgba(0, 0, 0, 0.15)",
    "rgba(0, 0, 0, 0.12)",
    "rgba(0, 0, 0, 0.1)",
];

export default function BarChart({ title, data, height: propHeight }: BarChartProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [animProgress, setAnimProgress] = useState(0);
    const [canvasWidth, setCanvasWidth] = useState(600);
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

    const barH = 28;
    const gap = 6;
    const topPad = 8;
    const bottomPad = 12;
    const labelCol = 90;
    const valueCol = 60;
    const chartHeight = propHeight || topPad + data.length * (barH + gap) - gap + bottomPad;

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) setCanvasWidth(entry.contentRect.width);
        });
        ro.observe(el);
        setCanvasWidth(el.clientWidth);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        let frame: number;
        let start: number | null = null;
        const duration = 700;
        const tick = (ts: number) => {
            if (!start) start = ts;
            const p = Math.min((ts - start) / duration, 1);
            setAnimProgress(1 - Math.pow(1 - p, 3));
            if (p < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, []);

    /* ── Hover detection ─────────────────────────── */
    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const my = e.clientY - rect.top;

        let found: number | null = null;
        for (let i = 0; i < data.length; i++) {
            const y = topPad + i * (barH + gap);
            if (my >= y && my <= y + barH) { found = i; break; }
        }
        setHoveredIdx(found);
    }, [data.length]);

    const handleMouseLeave = useCallback(() => setHoveredIdx(null), []);

    /* ── Draw ─────────────────────────────────────── */
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = canvasWidth * dpr;
        canvas.height = chartHeight * dpr;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, canvasWidth, chartHeight);

        const barAreaX = labelCol;
        const barAreaW = canvasWidth - labelCol - valueCol - 16;

        data.forEach((item, i) => {
            const y = topPad + i * (barH + gap);
            const isHovered = hoveredIdx === i;

            // Hover highlight row
            if (isHovered) {
                ctx.fillStyle = "rgba(255, 81, 0, 0.04)";
                roundRect(ctx, 0, y - 1, canvasWidth, barH + 2, 6);
                ctx.fill();
            }

            // Label
            ctx.font = `${isHovered ? 600 : 500} 11px Inter, system-ui, sans-serif`;
            ctx.fillStyle = isHovered ? "rgba(0, 0, 0, 0.85)" : "rgba(0, 0, 0, 0.6)";
            ctx.textAlign = "right";
            ctx.textBaseline = "middle";
            const labelText = item.label.length > 12 ? item.label.slice(0, 11) + "…" : item.label;
            ctx.fillText(labelText, labelCol - 12, y + barH / 2);

            // Bar track
            ctx.fillStyle = "rgba(0, 0, 0, 0.04)";
            roundRect(ctx, barAreaX, y + 4, barAreaW, barH - 8, 4);
            ctx.fill();

            // Bar fill
            const fillW = Math.max(0, (barAreaW * (item.percentage / 100)) * animProgress);
            if (fillW > 0) {
                ctx.fillStyle = isHovered
                    ? "rgba(255, 81, 0, 0.45)"
                    : COLORS[i % COLORS.length];
                roundRect(ctx, barAreaX, y + 4, fillW, barH - 8, 4);
                ctx.fill();
            }

            // Value
            ctx.font = `600 11px 'JetBrains Mono', monospace`;
            ctx.fillStyle = isHovered ? "rgba(0, 0, 0, 0.85)" : "rgba(0, 0, 0, 0.55)";
            ctx.textAlign = "left";
            ctx.fillText(String(item.value), canvasWidth - valueCol, y + barH / 2);

            // Percentage on hover
            if (isHovered) {
                ctx.font = "500 9px Inter, system-ui, sans-serif";
                ctx.fillStyle = "rgba(255, 81, 0, 0.7)";
                ctx.textAlign = "left";
                ctx.fillText(`${item.percentage.toFixed(0)}%`, barAreaX + fillW + 6, y + barH / 2);
            }

            // Rank
            ctx.font = "500 9px 'JetBrains Mono', monospace";
            ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
            ctx.textAlign = "right";
            ctx.fillText(String(i + 1), 14, y + barH / 2);
        });
    }, [data, animProgress, canvasWidth, chartHeight, hoveredIdx]);

    return (
        <div ref={containerRef} style={{ width: "100%" }}>
            {title && (
                <div style={{
                    fontSize: "11px", fontWeight: 600, color: "rgba(0, 0, 0, 0.4)",
                    textTransform: "uppercase" as const, letterSpacing: "0.04em",
                    marginBottom: "8px", paddingBottom: "6px",
                    borderBottom: "1px solid rgba(0, 0, 0, 0.06)",
                }}>{title}</div>
            )}
            <canvas
                ref={canvasRef}
                style={{ width: "100%", height: chartHeight, display: "block", cursor: "pointer" }}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
            />
        </div>
    );
}

function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number, r: number
) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}
