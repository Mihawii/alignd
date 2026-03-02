import { DataSet } from "./dataStore";

/* ── Identifier detection ────────────────────────── */
const ID_PATTERNS = /^(.*_)?(id|key|code|index|idx|pk|fk|uuid|guid|sku|ref)(_.+)?$/i;

/** True if column is likely an identifier, not a business metric */
export function isIdentifierColumn(name: string, values: string[]): boolean {
    // Name-based heuristic
    if (ID_PATTERNS.test(name.replace(/\s+/g, "_"))) return true;

    // High-cardinality sequential integers → probably an ID
    const nonEmpty = values.filter(v => v && v.trim() !== "").slice(0, 200);
    const nums = nonEmpty.map(Number).filter(n => !isNaN(n) && Number.isInteger(n));
    if (nums.length > 20) {
        const uniqueRatio = new Set(nums).size / nums.length;
        // Nearly all unique integers → identifier
        if (uniqueRatio > 0.9) return true;
    }
    return false;
}

interface ColumnSummary {
    name: string;
    type: "numeric" | "categorical" | "date" | "text";
    isIdentifier: boolean;
    uniqueCount: number;
    nullCount: number;
    // Numeric-only
    min?: number;
    max?: number;
    mean?: number;
    median?: number;
    // Categorical-only
    topValues?: { value: string; count: number }[];
}

export interface DataSummary {
    fileName: string;
    rowCount: number;
    columnCount: number;
    columns: ColumnSummary[];
}

function isNumeric(value: string): boolean {
    if (!value || value.trim() === "") return false;
    return !isNaN(Number(value)) && isFinite(Number(value));
}

function isDate(value: string): boolean {
    if (!value || value.trim() === "") return false;
    const d = new Date(value);
    return !isNaN(d.getTime()) && value.length > 4;
}

function detectColumnType(values: string[]): "numeric" | "categorical" | "date" | "text" {
    const nonEmpty = values.filter((v) => v && v.trim() !== "");
    if (nonEmpty.length === 0) return "text";

    const sample = nonEmpty.slice(0, Math.min(50, nonEmpty.length));
    const numericCount = sample.filter(isNumeric).length;
    const dateCount = sample.filter(isDate).length;

    if (numericCount / sample.length > 0.8) return "numeric";
    if (dateCount / sample.length > 0.8) return "date";

    const uniqueRatio = new Set(nonEmpty).size / nonEmpty.length;
    if (uniqueRatio < 0.5 || new Set(nonEmpty).size <= 20) return "categorical";

    return "text";
}

function getMedian(sorted: number[]): number {
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function summarizeColumn(name: string, rows: Record<string, string>[]): ColumnSummary {
    const values = rows.map((r) => r[name] ?? "");
    const type = detectColumnType(values);
    const nonEmpty = values.filter((v) => v && v.trim() !== "");
    const nullCount = values.length - nonEmpty.length;
    const uniqueCount = new Set(nonEmpty).size;
    const identifier = isIdentifierColumn(name, values);

    const summary: ColumnSummary = { name, type, isIdentifier: identifier, uniqueCount, nullCount };

    if (type === "numeric") {
        const nums = nonEmpty.map(Number).filter((n) => !isNaN(n));
        if (nums.length > 0) {
            nums.sort((a, b) => a - b);
            summary.min = nums[0];
            summary.max = nums[nums.length - 1];
            summary.mean = Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
            summary.median = Math.round(getMedian(nums) * 100) / 100;
        }
    }

    if (type === "categorical") {
        const freq = new Map<string, number>();
        nonEmpty.forEach((v) => freq.set(v, (freq.get(v) || 0) + 1));
        summary.topValues = Array.from(freq.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([value, count]) => ({ value, count }));
    }

    return summary;
}

export function summarizeData(dataset: DataSet): DataSummary {
    return {
        fileName: dataset.fileName,
        rowCount: dataset.rows.length,
        columnCount: dataset.columns.length,
        columns: dataset.columns.map((col) => summarizeColumn(col, dataset.rows)),
    };
}

export function buildContext(dataset: DataSet): string {
    const summary = summarizeData(dataset);
    const lines: string[] = [];

    lines.push(`## Dataset: "${summary.fileName}"`);
    lines.push(`- ${summary.rowCount} rows, ${summary.columnCount} columns`);
    lines.push("");

    // Identify ID columns so AI ignores them
    const idCols = summary.columns.filter(c => c.isIdentifier).map(c => c.name);
    if (idCols.length > 0) {
        lines.push(`## IDENTIFIER COLUMNS (ignore these — they are IDs, NOT business metrics):`);
        lines.push(`  ${idCols.join(", ")}`);
        lines.push(`  Do NOT analyze, rank, compare, or compute gaps on these columns. They are just row identifiers.`);
        lines.push("");
    }

    lines.push("## Column Details:");

    for (const col of summary.columns) {
        const tag = col.isIdentifier ? " ⚠️ IDENTIFIER — skip" : "";
        lines.push(`\n### ${col.name} (${col.type})${tag}`);
        lines.push(`  Unique values: ${col.uniqueCount}, Missing: ${col.nullCount}`);

        if (col.type === "numeric" && !col.isIdentifier) {
            lines.push(`  Min: ${col.min}, Max: ${col.max}, Mean: ${col.mean}, Median: ${col.median}`);
        }

        if (col.type === "categorical" && col.topValues) {
            lines.push(`  Top values: ${col.topValues.map((v) => `"${v.value}" (${v.count})`).join(", ")}`);
        }
    }

    // Add sample rows
    const sampleRows = dataset.rows.slice(0, 5);
    lines.push("\n## Sample Data (first 5 rows):");
    lines.push("```");
    lines.push(dataset.columns.join(" | "));
    lines.push("---".repeat(dataset.columns.length));
    for (const row of sampleRows) {
        lines.push(dataset.columns.map((c) => row[c] ?? "").join(" | "));
    }
    lines.push("```");

    // If dataset is small enough, include all data
    if (dataset.rows.length <= 200) {
        lines.push("\n## Full Data:");
        lines.push("```csv");
        lines.push(dataset.columns.join(","));
        for (const row of dataset.rows) {
            lines.push(dataset.columns.map((c) => row[c] ?? "").join(","));
        }
        lines.push("```");
    }

    return lines.join("\n");
}
