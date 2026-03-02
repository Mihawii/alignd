"use client";

import { useRef, useEffect } from "react";
import Link from "next/link";
import styles from "./page.module.css";

export default function HeroFrames() {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        /* Just play the video naturally — smooth 60fps, no scroll jank */
        const play = () => {
            video.muted = true;
            video.play().catch(() => { });
        };

        if (video.readyState >= 1) {
            play();
        } else {
            video.addEventListener("canplay", play, { once: true });
        }
    }, []);

    return (
        <div className={styles.heroContainer}>
            <div className={styles.heroSticky}>
                {/* Autoplay looping background video */}
                <video
                    ref={videoRef}
                    className={styles.heroVideo}
                    src="/assets/A_seamless_looping_1080p_202602242202.mp4"
                    muted
                    playsInline
                    autoPlay
                    loop
                    preload="auto"
                />
                <div className={styles.heroVideoOverlay} />

                {/* Text content */}
                <div className={styles.heroContent}>
                    <img
                        src="/assets/logonobackground.png"
                        alt="alignd"
                        className={styles.heroLogo}
                    />

                    <h1 className={styles.title}>
                        Your Data.{" "}
                        <span className={styles.titleLight}>Instant Intelligence.</span>
                    </h1>

                    <p className={styles.subtitle}>
                        Upload any dataset. Ask questions in plain language.
                        Get structured analytics — not walls of text.
                    </p>

                    <div className={styles.cta}>
                        <Link href="/upload" className={styles.ctaPrimary}>
                            Upload Dataset
                        </Link>
                        <Link href="/chat" className={styles.ctaSecondary}>
                            Try Demo →
                        </Link>
                    </div>

                    <div className={styles.stats}>
                        <div className={styles.stat}>
                            <div className={styles.statValue}>10x</div>
                            <div className={styles.statLabel}>Faster than SQL</div>
                        </div>
                        <div className={styles.stat}>
                            <div className={styles.statValue}>0</div>
                            <div className={styles.statLabel}>Code Required</div>
                        </div>
                        <div className={styles.stat}>
                            <div className={styles.statValue}>∞</div>
                            <div className={styles.statLabel}>Questions</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
