import { DataSet } from "./dataStore";
import { summarizeData } from "./dataAnalysis";
import type { SemanticProfile } from "./semanticLayer";

/* ═══════════════════════════════════════════════════════
   PROACTIVE ENGINE — AI Writes First
   Automatically detects anomalies, risks, and
   opportunities, generating alerts without user asking.
   ═══════════════════════════════════════════════════════ */

/* ── Types ────────────────────────────────────────── */
export interface ProactiveAlert {
    id: string;
    type: "anomaly" | "risk" | "opportunity" | "trend";
    severity: "critical" | "warning" | "info";
    title: string;
    body: string;
    metric?: string;
    suggestedAction: string;
    suggestedQuestion: string;
    timestamp: number;
}

/* ── Helpers ─────────────────────────────────────── */
function fmt(n: number | undefined): string {
    if (n === undefined || isNaN(n)) return "0";
    if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toFixed(n < 10 && n !== 0 ? 1 : 0);
}

function zScore(value: number, mean: number, stdDev: number): number {
    if (stdDev === 0) return 0;
    return Math.abs(value - mean) / stdDev;
}

function stdDev(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance);
}

/* ── 1. Detect Z-Score Outliers ──────────────────── */
function detectOutliers(dataset: DataSet, alerts: ProactiveAlert[]): void {
    const summary = summarizeData(dataset);
    const numCols = summary.columns.filter(c => c.type === "numeric" && !c.isIdentifier);

    for (const col of numCols) {
        const values = dataset.rows.map(r => Number(r[col.name]) || 0);
        const mean = col.mean ?? 0;
        const sd = stdDev(values);
        if (sd === 0) continue;

        // Find extreme outliers (z-score > 2.5)
        const outliers = values.filter(v => zScore(v, mean, sd) > 2.5);
        if (outliers.length > 0 && outliers.length < values.length * 0.1) {
            const maxOutlier = Math.max(...outliers);
            alerts.push({
                id: `outlier-${col.name}`,
                type: "anomaly",
                severity: outliers.length > 3 ? "warning" : "info",
                title: `${outliers.length} outlier${outliers.length > 1 ? "s" : ""} detected in ${col.name.replace(/_/g, " ")}`,
                body: `Found ${outliers.length} values more than 2.5 standard deviations from the mean (${fmt(mean)}). Largest outlier: ${fmt(maxOutlier)}, which is ${zScore(maxOutlier, mean, sd).toFixed(1)}σ from the mean.`,
                metric: col.name,
                suggestedAction: `Review the outlier records to determine if they represent real anomalies or data errors.`,
                suggestedQuestion: `Show me the outliers in ${col.name.replace(/_/g, " ")}`,
                timestamp: Date.now(),
            });
        }
    }
}

/* ── 2. Detect Concentration Risk ────────────────── */
function detectConcentration(dataset: DataSet, alerts: ProactiveAlert[]): void {
    const summary = summarizeData(dataset);
    const numCols = summary.columns.filter(c => c.type === "numeric" && !c.isIdentifier);
    const catCols = summary.columns.filter(c => c.type === "categorical");

    if (numCols.length === 0 || catCols.length === 0) return;

    const primaryNum = numCols[0];
    const primaryCat = catCols[0];
    const totalVal = dataset.rows.reduce((s, r) => s + (Number(r[primaryNum.name]) || 0), 0);

    if (totalVal === 0) return;

    // Group by category
    const grouped = new Map<string, number>();
    for (const row of dataset.rows) {
        const cat = row[primaryCat.name] || "Other";
        grouped.set(cat, (grouped.get(cat) || 0) + (Number(row[primaryNum.name]) || 0));
    }

    const sorted = Array.from(grouped.entries()).sort((a, b) => b[1] - a[1]);

    // Single category dominance
    if (sorted.length >= 2) {
        const topPct = Math.round((sorted[0][1] / totalVal) * 100);
        if (topPct > 50) {
            alerts.push({
                id: `concentration-single-${primaryCat.name}`,
                type: "risk",
                severity: topPct > 70 ? "critical" : "warning",
                title: `Revenue concentration risk: "${sorted[0][0]}" accounts for ${topPct}% of total`,
                body: `A single ${primaryCat.name.replace(/_/g, " ")} category generates ${topPct}% of all ${primaryNum.name.replace(/_/g, " ")}. If "${sorted[0][0]}" underperforms, the business takes a disproportionate hit. The next largest is "${sorted[1][0]}" at ${Math.round((sorted[1][1] / totalVal) * 100)}%.`,
                metric: primaryNum.name,
                suggestedAction: `Develop growth plans for secondary categories to reduce dependency on "${sorted[0][0]}".`,
                suggestedQuestion: `What would happen if ${sorted[0][0]} drops by 20%?`,
                timestamp: Date.now(),
            });
        }

        // Top-2 concentration
        const top2Pct = Math.round(((sorted[0][1] + sorted[1][1]) / totalVal) * 100);
        if (top2Pct > 70 && !(topPct > 50)) {
            alerts.push({
                id: `concentration-top2-${primaryCat.name}`,
                type: "risk",
                severity: "warning",
                title: `Top 2 categories control ${top2Pct}% of ${primaryNum.name.replace(/_/g, " ")}`,
                body: `"${sorted[0][0]}" and "${sorted[1][0]}" together account for ${top2Pct}% of total ${primaryNum.name.replace(/_/g, " ")}. The remaining ${sorted.length - 2} categories contribute only ${100 - top2Pct}%.`,
                metric: primaryNum.name,
                suggestedAction: `Investigate growth levers in the long tail to build a more balanced portfolio.`,
                suggestedQuestion: `Show worst performing ${primaryCat.name.replace(/_/g, " ")} and why`,
                timestamp: Date.now(),
            });
        }
    }
}

/* ── 3. Detect Missing Data Issues ───────────────── */
function detectMissingData(dataset: DataSet, alerts: ProactiveAlert[]): void {
    const summary = summarizeData(dataset);

    for (const col of summary.columns) {
        const missingPct = Math.round((col.nullCount / summary.rowCount) * 100);
        if (missingPct > 20) {
            alerts.push({
                id: `missing-${col.name}`,
                type: "risk",
                severity: missingPct > 50 ? "critical" : "warning",
                title: `${missingPct}% of "${col.name.replace(/_/g, " ")}" values are missing`,
                body: `${col.nullCount} out of ${summary.rowCount} rows have empty or null values in this column. Any analysis using this field may be unreliable.`,
                metric: col.name,
                suggestedAction: `Fill missing values or exclude this column from critical calculations.`,
                suggestedQuestion: `What is the data quality like?`,
                timestamp: Date.now(),
            });
        }
    }
}

/* ── 4. Detect Distribution Skew ─────────────────── */
function detectSkew(dataset: DataSet, alerts: ProactiveAlert[]): void {
    const summary = summarizeData(dataset);
    const numCols = summary.columns.filter(c => c.type === "numeric" && !c.isIdentifier);

    for (const col of numCols) {
        if (!col.mean || !col.median) continue;
        const skew = (col.mean - col.median) / col.mean;
        if (Math.abs(skew) > 0.25) {
            alerts.push({
                id: `skew-${col.name}`,
                type: "anomaly",
                severity: "info",
                title: `${col.name.replace(/_/g, " ")} distribution is heavily skewed`,
                body: `Average (${fmt(col.mean)}) is ${Math.round(Math.abs(skew) * 100)}% ${skew > 0 ? "higher" : "lower"} than the median (${fmt(col.median)}). ${skew > 0 ? "A few high values inflate the average — the typical value is much lower." : "Low-end outliers drag the average down."} Using the average for planning would be misleading.`,
                metric: col.name,
                suggestedAction: `Use median instead of mean for this metric. Review the ${skew > 0 ? "high" : "low"} outliers individually.`,
                suggestedQuestion: `Show me the outliers in ${col.name.replace(/_/g, " ")}`,
                timestamp: Date.now(),
            });
        }
    }
}

/* ── 5. Detect Performance Gaps ──────────────────── */
function detectPerformanceGaps(dataset: DataSet, alerts: ProactiveAlert[]): void {
    const summary = summarizeData(dataset);
    const numCols = summary.columns.filter(c => c.type === "numeric" && !c.isIdentifier);

    for (const col of numCols) {
        if (!col.max || !col.min || col.min <= 0) continue;
        const ratio = col.max / col.min;
        if (ratio > 10) {
            alerts.push({
                id: `gap-${col.name}`,
                type: "opportunity",
                severity: "warning",
                title: `${ratio.toFixed(0)}x performance gap in ${col.name.replace(/_/g, " ")}`,
                body: `The best performer (${fmt(col.max)}) is ${ratio.toFixed(0)}x higher than the worst (${fmt(col.min)}). This extreme gap suggests significant optimization opportunities — or data quality issues at the extremes.`,
                metric: col.name,
                suggestedAction: `Study what makes top performers successful and determine if bottom performers can be improved or should be deprioritized.`,
                suggestedQuestion: `What are the best performing items and why?`,
                timestamp: Date.now(),
            });
        }
    }
}

/* ── 6. Small Dataset Warning ────────────────────── */
function detectSmallDataset(dataset: DataSet, alerts: ProactiveAlert[]): void {
    if (dataset.rows.length < 30) {
        alerts.push({
            id: `small-dataset`,
            type: "risk",
            severity: "warning",
            title: `Small dataset: only ${dataset.rows.length} records`,
            body: `With only ${dataset.rows.length} records, statistical conclusions may not be reliable. Trends, averages, and distributions could change significantly with more data. Treat insights as directional, not definitive.`,
            suggestedAction: `Collect more data before making major business decisions based on this analysis.`,
            suggestedQuestion: `What are the biggest risks in this data?`,
            timestamp: Date.now(),
        });
    }
}

/* ── Main Entry Point ────────────────────────────── */
export function generateAlerts(dataset: DataSet, _semantics?: SemanticProfile): ProactiveAlert[] {
    const alerts: ProactiveAlert[] = [];

    detectOutliers(dataset, alerts);
    detectConcentration(dataset, alerts);
    detectMissingData(dataset, alerts);
    detectSkew(dataset, alerts);
    detectPerformanceGaps(dataset, alerts);
    detectSmallDataset(dataset, alerts);

    // Sort by severity: critical → warning → info
    const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return alerts;
}
