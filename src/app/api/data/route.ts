import { NextRequest, NextResponse } from "next/server";
import { getData } from "@/lib/dataStore";
import { summarizeData } from "@/lib/dataAnalysis";

/* ── GET: Dashboard Data ──────────────────────────── */
export async function GET(request: NextRequest) {
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    if (!sessionId) return NextResponse.json({ error: "No session" }, { status: 400 });

    const dataset = getData(sessionId);
    if (!dataset) return NextResponse.json({ error: "No data" }, { status: 404 });

    const summary = summarizeData(dataset);

    /* ── Numeric column stats (exclude identifiers) ── */
    const metrics = summary.columns
        .filter(c => c.type === "numeric" && !c.isIdentifier)
        .map(c => ({
            name: c.name,
            min: c.min ?? 0,
            max: c.max ?? 0,
            mean: c.mean ?? 0,
            median: c.median ?? 0,
            total: dataset.rows.reduce((s, r) => s + (Number(r[c.name]) || 0), 0),
        }));

    /* ── Category breakdowns ──────────────────────── */
    const categories = summary.columns
        .filter(c => c.type === "categorical" && c.topValues)
        .map(c => ({
            name: c.name,
            values: (c.topValues || []).map(v => ({ label: v.value, count: v.count })),
            uniqueCount: c.uniqueCount,
        }));

    /* ── Distribution (histogram bins for first numeric col) ── */
    const distributions: { name: string; bins: { label: string; count: number }[] }[] = [];
    for (const col of summary.columns.filter(c => c.type === "numeric" && !c.isIdentifier)) {
        const values = dataset.rows.map(r => Number(r[col.name])).filter(n => !isNaN(n));
        if (values.length < 4) continue;

        const sorted = [...values].sort((a, b) => a - b);
        const min = sorted[0];
        const max = sorted[sorted.length - 1];
        const range = max - min;
        if (range === 0) continue;

        const binCount = Math.min(12, Math.max(5, Math.ceil(Math.sqrt(values.length))));
        const binWidth = range / binCount;
        const bins: { label: string; count: number }[] = [];

        for (let i = 0; i < binCount; i++) {
            const lo = min + i * binWidth;
            const hi = lo + binWidth;
            const count = values.filter(v => i === binCount - 1 ? v >= lo && v <= hi : v >= lo && v < hi).length;
            bins.push({
                label: lo >= 1000 ? `${(lo / 1000).toFixed(0)}k` : lo.toFixed(lo < 10 ? 1 : 0),
                count,
            });
        }

        distributions.push({ name: col.name, bins });
        if (distributions.length >= 2) break; // max 2 distributions
    }

    /* ── Data health ──────────────────────────────── */
    let totalCells = dataset.rows.length * dataset.columns.length;
    let filledCells = 0;
    for (const row of dataset.rows) {
        for (const col of dataset.columns) {
            if (row[col] && row[col].trim() !== "") filledCells++;
        }
    }
    const completeness = totalCells > 0 ? Math.round((filledCells / totalCells) * 100) : 0;

    return NextResponse.json({
        fileName: dataset.fileName,
        rowCount: dataset.rows.length,
        columnCount: dataset.columns.length,
        completeness,
        metrics,
        categories,
        distributions,
        semantics: dataset.semantics ? {
            description: dataset.semantics.description,
            dataType: dataset.semantics.dataType,
            autoKPIs: dataset.semantics.autoKPIs,
            businessMetrics: dataset.semantics.businessMetrics.slice(0, 5),
            relationships: dataset.semantics.relationships.slice(0, 8),
        } : null,
    });
}
