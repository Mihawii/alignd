"use client";

import { useRef, useEffect, useState, useCallback } from "react";

interface DataPoint {
    label: string;
    count: number;
}

interface LineChartProps {
    title: string;
    data: DataPoint[];
    color?: string;
    height?: number;
}

export default function LineChart({ title, data, color = "#ff5100", height = 180 }: LineChartProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [canvasWidth, setCanvasWidth] = useState(500);
    const [animProgress, setAnimProgress] = useState(0);
    const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; value: number } | null>(null);

    const padL = 40, padR = 16, padT = 8, padB = 28;

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
        const duration = 800;
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
        if (data.length < 2) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const chartW = canvasWidth - padL - padR;
        const maxVal = Math.max(...data.map(d => d.count));
        const range = maxVal || 1;
        const chartH = height - padT - padB;

        let closest = 0;
        let closestDist = Infinity;
        for (let i = 0; i < data.length; i++) {
            const x = padL + (i / (data.length - 1)) * chartW;
            const dist = Math.abs(mx - x);
            if (dist < closestDist) { closestDist = dist; closest = i; }
        }

        if (closestDist < 40) {
            const x = padL + (closest / (data.length - 1)) * chartW;
            const y = padT + chartH - (data[closest].count / range) * chartH;
            setTooltip({ x, y, label: data[closest].label, value: data[closest].count });
        } else {
            setTooltip(null);
        }
    }, [data, canvasWidth, height]);

    const handleMouseLeave = useCallback(() => setTooltip(null), []);

    /* ── Draw ─────────────────────────────────────── */
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || data.length < 2) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = canvasWidth * dpr;
        canvas.height = height * dpr;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, canvasWidth, height);

        const chartW = canvasWidth - padL - padR;
        const chartH = height - padT - padB;
        const maxVal = Math.max(...data.map(d => d.count));
        const minVal = 0;
        const range = maxVal - minVal || 1;

        const getX = (i: number) => padL + (i / (data.length - 1)) * chartW;
        const getY = (val: number) => padT + chartH - ((val - minVal) / range) * chartH;

        // Grid
        for (let i = 0; i <= 4; i++) {
            const y = padT + (i / 4) * chartH;
            ctx.strokeStyle = "rgba(0, 0, 0, 0.04)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(padL, y);
            ctx.lineTo(padL + chartW, y);
            ctx.stroke();

            const val = maxVal - (i / 4) * range;
            ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
            ctx.font = "500 9px Inter, system-ui, sans-serif";
            ctx.textAlign = "right";
            ctx.textBaseline = "middle";
            ctx.fillText(val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toFixed(0), padL - 6, y);
        }

        // X labels
        const labelStep = Math.max(1, Math.floor(data.length / 6));
        data.forEach((d, i) => {
            if (i % labelStep !== 0 && i !== data.length - 1) return;
            ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
            ctx.font = "500 9px Inter, system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillText(d.label, getX(i), padT + chartH + 8);
        });

        // Gradient fill
        const grad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
        grad.addColorStop(0, color + "18");
        grad.addColorStop(1, color + "00");

        ctx.beginPath();
        ctx.moveTo(getX(0), padT + chartH);
        for (let i = 0; i < data.length; i++) {
            const targetY = getY(data[i].count);
            const y = padT + chartH + (targetY - padT - chartH) * animProgress;
            if (i === 0) ctx.lineTo(getX(i), y);
            else {
                const prevX = getX(i - 1);
                const cpx = (prevX + getX(i)) / 2;
                const prevY = padT + chartH + (getY(data[i - 1].count) - padT - chartH) * animProgress;
                ctx.bezierCurveTo(cpx, prevY, cpx, y, getX(i), y);
            }
        }
        ctx.lineTo(getX(data.length - 1), padT + chartH);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        // Line
        ctx.beginPath();
        for (let i = 0; i < data.length; i++) {
            const targetY = getY(data[i].count);
            const y = padT + chartH + (targetY - padT - chartH) * animProgress;
            if (i === 0) ctx.moveTo(getX(i), y);
            else {
                const prevX = getX(i - 1);
                const cpx = (prevX + getX(i)) / 2;
                const prevY = padT + chartH + (getY(data[i - 1].count) - padT - chartH) * animProgress;
                ctx.bezierCurveTo(cpx, prevY, cpx, y, getX(i), y);
            }
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Dots
        for (let i = 0; i < data.length; i++) {
            const targetY = getY(data[i].count);
            const y = padT + chartH + (targetY - padT - chartH) * animProgress;
            const isHovered = tooltip && tooltip.label === data[i].label;
            ctx.beginPath();
            ctx.arc(getX(i), y, isHovered ? 5 : 3, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            if (!isHovered) {
                ctx.beginPath();
                ctx.arc(getX(i), y, 1.5, 0, Math.PI * 2);
                ctx.fillStyle = "#0d0d10";
                ctx.fill();
            }
        }

        // Hover line
        if (tooltip) {
            ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(tooltip.x, padT);
            ctx.lineTo(tooltip.x, padT + chartH);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }, [data, animProgress, canvasWidth, height, color, tooltip]);

    return (
        <div ref={containerRef} style={{ width: "100%", position: "relative" }}>
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
                style={{ width: "100%", height, display: "block", cursor: "crosshair" }}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
            />
            {tooltip && (
                <div style={{
                    position: "absolute",
                    left: tooltip.x,
                    top: tooltip.y - 38,
                    transform: "translateX(-50%)",
                    background: "#1a1a24",
                    border: "1px solid rgba(255, 81, 0, 0.2)",
                    borderRadius: "7px",
                    padding: "5px 10px",
                    pointerEvents: "none",
                    zIndex: 10,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                }}>
                    <span style={{ fontSize: "11px", color: "#fafafa", fontWeight: 600 }}>
                        {tooltip.value.toLocaleString()}
                    </span>
                    <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)", marginLeft: "6px" }}>
                        {tooltip.label}
                    </span>
                </div>
            )}
        </div>
    );
}
