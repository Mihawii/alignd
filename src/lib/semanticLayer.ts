import { DataSet } from "./dataStore";
import { summarizeData, DataSummary } from "./dataAnalysis";

/* ═══════════════════════════════════════════════════════
   SEMANTIC LAYER — Zero-Config Data Understanding
   Auto-detects relationships, business metrics, KPIs,
   and generates a plain-English summary of the dataset.
   ═══════════════════════════════════════════════════════ */

/* ── Types ────────────────────────────────────────── */
export interface Relationship {
    from: string;
    to: string;
    type: "group-by" | "time-series" | "foreign-key";
    description: string;
}

export interface BusinessMetric {
    column: string;
    kind: "revenue" | "volume" | "rate" | "growth" | "monetary" | "generic";
    label: string;
    importance: number; // 0-1 priority score
}

export interface AutoKPI {
    label: string;
    value: string;
    sublabel: string;
    formula: string;
}

export interface SemanticProfile {
    description: string;
    dataType: "sales" | "financial" | "operational" | "survey" | "hr" | "generic";
    relationships: Relationship[];
    businessMetrics: BusinessMetric[];
    autoKPIs: AutoKPI[];
    timeColumn?: string;
}

/* ── Metric Detection Patterns ───────────────────── */
const REVENUE_PATTERNS = /^(.*_)?(revenue|sales|income|amount|price|cost|total|spend|fee|payment|gmv|arpu|arpa|mrr|arr)(_.+)?$/i;
const VOLUME_PATTERNS = /^(.*_)?(count|qty|quantity|units|orders|transactions|visits|sessions|users|customers|subscribers)(_.+)?$/i;
const RATE_PATTERNS = /^(.*_)?(rate|ratio|percentage|pct|share|conversion|ctr|roi|margin|churn|retention)(_.+)?$/i;
const GROWTH_PATTERNS = /^(.*_)?(change|growth|delta|diff|increase|decrease|gain|loss|variance|yoy|mom|qoq)(_.+)?$/i;
const MONETARY_PATTERNS = /^(.*_)?(budget|profit|ebitda|cash|ltv|cac|cpa|aov|arpu|roas|revenue)(_.+)?$/i;

const TIME_PATTERNS = /^(.*_)?(date|time|day|month|year|week|quarter|period|timestamp|created|updated)(_.+)?$/i;

/* ── Helpers ─────────────────────────────────────── */
function fmt(n: number | undefined): string {
    if (n === undefined || isNaN(n)) return "0";
    if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toFixed(n < 10 && n !== 0 ? 1 : 0);
}

/* ── 1. Detect Business Metrics ──────────────────── */
export function detectBusinessMetrics(summary: DataSummary): BusinessMetric[] {
    const metrics: BusinessMetric[] = [];

    for (const col of summary.columns) {
        if (col.isIdentifier || col.type !== "numeric") continue;

        const name = col.name;
        let kind: BusinessMetric["kind"] = "generic";
        let importance = 0.3;

        if (REVENUE_PATTERNS.test(name)) {
            kind = "revenue"; importance = 1.0;
        } else if (MONETARY_PATTERNS.test(name)) {
            kind = "monetary"; importance = 0.9;
        } else if (VOLUME_PATTERNS.test(name)) {
            kind = "volume"; importance = 0.7;
        } else if (RATE_PATTERNS.test(name)) {
            kind = "rate"; importance = 0.8;
        } else if (GROWTH_PATTERNS.test(name)) {
            kind = "growth"; importance = 0.6;
        } else {
            // Heuristic: if values are large (> 100 avg), assume monetary/volume
            if (col.mean && col.mean > 100) {
                kind = "revenue"; importance = 0.5;
            } else if (col.mean && col.mean <= 1) {
                kind = "rate"; importance = 0.4;
            }
        }

        metrics.push({
            column: name,
            kind,
            label: name.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
            importance,
        });
    }

    return metrics.sort((a, b) => b.importance - a.importance);
}

/* ── 2. Detect Relationships ─────────────────────── */
export function detectRelationships(summary: DataSummary): Relationship[] {
    const relationships: Relationship[] = [];
    const catCols = summary.columns.filter(c => c.type === "categorical");
    const numCols = summary.columns.filter(c => c.type === "numeric" && !c.isIdentifier);
    const dateCols = summary.columns.filter(c => c.type === "date" || TIME_PATTERNS.test(c.name));

    // Category × Numeric → group-by relationships
    for (const cat of catCols) {
        for (const num of numCols) {
            relationships.push({
                from: cat.name,
                to: num.name,
                type: "group-by",
                description: `${num.name.replace(/_/g, " ")} can be segmented by ${cat.name.replace(/_/g, " ")} (${cat.uniqueCount} categories)`,
            });
        }
    }

    // Date × Numeric → time-series
    for (const date of dateCols) {
        for (const num of numCols) {
            relationships.push({
                from: date.name,
                to: num.name,
                type: "time-series",
                description: `${num.name.replace(/_/g, " ")} trends over ${date.name.replace(/_/g, " ")}`,
            });
        }
    }

    return relationships;
}

/* ── 3. Detect Data Type ─────────────────────────── */
export function detectDataType(summary: DataSummary, metrics: BusinessMetric[]): SemanticProfile["dataType"] {
    const names = summary.columns.map(c => c.name.toLowerCase()).join(" ");
    const metricKinds = metrics.map(m => m.kind);

    if (names.match(/revenue|sales|order|product|customer|sku|cart/)) return "sales";
    if (names.match(/stock|price|close|open|high|low|volume|ticker/)) return "financial";
    if (names.match(/employee|salary|department|hire|title|hr/)) return "hr";
    if (names.match(/survey|response|score|rating|feedback/)) return "survey";
    if (names.match(/cpu|memory|latency|uptime|error|request/)) return "operational";
    if (metricKinds.includes("revenue") || metricKinds.includes("monetary")) return "sales";

    return "generic";
}

/* ── 4. Auto-Compute KPIs ────────────────────────── */
export function autoDetectKPIs(dataset: DataSet, summary: DataSummary, metrics: BusinessMetric[]): AutoKPI[] {
    const kpis: AutoKPI[] = [];
    const rows = dataset.rows;

    // Primary metric total + average
    const primary = metrics[0];
    if (primary) {
        const values = rows.map(r => Number(r[primary.column]) || 0);
        const total = values.reduce((a, b) => a + b, 0);
        const mean = total / (values.length || 1);

        kpis.push({
            label: `Total ${primary.label}`,
            value: fmt(total),
            sublabel: `across ${rows.length.toLocaleString()} records`,
            formula: `sum(${primary.column})`,
        });

        kpis.push({
            label: `Avg ${primary.label}`,
            value: fmt(mean),
            sublabel: primary.kind === "revenue" ? "per record" : "per entry",
            formula: `sum(${primary.column}) / count(rows)`,
        });
    }

    // Secondary metric if exists
    const secondary = metrics[1];
    if (secondary) {
        const total = rows.reduce((s, r) => s + (Number(r[secondary.column]) || 0), 0);
        kpis.push({
            label: `Total ${secondary.label}`,
            value: fmt(total),
            sublabel: `avg ${fmt(total / (rows.length || 1))} per record`,
            formula: `sum(${secondary.column})`,
        });
    }

    // Data completeness
    let filled = 0, total = rows.length * dataset.columns.length;
    for (const row of rows) {
        for (const col of dataset.columns) {
            if (row[col] && row[col].trim() !== "") filled++;
        }
    }
    kpis.push({
        label: "Data Completeness",
        value: `${Math.round((filled / (total || 1)) * 100)}%`,
        sublabel: `${rows.length.toLocaleString()} rows × ${dataset.columns.length} cols`,
        formula: `filled_cells / total_cells × 100`,
    });

    return kpis;
}

/* ── 5. Generate Semantic Summary ────────────────── */
export function generateSemanticSummary(
    dataset: DataSet,
    summary: DataSummary,
    dataType: SemanticProfile["dataType"],
    metrics: BusinessMetric[],
    relationships: Relationship[],
): string {
    const typeLabel: Record<SemanticProfile["dataType"], string> = {
        sales: "sales/commerce",
        financial: "financial/market",
        operational: "operational/infrastructure",
        survey: "survey/feedback",
        hr: "HR/workforce",
        generic: "business",
    };

    const metricNames = metrics.slice(0, 3).map(m => m.label).join(", ");
    const catCols = summary.columns.filter(c => c.type === "categorical");
    const dateCols = summary.columns.filter(c => c.type === "date" || TIME_PATTERNS.test(c.name));

    let desc = `This appears to be a **${typeLabel[dataType]}** dataset with **${summary.rowCount.toLocaleString()}** records across **${summary.columnCount}** columns.`;

    if (metricNames) {
        desc += ` Key metrics include ${metricNames}.`;
    }

    if (catCols.length > 0) {
        desc += ` Data can be segmented by ${catCols.map(c => c.name.replace(/_/g, " ")).join(", ")}.`;
    }

    if (dateCols.length > 0) {
        desc += ` Time-series analysis is possible via ${dateCols[0].name.replace(/_/g, " ")}.`;
    }

    const groupByCount = relationships.filter(r => r.type === "group-by").length;
    if (groupByCount > 0) {
        desc += ` ${groupByCount} segment × metric combinations available for analysis.`;
    }

    return desc;
}

/* ── Main Entry Point ────────────────────────────── */
export function buildSemanticProfile(dataset: DataSet): SemanticProfile {
    const summary = summarizeData(dataset);
    const metrics = detectBusinessMetrics(summary);
    const relationships = detectRelationships(summary);
    const dataType = detectDataType(summary, metrics);
    const autoKPIs = autoDetectKPIs(dataset, summary, metrics);
    const dateCols = summary.columns.filter(c => c.type === "date" || TIME_PATTERNS.test(c.name));

    const description = generateSemanticSummary(dataset, summary, dataType, metrics, relationships);

    return {
        description,
        dataType,
        relationships,
        businessMetrics: metrics,
        autoKPIs,
        timeColumn: dateCols[0]?.name,
    };
}
