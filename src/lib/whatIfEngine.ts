import { DataSet } from "./dataStore";
import { summarizeData } from "./dataAnalysis";

/* ═══════════════════════════════════════════════════════
   WHAT-IF ENGINE — Scenario Planning
   Parses natural language scenarios, simulates changes,
   and returns before/after comparisons.
   ═══════════════════════════════════════════════════════ */

/* ── Types ────────────────────────────────────────── */
export interface ScenarioParam {
    column: string;
    changeType: "percentage" | "absolute" | "filter_top" | "filter_bottom";
    changeValue: number;
    description: string;
}

export interface ScenarioResult {
    parameter: string;
    originalValue: string;
    projectedValue: string;
    delta: string;
    deltaPercent: string;
    impact: "positive" | "negative" | "neutral";
    confidence: "high" | "medium" | "low";
}

export interface WhatIfResponse {
    scenario: string;
    params: ScenarioParam[];
    results: ScenarioResult[];
    assumptions: string[];
    summary: string;
}

/* ── Helpers ─────────────────────────────────────── */
function fmt(n: number): string {
    if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toFixed(n < 10 && n !== 0 ? 1 : 0);
}

/* ── 1. Parse Scenario from Natural Language ─────── */
export function parseScenario(question: string, dataset: DataSet): ScenarioParam[] {
    const q = question.toLowerCase();
    const summary = summarizeData(dataset);
    const numCols = summary.columns.filter(c => c.type === "numeric" && !c.isIdentifier);
    const params: ScenarioParam[] = [];

    // Pattern: "increases/decreases by X%"
    const pctMatch = q.match(/(?:increase|grow|rise|up|decrease|drop|fall|down|decline|cut|reduce|lower)\s*(?:by\s*)?\s*(\d+)\s*%/);
    if (pctMatch) {
        const pct = parseInt(pctMatch[1]);
        const isDecrease = q.match(/decrease|drop|fall|down|decline|cut|reduce|lower/);
        const changeValue = isDecrease ? -pct : pct;

        // Try to match column name
        let targetCol = numCols[0]?.name || "";
        for (const col of numCols) {
            const colLower = col.name.toLowerCase().replace(/_/g, " ");
            if (q.includes(colLower)) {
                targetCol = col.name;
                break;
            }
        }

        params.push({
            column: targetCol,
            changeType: "percentage",
            changeValue,
            description: `${targetCol.replace(/_/g, " ")} ${isDecrease ? "decreases" : "increases"} by ${pct}%`,
        });
    }

    // Pattern: "add/remove $X" or "increase budget by $X"
    const absMatch = q.match(/(?:add|increase|remove|decrease|cut)\s*(?:by\s*)?\$?\s*(\d[\d,]*)/);
    if (absMatch && params.length === 0) {
        const val = parseInt(absMatch[1].replace(/,/g, ""));
        const isDecrease = q.match(/remove|decrease|cut/);

        let targetCol = numCols[0]?.name || "";
        for (const col of numCols) {
            const colLower = col.name.toLowerCase().replace(/_/g, " ");
            if (q.includes(colLower)) {
                targetCol = col.name;
                break;
            }
        }

        params.push({
            column: targetCol,
            changeType: "absolute",
            changeValue: isDecrease ? -val : val,
            description: `${isDecrease ? "Remove" : "Add"} $${fmt(val)} to ${targetCol.replace(/_/g, " ")}`,
        });
    }

    // Pattern: "remove bottom/top N"
    const filterMatch = q.match(/(?:remove|cut|eliminate|drop)\s+(?:the\s+)?(?:bottom|worst|lowest|top|best|highest)\s+(\d+)/);
    if (filterMatch) {
        const n = parseInt(filterMatch[1]);
        const isBottom = q.match(/bottom|worst|lowest/);

        params.push({
            column: numCols[0]?.name || "",
            changeType: isBottom ? "filter_bottom" : "filter_top",
            changeValue: n,
            description: `Remove the ${isBottom ? "bottom" : "top"} ${n} records`,
        });
    }

    // Fallback — if no pattern matched, assume 20% change on primary metric
    if (params.length === 0 && numCols.length > 0) {
        params.push({
            column: numCols[0].name,
            changeType: "percentage",
            changeValue: q.includes("drop") || q.includes("down") || q.includes("decreas") ? -20 : 20,
            description: `${numCols[0].name.replace(/_/g, " ")} changes by 20%`,
        });
    }

    return params;
}

/* ── 2. Simulate Scenario ────────────────────────── */
export function simulateScenario(dataset: DataSet, params: ScenarioParam[]): WhatIfResponse {
    const summary = summarizeData(dataset);
    const results: ScenarioResult[] = [];
    const assumptions: string[] = [];

    for (const param of params) {
        const col = summary.columns.find(c => c.name === param.column);
        if (!col || col.type !== "numeric") continue;

        const values = dataset.rows.map(r => Number(r[param.column]) || 0);
        const originalTotal = values.reduce((a, b) => a + b, 0);
        const originalMean = originalTotal / (values.length || 1);
        let projectedTotal: number;
        let projectedMean: number;
        let filteredCount = values.length;

        switch (param.changeType) {
            case "percentage": {
                const factor = 1 + param.changeValue / 100;
                projectedTotal = originalTotal * factor;
                projectedMean = originalMean * factor;
                assumptions.push(`Linear ${param.changeValue}% change applied uniformly across all records`);
                break;
            }
            case "absolute": {
                projectedTotal = originalTotal + param.changeValue;
                projectedMean = projectedTotal / values.length;
                assumptions.push(`Flat $${fmt(Math.abs(param.changeValue))} change applied to total — not distributed per record`);
                break;
            }
            case "filter_bottom": {
                const sorted = [...values].sort((a, b) => a - b);
                const removed = sorted.slice(0, param.changeValue);
                const remaining = sorted.slice(param.changeValue);
                projectedTotal = remaining.reduce((a, b) => a + b, 0);
                filteredCount = remaining.length;
                projectedMean = projectedTotal / (filteredCount || 1);
                assumptions.push(`Removed bottom ${param.changeValue} records (values: ${removed.map(v => fmt(v)).join(", ")})`);
                break;
            }
            case "filter_top": {
                const sorted = [...values].sort((a, b) => b - a);
                const remaining = sorted.slice(param.changeValue);
                projectedTotal = remaining.reduce((a, b) => a + b, 0);
                filteredCount = remaining.length;
                projectedMean = projectedTotal / (filteredCount || 1);
                assumptions.push(`Removed top ${param.changeValue} records`);
                break;
            }
            default: {
                projectedTotal = originalTotal;
                projectedMean = originalMean;
            }
        }

        const totalDelta = projectedTotal - originalTotal;
        const totalDeltaPct = originalTotal !== 0 ? (totalDelta / originalTotal) * 100 : 0;

        results.push({
            parameter: `Total ${param.column.replace(/_/g, " ")}`,
            originalValue: fmt(originalTotal),
            projectedValue: fmt(projectedTotal),
            delta: `${totalDelta >= 0 ? "+" : ""}${fmt(totalDelta)}`,
            deltaPercent: `${totalDeltaPct >= 0 ? "+" : ""}${totalDeltaPct.toFixed(1)}%`,
            impact: totalDelta > 0 ? "positive" : totalDelta < 0 ? "negative" : "neutral",
            confidence: dataset.rows.length > 100 ? "high" : dataset.rows.length > 30 ? "medium" : "low",
        });

        const meanDelta = projectedMean - originalMean;
        results.push({
            parameter: `Avg ${param.column.replace(/_/g, " ")}`,
            originalValue: fmt(originalMean),
            projectedValue: fmt(projectedMean),
            delta: `${meanDelta >= 0 ? "+" : ""}${fmt(meanDelta)}`,
            deltaPercent: `${originalMean !== 0 ? `${((meanDelta / originalMean) * 100).toFixed(1)}%` : "—"}`,
            impact: meanDelta > 0 ? "positive" : meanDelta < 0 ? "negative" : "neutral",
            confidence: dataset.rows.length > 100 ? "high" : dataset.rows.length > 30 ? "medium" : "low",
        });

        if (param.changeType.startsWith("filter")) {
            results.push({
                parameter: "Record Count",
                originalValue: `${values.length}`,
                projectedValue: `${filteredCount}`,
                delta: `${filteredCount - values.length}`,
                deltaPercent: `${(((filteredCount - values.length) / values.length) * 100).toFixed(1)}%`,
                impact: "neutral",
                confidence: "high",
            });
        }
    }

    assumptions.push(`This is a linear projection — real-world effects may be non-linear`);
    assumptions.push(`No interaction effects between variables are modeled`);

    const scenarioDesc = params.map(p => p.description).join("; ");
    const primaryResult = results[0];
    const summaryText = primaryResult
        ? `If ${scenarioDesc}, total ${primaryResult.parameter.toLowerCase()} would move from ${primaryResult.originalValue} to ${primaryResult.projectedValue} (${primaryResult.deltaPercent}).`
        : `Scenario analysis for: ${scenarioDesc}`;

    return {
        scenario: scenarioDesc,
        params,
        results,
        assumptions,
        summary: summaryText,
    };
}

/* ── 3. Is this a What-If Question? ──────────────── */
export function isWhatIfQuestion(question: string): boolean {
    const q = question.toLowerCase();
    return (
        q.includes("what if") ||
        q.includes("what would") ||
        q.includes("what happens") ||
        q.includes("how would") ||
        q.includes("scenario") ||
        q.includes("simulate") ||
        q.includes("project") ||
        (q.includes("if") && (q.includes("increase") || q.includes("decrease") || q.includes("drop") || q.includes("grow")))
    );
}
