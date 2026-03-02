"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface ScrollFramesProps {
    frameCount: number;
    framePath: string; // e.g. "/frames/frame_" — gets padded number + ".jpg" appended
    width: number;
    height: number;
}

export default function ScrollFrames({ frameCount, framePath, width, height }: ScrollFramesProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const imagesRef = useRef<HTMLImageElement[]>([]);
    const [loaded, setLoaded] = useState(false);
    const currentFrameRef = useRef(0);
    const rafRef = useRef<number>(0);

    // Preload all frames
    useEffect(() => {
        let mounted = true;
        const images: HTMLImageElement[] = [];
        let loadedCount = 0;

        for (let i = 1; i <= frameCount; i++) {
            const img = new Image();
            const padded = String(i).padStart(4, "0");
            img.src = `${framePath}${padded}.jpg`;
            img.onload = () => {
                loadedCount++;
                if (loadedCount === frameCount && mounted) {
                    imagesRef.current = images;
                    setLoaded(true);
                    // Draw first frame
                    const canvas = canvasRef.current;
                    const ctx = canvas?.getContext("2d");
                    if (ctx && images[0]) {
                        ctx.drawImage(images[0], 0, 0, canvas!.width, canvas!.height);
                    }
                }
            };
            images.push(img);
        }

        return () => { mounted = false; };
    }, [frameCount, framePath]);

    // Scroll handler
    const handleScroll = useCallback(() => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas || !loaded) return;

        const rect = container.getBoundingClientRect();
        const scrollHeight = container.offsetHeight - window.innerHeight;
        const scrollTop = -rect.top;
        const progress = Math.max(0, Math.min(1, scrollTop / scrollHeight));
        const frameIndex = Math.min(Math.floor(progress * (frameCount - 1)), frameCount - 1);

        if (frameIndex !== currentFrameRef.current && imagesRef.current[frameIndex]) {
            currentFrameRef.current = frameIndex;
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.drawImage(imagesRef.current[frameIndex], 0, 0, canvas.width, canvas.height);
            }
        }
    }, [loaded, frameCount]);

    useEffect(() => {
        const onScroll = () => {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(handleScroll);
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        handleScroll(); // initial draw
        return () => {
            window.removeEventListener("scroll", onScroll);
            cancelAnimationFrame(rafRef.current);
        };
    }, [handleScroll]);

    return (
        <div ref={containerRef} style={{ height: `${frameCount * 28}px`, position: "relative" }}>
            <div style={{
                position: "sticky",
                top: 0,
                height: "100vh",
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
            }}>
                <canvas
                    ref={canvasRef}
                    width={width}
                    height={height}
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        opacity: loaded ? 1 : 0,
                        transition: "opacity 0.5s ease",
                    }}
                />
                {!loaded && (
                    <div style={{
                        position: "absolute",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "8px",
                        color: "var(--text-tertiary)",
                        fontSize: "12px",
                    }}>
                        <div style={{ width: "24px", height: "24px", border: "2px solid var(--border)", borderTopColor: "var(--text-tertiary)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                        Loading frames...
                    </div>
                )}
            </div>
        </div>
    );
}
