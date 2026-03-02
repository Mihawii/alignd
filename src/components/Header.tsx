"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Header.module.css";

export default function Header() {
    const pathname = usePathname();

    return (
        <header className={styles.header}>
            <Link href="/" className={styles.logoLink}>
                <img src="/assets/logonobackground.png" alt="alignd" className={styles.logoImage} />
                <span className={styles.logoText}>alignd</span>
            </Link>

            <nav className={styles.nav}>
                <Link
                    href="/upload"
                    className={`${styles.navLink} ${pathname === "/upload" ? styles.navLinkActive : ""}`}
                >
                    Upload
                </Link>
                <Link
                    href="/chat"
                    className={`${styles.navLink} ${pathname === "/chat" ? styles.navLinkActive : ""}`}
                >
                    Analyze
                </Link>
            </nav>
        </header>
    );
}
