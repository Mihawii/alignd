"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";

interface ScrollRevealProps {
    children: ReactNode;
    delay?: number;
    className?: string;
    /** How much of the element must be in view to trigger (0-1) */
    amount?: number;
}

/**
 * Wraps children with the same dramatic 3D flip-up animation
 * used in the Testimonial section:
 *   hidden → opacity: 0, y: 20, rotateX: 90°
 *   visible → opacity: 1, y: 0, rotateX: 0°
 */
export default function ScrollReveal({
    children,
    delay = 0,
    className,
    amount = 0.15,
}: ScrollRevealProps) {
    return (
        <motion.div
            className={className}
            style={{ perspective: 800 }}
            initial={{ opacity: 0, y: 20, rotateX: 90 }}
            whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
            viewport={{ once: true, amount }}
            transition={{
                duration: 0.5,
                delay,
                ease: [0.22, 1, 0.36, 1],
            }}
        >
            {children}
        </motion.div>
    );
}
