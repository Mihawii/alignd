"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import styles from "./Testimonial.module.css";

const testimonials = [
    {
        quote: "We used to spend 3 days building quarterly reports. Now it takes 4 minutes.",
        author: "Sarah Chen",
        role: "VP of Strategy",
        company: "Fortune 500 Retail",
    },
    {
        quote: "The AI flagged a revenue concentration risk our entire team missed.",
        author: "Marcus Webb",
        role: "Head of Analytics",
        company: "Growth-Stage SaaS",
    },
    {
        quote: "Finally, an analytics tool that speaks in sentences, not scatter plots.",
        author: "Elena Frost",
        role: "Chief of Staff",
        company: "Series B Fintech",
    },
];

export default function Testimonial() {
    const [activeIndex, setActiveIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    const springConfig = { damping: 25, stiffness: 200 };
    const x = useSpring(mouseX, springConfig);
    const y = useSpring(mouseY, springConfig);

    const numberX = useTransform(x, [-200, 200], [-20, 20]);
    const numberY = useTransform(y, [-200, 200], [-10, 10]);

    const handleMouseMove = (e: React.MouseEvent) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            mouseX.set(e.clientX - centerX);
            mouseY.set(e.clientY - centerY);
        }
    };

    const goNext = () => setActiveIndex((prev) => (prev + 1) % testimonials.length);
    const goPrev = () => setActiveIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);

    useEffect(() => {
        const timer = setInterval(goNext, 6000);
        return () => clearInterval(timer);
    }, []);

    const current = testimonials[activeIndex];

    return (
        <div className={styles.wrap}>
            <div ref={containerRef} className={styles.container} onMouseMove={handleMouseMove}>
                {/* Oversized index number */}
                <motion.div className={styles.bigNumber} style={{ x: numberX, y: numberY }}>
                    <AnimatePresence mode="wait">
                        <motion.span
                            key={activeIndex}
                            initial={{ opacity: 0, scale: 0.8, filter: "blur(10px)" }}
                            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                            exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
                            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                            className={styles.bigNumberSpan}
                        >
                            {String(activeIndex + 1).padStart(2, "0")}
                        </motion.span>
                    </AnimatePresence>
                </motion.div>

                {/* Main content */}
                <div className={styles.mainRow}>
                    {/* Left column — vertical text */}
                    <div className={styles.leftCol}>
                        <motion.span
                            className={styles.verticalLabel}
                            style={{ writingMode: "vertical-rl", textOrientation: "mixed" } as React.CSSProperties}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 }}
                        >
                            Testimonials
                        </motion.span>

                        {/* Vertical progress */}
                        <div className={styles.progressTrack}>
                            <motion.div
                                className={styles.progressFill}
                                animate={{ height: `${((activeIndex + 1) / testimonials.length) * 100}%` }}
                                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                            />
                        </div>
                    </div>

                    {/* Center — main content */}
                    <div className={styles.centerCol}>
                        {/* Company badge */}
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeIndex}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.4 }}
                                className={styles.badgeWrap}
                            >
                                <span className={styles.badge}>
                                    <span className={styles.badgeDot} />
                                    {current.company}
                                </span>
                            </motion.div>
                        </AnimatePresence>

                        {/* Quote */}
                        <div className={styles.quoteWrap}>
                            <AnimatePresence mode="wait">
                                <motion.blockquote
                                    key={activeIndex}
                                    className={styles.quote}
                                    initial="hidden"
                                    animate="visible"
                                    exit="exit"
                                >
                                    {current.quote.split(" ").map((word, i) => (
                                        <motion.span
                                            key={i}
                                            className={styles.quoteWord}
                                            variants={{
                                                hidden: { opacity: 0, y: 20, rotateX: 90 },
                                                visible: {
                                                    opacity: 1,
                                                    y: 0,
                                                    rotateX: 0,
                                                    transition: {
                                                        duration: 0.5,
                                                        delay: i * 0.05,
                                                        ease: [0.22, 1, 0.36, 1],
                                                    },
                                                },
                                                exit: {
                                                    opacity: 0,
                                                    y: -10,
                                                    transition: { duration: 0.2, delay: i * 0.02 },
                                                },
                                            }}
                                        >
                                            {word}
                                        </motion.span>
                                    ))}
                                </motion.blockquote>
                            </AnimatePresence>
                        </div>

                        {/* Author row */}
                        <div className={styles.authorRow}>
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeIndex}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    transition={{ duration: 0.4, delay: 0.2 }}
                                    className={styles.authorInfo}
                                >
                                    <motion.div
                                        className={styles.authorLine}
                                        initial={{ scaleX: 0 }}
                                        animate={{ scaleX: 1 }}
                                        transition={{ duration: 0.6, delay: 0.3 }}
                                    />
                                    <div>
                                        <p className={styles.authorName}>{current.author}</p>
                                        <p className={styles.authorRole}>{current.role}</p>
                                    </div>
                                </motion.div>
                            </AnimatePresence>

                            {/* Navigation */}
                            <div className={styles.navBtns}>
                                <motion.button onClick={goPrev} className={styles.navBtn} whileTap={{ scale: 0.95 }}>
                                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                                        <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </motion.button>
                                <motion.button onClick={goNext} className={styles.navBtn} whileTap={{ scale: 0.95 }}>
                                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                                        <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </motion.button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom ticker */}
                <div className={styles.ticker}>
                    <motion.div
                        className={styles.tickerInner}
                        animate={{ x: [0, -1000] }}
                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    >
                        {[...Array(10)].map((_, i) => (
                            <span key={i} className={styles.tickerChunk}>
                                {testimonials.map((t) => t.company).join(" • ")} •
                            </span>
                        ))}
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
