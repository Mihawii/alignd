"use client";

import Link from "next/link";
import Header from "@/components/Header";
import Testimonial from "@/components/Testimonial";
import ScrollReveal from "@/components/ScrollReveal";
import styles from "./page.module.css";
import HeroFrames from "./HeroFrames";

export default function Home() {
  return (
    <>
      <Header />
      <HeroFrames />

      {/* ── Section 2: Testimonials ──────────────── */}
      <section className={`${styles.section} ${styles.sectionFull}`}>
        <ScrollReveal>
          <Testimonial />
        </ScrollReveal>
      </section>

      {/* ── Section 3: Bento Features ─────────────── */}
      <section className={`${styles.section} ${styles.sectionDark}`}>
        <div className={styles.sectionInner}>
          <ScrollReveal>
            <div className={styles.sectionLabel}>Capabilities</div>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <h2 className={styles.sectionHeading}>
              Built for people who<br />read, not decode
            </h2>
          </ScrollReveal>

          <div className={styles.bentoGrid}>
            {/* Row 1: 2 wide + 1 narrow */}
            <ScrollReveal delay={0.05} className={`${styles.bentoCard} ${styles.bentoWide}`}>
              <div className={styles.bentoBackground}>
                <div className={styles.bentoBgGlow} />
              </div>
              <div className={styles.bentoBody}>
                <div className={styles.bentoIcon}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
                  </svg>
                </div>
                <h3 className={styles.bentoTitle}>Executive Briefs</h3>
                <p className={styles.bentoDesc}>
                  Narrative-first analytics with KPI strips, ranked comparisons,
                  and key findings — the format executives actually read.
                </p>
              </div>
              <div className={styles.bentoCta}>
                <Link href="/chat" className={styles.bentoCtaLink}>
                  Try it now <span className={styles.bentoArrow}>→</span>
                </Link>
              </div>
              <div className={styles.bentoOverlay} />
            </ScrollReveal>

            <ScrollReveal delay={0.1} className={styles.bentoCard}>
              <div className={styles.bentoBackground}>
                <div className={styles.bentoBgGlow} />
              </div>
              <div className={styles.bentoBody}>
                <div className={styles.bentoIcon}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                </div>
                <h3 className={styles.bentoTitle}>Cross-Tabulation</h3>
                <p className={styles.bentoDesc}>
                  Automatic breakdown of numeric data by categories.
                  Revenue by region, cost by product — ranked tables.
                </p>
              </div>
              <div className={styles.bentoCta}>
                <Link href="/chat" className={styles.bentoCtaLink}>
                  Try it now <span className={styles.bentoArrow}>→</span>
                </Link>
              </div>
              <div className={styles.bentoOverlay} />
            </ScrollReveal>

            {/* Row 2: 1 narrow + 2 wide */}
            <ScrollReveal delay={0.05} className={styles.bentoCard}>
              <div className={styles.bentoBackground}>
                <div className={styles.bentoBgGlow} />
              </div>
              <div className={styles.bentoBody}>
                <div className={styles.bentoIcon}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
                <h3 className={styles.bentoTitle}>Unlimited Questions</h3>
                <p className={styles.bentoDesc}>
                  Ask anything about your data. Summaries, averages,
                  distributions, comparisons — all in plain language.
                </p>
              </div>
              <div className={styles.bentoCta}>
                <Link href="/chat" className={styles.bentoCtaLink}>
                  Try it now <span className={styles.bentoArrow}>→</span>
                </Link>
              </div>
              <div className={styles.bentoOverlay} />
            </ScrollReveal>

            <ScrollReveal delay={0.1} className={`${styles.bentoCard} ${styles.bentoWide}`}>
              <div className={styles.bentoBackground}>
                <div className={styles.bentoBgGlow} />
              </div>
              <div className={styles.bentoBody}>
                <div className={styles.bentoIcon}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <h3 className={styles.bentoTitle}>Proactive Insights</h3>
                <p className={styles.bentoDesc}>
                  The AI writes first. Anomalies, outliers, and concentration
                  risks are flagged before you even ask a question.
                </p>
              </div>
              <div className={styles.bentoCta}>
                <Link href="/chat" className={styles.bentoCtaLink}>
                  Try it now <span className={styles.bentoArrow}>→</span>
                </Link>
              </div>
              <div className={styles.bentoOverlay} />
            </ScrollReveal>

            {/* Row 3: 1 narrow + 1 wide */}
            <ScrollReveal delay={0.05} className={styles.bentoCard}>
              <div className={styles.bentoBackground}>
                <div className={styles.bentoBgGlow} />
              </div>
              <div className={styles.bentoBody}>
                <div className={styles.bentoIcon}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                </div>
                <h3 className={styles.bentoTitle}>What-If Scenarios</h3>
                <p className={styles.bentoDesc}>
                  &quot;What if revenue drops 20%?&quot; — get instant before/after
                  projections on your actual data.
                </p>
              </div>
              <div className={styles.bentoCta}>
                <Link href="/chat" className={styles.bentoCtaLink}>
                  Try it now <span className={styles.bentoArrow}>→</span>
                </Link>
              </div>
              <div className={styles.bentoOverlay} />
            </ScrollReveal>

            <ScrollReveal delay={0.1} className={`${styles.bentoCard} ${styles.bentoWide}`}>
              <div className={styles.bentoBackground}>
                <div className={styles.bentoBgGlow} />
              </div>
              <div className={styles.bentoBody}>
                <div className={styles.bentoIcon}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" />
                  </svg>
                </div>
                <h3 className={styles.bentoTitle}>Full Column Analysis</h3>
                <p className={styles.bentoDesc}>
                  Every numeric and categorical column gets analyzed.
                  No column left behind, no matter how many.
                </p>
              </div>
              <div className={styles.bentoCta}>
                <Link href="/chat" className={styles.bentoCtaLink}>
                  Try it now <span className={styles.bentoArrow}>→</span>
                </Link>
              </div>
              <div className={styles.bentoOverlay} />
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Section 4: CTA ───────────────────────── */}
      <section className={styles.section}>
        <div className={styles.ctaSection}>
          <ScrollReveal>
            <div className={styles.sectionLabel}>Get Started</div>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <h2 className={styles.ctaHeading}>
              Stop drowning in spreadsheets
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <p className={styles.ctaDesc}>
              Upload your first dataset and see the difference in seconds.
            </p>
          </ScrollReveal>
          <ScrollReveal delay={0.3}>
            <div className={styles.ctaButtons}>
              <Link href="/upload" className={styles.ctaPrimary}>
                Upload Dataset
              </Link>
              <Link href="/chat" className={styles.ctaGhost}>
                Try the Demo →
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────── */}
      <ScrollReveal>
        <footer className={styles.footer}>
          <span>alignd</span>
          <span className={styles.footerDot}>·</span>
          <span>AI Analytics Engine</span>
        </footer>
      </ScrollReveal>
    </>
  );
}
