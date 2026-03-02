import { NextRequest, NextResponse } from "next/server";
import { getData } from "@/lib/dataStore";
import { buildContext, summarizeData, isIdentifierColumn } from "@/lib/dataAnalysis";
import { isWhatIfQuestion, parseScenario, simulateScenario, WhatIfResponse } from "@/lib/whatIfEngine";

/* ── AI Provider Config ───────────────────────────── */
const AI_API_KEY = process.env.AI_API_KEY || "";
const AI_BASE_URL = process.env.AI_API_BASE_URL || "https://api.deepseek.com/v1";
const AI_MODEL = process.env.AI_MODEL || "deepseek-chat";

/* ── Response Types ───────────────────────────────── */
interface KPI { label: string; value: string; sublabel?: string }
interface RankedItem { rank: number; label: string; value: string | number; percentage?: number }
interface RankedTable { title: string; items: RankedItem[] }

interface StrategicFinding {
    insight: string;
    evidence: string;
    action: string;
    priority: "high" | "medium" | "low";
}

interface TransparencyInfo {
    methodology: string;
    dataPoints: number;
    confidence: "high" | "medium" | "low";
    formulas: { label: string; formula: string; result: string }[];
    sampleData?: Record<string, string>[];
    assumptions: string[];
}

interface AnalysisResponse {
    actionTitle: string;
    situation: string;
    complication: string;
    resolution: string;
    kpis: KPI[];
    tables: RankedTable[];
    strategicFindings: StrategicFinding[];
    risks: string[];
    recommendations: string[];
    dataQuality: string[];
    suggestions: string[];
    rawText?: string;
    reasoning: string;
    model: string;
    structured: boolean;
    transparency?: TransparencyInfo;
    whatIf?: WhatIfResponse;
}

/* ── Helpers ──────────────────────────────────────── */
function fmt(n: number | undefined): string {
    if (n === undefined || n === null) return "—";
    if (Number.isInteger(n)) return n.toLocaleString();
    return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function total(rows: Record<string, string>[], col: string): number {
    return rows.reduce((s, r) => s + (Number(r[col]) || 0), 0);
}

function pct(part: number, whole: number): number {
    return whole ? Math.round((part / whole) * 100) : 0;
}

function coefficientOfVariation(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    if (mean === 0) return 0;
    const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
    return Math.sqrt(variance) / mean;
}


/* ── POST Handler ─────────────────────────────────── */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { question, sessionId } = body;

        if (!question) {
            return NextResponse.json({ error: "No question provided" }, { status: 400 });
        }

        let dataContext = "";
        if (sessionId) {
            const dataset = getData(sessionId);
            if (dataset) dataContext = buildContext(dataset);
        }

        const systemPrompt = `You are alignd — a senior strategy consultant with deep data analytics expertise. You produce the caliber of analysis found in McKinsey, BCG, and Bain reports.

You follow the PYRAMID PRINCIPLE: lead with the answer, then support it with evidence. Every report uses the SCR framework: Situation → Complication → Resolution.

RESPOND ONLY with valid JSON matching this schema:
{
  "actionTitle": "A complete sentence that IS your main conclusion. This is like a McKinsey slide title — it states the finding, not describes the topic. WRONG: 'Revenue Analysis'. RIGHT: 'Revenue is 73% dependent on two categories, creating significant concentration risk'",
  "situation": "1-2 sentences. The neutral facts — what the data shows at face value. Set the scene.",
  "complication": "1-2 sentences. The 'so what' — why this matters. What's surprising, risky, or requires attention. This is the tension that makes someone care.",
  "resolution": "1-2 sentences. What to do about it. Specific, actionable, prioritized.",
  "kpis": [{"label": "metric name", "value": "the number", "sublabel": "the SO WHAT — not just range, but what this number MEANS. Example: '3x industry benchmark' or 'driven entirely by Electronics'"}],
  "tables": [{"title": "table name", "items": [{"rank": 1, "label": "item", "value": "number", "percentage": 85}]}],
  "strategicFindings": [
    {
      "insight": "The conclusion — a complete sentence stating the finding (pyramid principle: answer first)",
      "evidence": "The data that supports this conclusion — specific numbers",
      "action": "What to do about it — start with a verb",
      "priority": "high|medium|low"
    }
  ],
  "risks": ["Red flags that need immediate attention — things that are dangerous, unsustainable, or could fail"],
  "recommendations": ["Prioritized actions — numbered, specific, starting with a verb. High-impact first."],
  "dataQuality": ["Honest notes about data limitations"],
  "suggestions": ["4-6 specific follow-up questions the user should ask next, based on what you found. Make them specific to THIS data, not generic."],
  "reasoning": "your analytical thought process"
}

RULES:
1. ACTION TITLE must be a complete sentence that states your #1 finding. Never a topic label. If your title could work for any dataset, it's too generic.
2. EVERY number needs a "so what". Don't say "Revenue: 6,600". Say "Revenue: 6,600 — but 73% comes from just 2 categories"
3. STRATEGIC FINDINGS follow the pyramid: conclusion → evidence → action. Minimum 3, maximum 5. Tag each with priority.
4. RISKS should only flag genuinely concerning patterns. Don't manufacture risks for boring data.
5. RECOMMENDATIONS must be specific enough that someone could act on them TODAY. Not "consider optimizing" — "Run an A/B test on Sports pricing to close the 4x revenue gap with Electronics"
6. SUGGESTIONS should be smart follow-up questions based on patterns YOU found. Not generic questions.
7. Output ONLY the JSON. No markdown, no code fences.
8. CRITICAL: If a column's name contains "id", "key", "code", "index", or is marked as IDENTIFIER in the data context — COMPLETELY IGNORE IT. These are row identifiers, NOT business metrics. Do NOT compute gaps, rankings, or ratios on identifiers. Analyzing them is like analyzing social security numbers — meaningless.

${dataContext ? `## Dataset\n${dataContext}` : "No dataset loaded."}`;

        /* ── Try AI API ────────────────────────────────── */
        if (AI_API_KEY) {
            try {
                const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${AI_API_KEY}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        model: AI_MODEL,
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: question },
                        ],
                        temperature: 0.4,
                        max_tokens: 4096,
                    }),
                    signal: AbortSignal.timeout(30000),
                });

                if (response.ok) {
                    const data = await response.json();
                    const aiMessage = data.choices?.[0]?.message?.content || "";
                    if (aiMessage) {
                        try {
                            const cleaned = aiMessage.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
                            const parsed = JSON.parse(cleaned);
                            return NextResponse.json({
                                actionTitle: parsed.actionTitle || parsed.title || "Analysis",
                                situation: parsed.situation || "",
                                complication: parsed.complication || "",
                                resolution: parsed.resolution || "",
                                kpis: parsed.kpis || [],
                                tables: parsed.tables || [],
                                strategicFindings: parsed.strategicFindings || [],
                                risks: parsed.risks || [],
                                recommendations: parsed.recommendations || [],
                                dataQuality: parsed.dataQuality || [],
                                suggestions: parsed.suggestions || [],
                                reasoning: parsed.reasoning || `${data.model || AI_MODEL}`,
                                model: data.model || AI_MODEL,
                                structured: true,
                            } satisfies AnalysisResponse);
                        } catch {
                            return NextResponse.json({
                                actionTitle: "Analysis",
                                situation: "", complication: "", resolution: "",
                                rawText: aiMessage.trim(),
                                kpis: [], tables: [], strategicFindings: [],
                                risks: [], recommendations: [], dataQuality: [], suggestions: [],
                                reasoning: `${data.model || AI_MODEL}`,
                                model: data.model || AI_MODEL,
                                structured: false,
                            } satisfies AnalysisResponse);
                        }
                    }
                } else {
                    const errBody = await response.text();
                    console.error("AI API error:", response.status, errBody);
                }
            } catch (e) {
                console.error("AI API call failed:", e);
            }
        }

        /* ── Local Fallback ────────────────────────────── */
        return generateAnalysis(question, sessionId);
    } catch (err) {
        console.error("Chat error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}


/* ── GET: Smart Suggestions ───────────────────────── */
export async function GET(request: NextRequest) {
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    if (!sessionId) return NextResponse.json({ suggestions: [] });

    const dataset = getData(sessionId);
    if (!dataset) return NextResponse.json({ suggestions: [] });

    const summary = summarizeData(dataset);
    const numCols = summary.columns.filter(c => c.type === "numeric" && !c.isIdentifier);
    const catCols = summary.columns.filter(c => c.type === "categorical");
    const suggestions: string[] = [];

    // Concentration
    for (const cat of catCols) {
        if (cat.topValues && cat.topValues.length >= 2) {
            const topPct = pct(cat.topValues[0].count, summary.rowCount);
            if (topPct > 40) {
                suggestions.push(`"${cat.topValues[0].value}" dominates ${cat.name.replace(/_/g, " ")} at ${topPct}% — what's the dependency risk?`);
            }
        }
    }

    // Variance
    for (const col of numCols) {
        if (col.max && col.min && col.min > 0) {
            const ratio = col.max / col.min;
            if (ratio > 3) {
                suggestions.push(`${col.name.replace(/_/g, " ")} varies ${ratio.toFixed(0)}x (${fmt(col.min)} to ${fmt(col.max)}) — what drives the top performers?`);
            }
        }
    }

    // Cross-analysis
    if (numCols.length > 0 && catCols.length > 0) {
        suggestions.push(`How does ${numCols[0].name.replace(/_/g, " ")} break down by ${catCols[0].name.replace(/_/g, " ")}?`);
    }

    // Skew
    for (const col of numCols) {
        if (col.mean && col.median) {
            const skew = Math.abs(col.mean - col.median) / col.mean;
            if (skew > 0.15) {
                suggestions.push(`${col.name.replace(/_/g, " ")} has outliers pulling the average — who are they?`);
            }
        }
    }

    // Data quality
    const missingCols = summary.columns.filter(c => {
        const vals = dataset.rows.map(r => r[c.name] ?? "");
        return vals.filter(v => !v || v.trim() === "").length > 0;
    });
    if (missingCols.length > 0) {
        suggestions.push(`${missingCols.length} columns have missing data — how much does that affect the analysis?`);
    }

    // Generic fallbacks if we didn't generate enough
    if (suggestions.length < 3) {
        suggestions.push(`What are the key risks in this data?`);
        suggestions.push(`Show the biggest opportunities for improvement`);
    }

    return NextResponse.json({ suggestions: suggestions.slice(0, 6) });
}


/* ═══════════════════════════════════════════════════════
   LOCAL ANALYSIS ENGINE — McKinsey-grade
   Pyramid Principle: answer first → evidence → action
   ═══════════════════════════════════════════════════════ */

type NumCol = { name: string; type: string; min?: number; max?: number; mean?: number; median?: number; topValues?: { value: string; count: number }[] };
type CatCol = { name: string; type: string; topValues?: { value: string; count: number }[] };

function generateAnalysis(question: string, sessionId: string | null): NextResponse {
    if (!sessionId) return json({ actionTitle: "No Data Connected", rawText: "Upload a CSV to start analysis." });

    const dataset = getData(sessionId);
    if (!dataset) return json({ actionTitle: "Session Expired", rawText: "Re-upload your CSV.", recommendations: ["Upload your file again."] });

    const summary = summarizeData(dataset);
    const q = question.toLowerCase();
    const numCols = summary.columns.filter(c => c.type === "numeric" && !c.isIdentifier);
    const catCols = summary.columns.filter(c => c.type === "categorical");

    // What-If scenarios take priority
    if (isWhatIfQuestion(question)) {
        return buildWhatIf(question, dataset, summary);
    }

    if (q.includes("worst") || q.includes("lowest") || q.includes("underperform") || q.includes("weak") || q.includes("bottom")) {
        return buildUnderperformers(dataset, summary, numCols, catCols);
    }
    if (q.includes("best") || q.includes("top") || q.includes("perform") || q.includes("highest") || q.includes("max")) {
        return buildTopPerformers(dataset, summary, numCols, catCols);
    }
    if (q.includes("risk") || q.includes("danger") || q.includes("concern") || q.includes("problem")) {
        return buildRiskAssessment(dataset, summary, numCols, catCols);
    }
    if (q.includes("breakdown") || q.includes("distribut") || q.includes("segment")) {
        return buildBreakdown(dataset, summary, numCols, catCols);
    }

    return buildOverview(dataset, summary, numCols, catCols);
}

function buildWhatIf(
    question: string,
    dataset: { rows: Record<string, string>[]; columns: string[]; fileName: string; uploadedAt: number },
    summary: { rowCount: number; columnCount: number; columns: { name: string; type: string }[] },
): NextResponse {
    const params = parseScenario(question, dataset);
    const whatIfResult = simulateScenario(dataset, params);

    const kpis: KPI[] = whatIfResult.results.map(r => ({
        label: r.parameter,
        value: `${r.originalValue} → ${r.projectedValue}`,
        sublabel: `${r.delta} (${r.deltaPercent})`,
    }));

    const strategicFindings: StrategicFinding[] = whatIfResult.results.map(r => ({
        insight: `${r.parameter}: ${r.originalValue} → ${r.projectedValue}`,
        evidence: `Change of ${r.delta} (${r.deltaPercent}) from the current baseline`,
        action: r.impact === "negative" ? "Prepare mitigation strategies before this scenario materializes" : "Consider accelerating this change to capture the upside",
        priority: (r.impact === "negative" ? "high" : "medium") as "high" | "medium" | "low",
    }));

    return json({
        actionTitle: `Scenario: ${whatIfResult.scenario}`,
        situation: `Running scenario analysis on ${fmt(summary.rowCount)} records: "${whatIfResult.scenario}"`,
        complication: whatIfResult.results.some(r => r.impact === "negative")
            ? `This scenario projects a negative impact on key metrics.`
            : `This scenario projects positive or neutral impact across metrics.`,
        resolution: whatIfResult.summary,
        kpis,
        strategicFindings,
        risks: whatIfResult.results.filter(r => r.impact === "negative").map(r => `${r.parameter} would decline by ${r.delta}`),
        recommendations: [
            `Test this scenario with real historical data for more accurate projections`,
            `Consider second-order effects not captured by linear simulation`,
        ],
        suggestions: [
            `What if ${params[0]?.column.replace(/_/g, " ") || "it"} changes in the opposite direction?`,
            `Show me the biggest risks in this data`,
            `What are the top performers?`,
        ],
        reasoning: `What-if simulation: ${whatIfResult.scenario}. ${whatIfResult.results.length} metrics projected.`,
        whatIf: whatIfResult,
        transparency: {
            methodology: `Linear scenario simulation. Parameters extracted from natural language, applied to ${fmt(summary.rowCount)} records.`,
            dataPoints: summary.rowCount,
            confidence: summary.rowCount > 100 ? "high" : summary.rowCount > 30 ? "medium" : "low",
            formulas: params.map(p => ({
                label: p.description,
                formula: p.changeType === "percentage" ? `original × (1 + ${p.changeValue}%)` : p.changeType === "absolute" ? `original + ${p.changeValue}` : `filter(${p.changeType})`,
                result: whatIfResult.results[0]?.projectedValue || "—",
            })),
            sampleData: dataset.rows.slice(0, 5),
            assumptions: whatIfResult.assumptions,
        },
    });
}

function json(partial: Partial<AnalysisResponse>): NextResponse {
    return NextResponse.json({
        actionTitle: partial.actionTitle || "Analysis",
        situation: partial.situation || "",
        complication: partial.complication || "",
        resolution: partial.resolution || "",
        kpis: partial.kpis || [],
        tables: partial.tables || [],
        strategicFindings: partial.strategicFindings || [],
        risks: partial.risks || [],
        recommendations: partial.recommendations || [],
        dataQuality: partial.dataQuality || [],
        suggestions: partial.suggestions || [],
        rawText: partial.rawText,
        reasoning: partial.reasoning || "Local analysis engine",
        model: "local",
        structured: partial.structured ?? true,
        transparency: partial.transparency,
        whatIf: partial.whatIf,
    } satisfies AnalysisResponse);
}


/* ── 1. STRATEGIC OVERVIEW ────────────────────────── */
function buildOverview(
    dataset: { rows: Record<string, string>[] },
    summary: { fileName: string; rowCount: number; columnCount: number; columns: { name: string; type: string }[] },
    numCols: NumCol[],
    catCols: CatCol[],
): NextResponse {

    const primaryNum = numCols[0];
    const primaryCat = catCols[0];
    const totalVal = primaryNum ? total(dataset.rows, primaryNum.name) : 0;

    // Concentration analysis
    let topCatPct = 0, topCatName = "", concentrationRisk = false;
    let grouped: Map<string, number> = new Map();
    if (primaryCat && primaryNum) {
        for (const row of dataset.rows) {
            const cat = row[primaryCat.name] || "Other";
            grouped.set(cat, (grouped.get(cat) || 0) + (Number(row[primaryNum.name]) || 0));
        }
        const sorted = Array.from(grouped.entries()).sort((a, b) => b[1] - a[1]);
        if (sorted.length >= 2 && totalVal > 0) {
            const top2 = sorted[0][1] + sorted[1][1];
            topCatPct = pct(top2, totalVal);
            topCatName = `${sorted[0][0]} and ${sorted[1][0]}`;
            concentrationRisk = topCatPct > 60;
        }
    }

    // Variance analysis across numeric columns
    const highVarianceCols = numCols.filter(c => {
        if (!c.max || !c.min || c.min <= 0) return false;
        return c.max / c.min > 3;
    });

    // Build action title (the pyramid top)
    let actionTitle: string;
    if (concentrationRisk) {
        actionTitle = `${primaryNum?.name.replace(/_/g, " ")} is ${topCatPct}% concentrated in ${topCatName}, creating dependency risk across ${fmt(summary.rowCount)} records`;
    } else if (highVarianceCols.length > 0) {
        const v = highVarianceCols[0];
        const topRow = dataset.rows.reduce((a, b) => (Number(a[v.name]) || 0) > (Number(b[v.name]) || 0) ? a : b);
        const botRow = dataset.rows.reduce((a, b) => (Number(a[v.name]) || Infinity) < (Number(b[v.name]) || Infinity) ? a : b);
        const topId = primaryCat ? topRow[primaryCat.name] : "Top record";
        const botId = primaryCat ? botRow[primaryCat.name] : "Bottom record";
        actionTitle = `${v.name.replace(/_/g, " ")} varies ${((v.max || 0) / (v.min || 1)).toFixed(0)}x — gap driven by outlier ${topId} vs ${botId}`;
    } else {
        actionTitle = `${fmt(summary.rowCount)}-record dataset across ${numCols.length} metrics shows ${concentrationRisk ? "high concentration" : "balanced distribution"} with ${fmt(totalVal)} total ${primaryNum?.name.replace(/_/g, " ") || "value"}`;
    }

    // SCR
    const situation = `The dataset contains ${fmt(summary.rowCount)} records with ${numCols.length} numeric measures and ${catCols.length} categorical dimensions.${primaryNum ? ` Total ${primaryNum.name.replace(/_/g, " ")} is ${fmt(totalVal)}, averaging ${fmt(primaryNum.mean)} per record.` : ""}`;

    const complication = concentrationRisk
        ? `${topCatPct}% of ${primaryNum?.name.replace(/_/g, " ")} is concentrated in just ${topCatName}. If either underperforms, the overall numbers take a disproportionate hit.`
        : highVarianceCols.length > 0
            ? `There's a ${((highVarianceCols[0].max || 0) / (highVarianceCols[0].min || 1)).toFixed(0)}x gap between the highest and lowest ${highVarianceCols[0].name.replace(/_/g, " ")}. The top performers are severely pulling away from the bottom.`
            : `The data is relatively balanced, but with ${catCols.length > 0 ? `only ${catCols[0].topValues?.length || 0} categories` : "limited segmentation"}, deeper patterns may be hidden.`;

    const resolution = concentrationRisk
        ? `Investigate what's driving ${topCatName} and whether the remaining categories can be grown to reduce dependency.`
        : `Drill into individual segments to find where the biggest improvement opportunities lie.`;

    // KPIs
    const kpis: KPI[] = [];
    if (primaryNum) {
        kpis.push({
            label: `Total ${primaryNum.name.replace(/_/g, " ")}`,
            value: fmt(totalVal),
            sublabel: concentrationRisk ? `${topCatPct}% from just ${topCatName}` : `across ${fmt(summary.rowCount)} records`
        });
        kpis.push({
            label: `Average`,
            value: fmt(primaryNum.mean),
            sublabel: primaryNum.mean && primaryNum.median && Math.abs(primaryNum.mean - primaryNum.median) / primaryNum.mean > 0.1
                ? `median is ${fmt(primaryNum.median)} — outliers are pulling the average ${primaryNum.mean > primaryNum.median ? "up" : "down"}`
                : `close to median (${fmt(primaryNum.median)}) — evenly distributed`
        });
        kpis.push({
            label: `Range`,
            value: `${fmt(primaryNum.min)} – ${fmt(primaryNum.max)}`,
            sublabel: `${((primaryNum.max || 0) / (primaryNum.min || 1)).toFixed(1)}x spread`
        });
    }
    if (numCols.length > 1) {
        const col2 = numCols[1];
        kpis.push({
            label: `Total ${col2.name.replace(/_/g, " ")}`,
            value: fmt(total(dataset.rows, col2.name)),
            sublabel: `avg ${fmt(col2.mean)} per record`
        });
    }

    // Tables
    const tables: RankedTable[] = [];
    if (primaryCat && primaryNum) {
        const sorted = Array.from(grouped.entries()).sort((a, b) => b[1] - a[1]);
        const maxVal = sorted[0]?.[1] || 1;
        tables.push({
            title: `${primaryNum.name.replace(/_/g, " ")} by ${primaryCat.name.replace(/_/g, " ")}`,
            items: sorted.map(([label, val], i) => ({
                rank: i + 1, label, value: fmt(Math.round(val)),
                percentage: Math.round((val / maxVal) * 100)
            })),
        });
    }

    // Strategic findings (pyramid: insight → evidence → action)
    const strategicFindings: StrategicFinding[] = [];

    if (concentrationRisk) {
        const sorted = Array.from(grouped.entries()).sort((a, b) => b[1] - a[1]);
        strategicFindings.push({
            insight: `Revenue concentration creates dependency risk`,
            evidence: `${topCatName} accounts for ${topCatPct}% of total ${primaryNum?.name.replace(/_/g, " ")}. The remaining ${sorted.length - 2} categories contribute only ${100 - topCatPct}%.`,
            action: `Investigate growth potential in bottom categories to build a more balanced portfolio.`,
            priority: "high",
        });
    }

    for (const col of highVarianceCols.slice(0, 2)) {
        const ratio = ((col.max || 0) / (col.min || 1)).toFixed(0);
        const sortedByCol = [...dataset.rows].filter(r => r[col.name] !== undefined && r[col.name] !== "").sort((a, b) => (Number(b[col.name]) || 0) - (Number(a[col.name]) || 0));
        const top3Names = sortedByCol.slice(0, 3).map(r => primaryCat ? r[primaryCat.name] : "").filter(Boolean).join(", ");
        const bot3Names = sortedByCol.slice(-3).reverse().map(r => primaryCat ? r[primaryCat.name] : "").filter(Boolean).join(", ");
        const namesContext = top3Names ? `Top performers include ${top3Names}. Bottom include ${bot3Names}. ` : "";

        strategicFindings.push({
            insight: `${col.name.replace(/_/g, " ")} shows a ${ratio}x performance gap between best and worst`,
            evidence: `${namesContext}Top value is maxed at ${fmt(col.max)} while bottom drops to ${fmt(col.min)}. Dataset average is ${fmt(col.mean)}.`,
            action: `Study what the top performers do differently and whether the bottom can be improved or should be cut.`,
            priority: Number(ratio) > 5 ? "high" : "medium",
        });
    }

    for (const col of numCols) {
        if (col.mean && col.median) {
            const skew = (col.mean - col.median) / col.mean;
            if (Math.abs(skew) > 0.15) {
                strategicFindings.push({
                    insight: `${col.name.replace(/_/g, " ")} distribution is skewed — average doesn't tell the real story`,
                    evidence: `Average is ${fmt(col.mean)} but the typical value (median) is ${fmt(col.median)}, a ${Math.round(Math.abs(skew) * 100)}% gap. ${skew > 0 ? "A few high values inflate the average." : "Low-end outliers drag it down."}`,
                    action: `Use median for planning, and individually review the outlier ${skew > 0 ? "high" : "low"} values.`,
                    priority: "medium",
                });
            }
        }
    }

    if (strategicFindings.length === 0) {
        strategicFindings.push({
            insight: `Data shows balanced distribution with no critical concentration or variance issues`,
            evidence: `${numCols.length} metrics across ${fmt(summary.rowCount)} records. Values are within reasonable ranges.`,
            action: `Drill into individual segments and time periods to uncover hidden patterns.`,
            priority: "low",
        });
    }

    // Risks
    const risks: string[] = [];
    if (concentrationRisk) risks.push(`High dependency: ${topCatPct}% of value comes from just 2 categories. An issue in ${topCatName} would significantly impact totals.`);
    if (summary.rowCount < 30) risks.push(`Small sample size (${summary.rowCount} rows) — conclusions may not be statistically reliable.`);

    // Recommendations
    const recommendations: string[] = [];
    if (concentrationRisk) recommendations.push(`Run a what-if analysis: what happens to totals if the top category drops 20%?`);
    if (highVarianceCols.length > 0) recommendations.push(`Deep-dive into bottom performers to determine if they can be improved or should be deprioritized.`);
    if (catCols.length > 0 && numCols.length > 0) recommendations.push(`Cross-tabulate ${numCols[0].name.replace(/_/g, " ")} by ${catCols[0].name.replace(/_/g, " ")} to find which segments drive the most value.`);
    recommendations.push(`Add time-series data if available — trends matter more than snapshots.`);

    // Data quality
    const dataQuality: string[] = [];
    const nullCols = summary.columns.filter(c => {
        const missing = dataset.rows.filter(r => !r[c.name] || r[c.name].trim() === "").length;
        return missing > 0;
    });
    if (nullCols.length > 0) {
        dataQuality.push(`Missing values found in ${nullCols.length} columns — this may affect calculations.`);
    } else {
        dataQuality.push(`Dataset is complete — no missing values detected.`);
    }
    dataQuality.push(`${fmt(summary.rowCount)} rows · ${fmt(summary.columnCount)} columns · ${numCols.length} numeric · ${catCols.length} categorical`);

    // Suggestions for follow-up
    const suggestions: string[] = [];
    if (concentrationRisk) suggestions.push(`What would happen if ${Array.from(grouped.entries()).sort((a, b) => b[1] - a[1])[0]?.[0]} drops by 20%?`);
    if (highVarianceCols.length > 0) suggestions.push(`Why does ${highVarianceCols[0].name.replace(/_/g, " ")} vary so much? Show the outliers.`);
    if (catCols.length > 0) suggestions.push(`Show worst performing ${catCols[0].name.replace(/_/g, " ")} and why`);
    suggestions.push(`What are the biggest risks in this data?`);
    suggestions.push(`Break down the data by category`);

    // Transparency — show how we calculated
    const formulas: { label: string; formula: string; result: string }[] = [];
    if (primaryNum) {
        formulas.push({ label: `Total ${primaryNum.name}`, formula: `sum(${primaryNum.name}) across ${fmt(summary.rowCount)} rows`, result: fmt(totalVal) });
        formulas.push({ label: `Average`, formula: `sum(${primaryNum.name}) / count(rows) = ${fmt(totalVal)} / ${summary.rowCount}`, result: fmt(primaryNum.mean) });
    }
    if (concentrationRisk && primaryCat && primaryNum) {
        const sorted = Array.from(grouped.entries()).sort((a, b) => b[1] - a[1]);
        formulas.push({ label: `Concentration %`, formula: `(${sorted[0][0]}: ${fmt(Math.round(sorted[0][1]))} + ${sorted[1][0]}: ${fmt(Math.round(sorted[1][1]))}) / ${fmt(totalVal)} × 100`, result: `${topCatPct}%` });
    }

    const nullCount = summary.columns.reduce((acc, c) => acc + dataset.rows.filter(r => !r[c.name] || r[c.name].trim() === "").length, 0);
    const totalCells = summary.rowCount * summary.columnCount;
    const assumptions: string[] = [];
    if (nullCount > 0) assumptions.push(`${nullCount} missing values (${Math.round(nullCount / totalCells * 100)}% of cells) — calculations exclude missing data`);
    else assumptions.push(`Dataset is complete — no missing values`);
    assumptions.push(`All values treated as-is — no outlier removal applied`);
    if (summary.rowCount < 100) assumptions.push(`Small dataset (${summary.rowCount} rows) — statistical confidence is limited`);

    return json({
        actionTitle, situation, complication, resolution,
        kpis, tables, strategicFindings, risks, recommendations, dataQuality,
        suggestions: suggestions.slice(0, 6),
        reasoning: `Strategic overview: analyzed ${summary.columnCount} columns. Concentration: ${concentrationRisk ? "HIGH" : "normal"}. Variance: ${highVarianceCols.length} columns with 3x+ spread.`,
        transparency: {
            methodology: `Statistical analysis of ${summary.columnCount} columns across ${fmt(summary.rowCount)} records. Concentration assessed via top-2 category share. Variance measured by max/min ratio. Skew detected via mean-median divergence.`,
            dataPoints: summary.rowCount,
            confidence: summary.rowCount > 100 ? "high" : summary.rowCount > 30 ? "medium" : "low",
            formulas,
            sampleData: dataset.rows.slice(0, 5),
            assumptions,
        },
    });
}


/* ── 2. TOP PERFORMERS ────────────────────────────── */
function buildTopPerformers(
    dataset: { rows: Record<string, string>[] },
    summary: { rowCount: number },
    numCols: NumCol[],
    catCols: CatCol[],
): NextResponse {

    const primaryNum = numCols[0];
    const primaryCat = catCols[0];
    const totalVal = total(dataset.rows, primaryNum.name);

    let ranked: { label: string; sum: number; count: number; avg: number }[] = [];
    if (primaryCat) {
        const grouped = new Map<string, number[]>();
        for (const row of dataset.rows) {
            const cat = row[primaryCat.name] || "Other";
            const val = Number(row[primaryNum.name]) || 0;
            if (!grouped.has(cat)) grouped.set(cat, []);
            grouped.get(cat)!.push(val);
        }
        ranked = Array.from(grouped.entries())
            .map(([label, vals]) => ({ label, sum: vals.reduce((a, b) => a + b, 0), count: vals.length, avg: vals.reduce((a, b) => a + b, 0) / vals.length }))
            .sort((a, b) => b.sum - a.sum);
    }

    const topRow = dataset.rows.reduce((best, row) =>
        (Number(row[primaryNum.name]) || 0) > (Number(best[primaryNum.name]) || 0) ? row : best, dataset.rows[0]);

    const topPct = ranked.length > 0 ? pct(ranked[0].sum, totalVal) : 0;

    const actionTitle = ranked.length >= 2
        ? `"${ranked[0].label}" leads with ${topPct}% of total ${primaryNum.name.replace(/_/g, " ")}, ${((ranked[0].sum / (ranked[1].sum || 1))).toFixed(1)}x larger than the runner-up`
        : `Peak ${primaryNum.name.replace(/_/g, " ")} reaches ${fmt(primaryNum.max)}, ${((primaryNum.max || 0) / (primaryNum.mean || 1)).toFixed(1)}x above average`;

    const situation = ranked.length >= 2
        ? `"${ranked[0].label}" generates ${fmt(Math.round(ranked[0].sum))} in ${primaryNum.name.replace(/_/g, " ")}, representing ${topPct}% of the ${fmt(totalVal)} total across ${ranked.length} categories.`
        : `The highest ${primaryNum.name.replace(/_/g, " ")} is ${fmt(primaryNum.max)}, against an average of ${fmt(primaryNum.mean)}.`;

    const complication = ranked.length >= 3
        ? `The bottom ${ranked.length - 2} categories together contribute only ${pct(ranked.slice(2).reduce((s, r) => s + r.sum, 0), totalVal)}% — there's a long tail of underperformers.`
        : `The gap between top and bottom is ${ranked.length >= 2 ? `${((ranked[0].sum / (ranked[ranked.length - 1].sum || 1))).toFixed(1)}x` : "significant"}.`;

    const resolution = `Study what makes "${ranked[0]?.label || "the top performer"}" successful and determine if those practices can be replicated across other categories.`;

    const kpis: KPI[] = [
        { label: `#1 ${primaryCat?.name.replace(/_/g, " ") || "performer"}`, value: ranked[0]?.label || fmt(primaryNum.max), sublabel: `${topPct}% of total value` },
        { label: "Total", value: fmt(totalVal), sublabel: `${ranked.length} categories` },
        { label: "Top/Bottom Ratio", value: ranked.length >= 2 ? `${((ranked[0].sum / (ranked[ranked.length - 1].sum || 1))).toFixed(1)}x` : "—", sublabel: "performance gap" },
    ];

    const tables: RankedTable[] = [];
    if (ranked.length > 0) {
        const maxSum = ranked[0].sum || 1;
        tables.push({
            title: `${primaryNum.name.replace(/_/g, " ")} by ${primaryCat?.name.replace(/_/g, " ")}`,
            items: ranked.map((r, i) => ({ rank: i + 1, label: r.label, value: fmt(Math.round(r.sum)), percentage: Math.round((r.sum / maxSum) * 100) })),
        });
    }

    const strategicFindings: StrategicFinding[] = [];
    if (ranked.length >= 2) {
        strategicFindings.push({
            insight: `"${ranked[0].label}" outperforms every other category by a significant margin`,
            evidence: `${fmt(Math.round(ranked[0].sum))} total (${topPct}%), compared to runner-up "${ranked[1].label}" at ${fmt(Math.round(ranked[1].sum))} (${pct(ranked[1].sum, totalVal)}%).`,
            action: `Understand the drivers behind "${ranked[0].label}" — is it volume, pricing, or market size?`,
            priority: "high",
        });
        if (topPct > 40) {
            strategicFindings.push({
                insight: `Top performer concentration is ${topPct}% — this is a strength but also a risk`,
                evidence: `If "${ranked[0].label}" declines by 20%, total ${primaryNum.name.replace(/_/g, " ")} drops by ${pct(ranked[0].sum * 0.2, totalVal)}%.`,
                action: `Develop growth plans for mid-tier categories as a hedge against top-performer dependency.`,
                priority: "high",
            });
        }
    }

    const recommendations: string[] = [];
    recommendations.push(`Analyze what "${ranked[0]?.label || "top"}" does differently — identify repeatable success factors.`);
    if (ranked.length >= 3) {
        const mid = ranked[Math.floor(ranked.length / 2)];
        recommendations.push(`Focus growth efforts on mid-tier "${mid.label}" — it has ${pct(mid.sum, totalVal)}% share with room to expand.`);
    }
    recommendations.push(`Check if top performance correlates with any specific attributes (price point, volume, timing).`);

    return json({
        actionTitle, situation, complication, resolution,
        kpis, tables, strategicFindings, risks: topPct > 50 ? [`Heavy dependency on "${ranked[0]?.label}" (${topPct}%) — any decline here impacts the whole business.`] : [],
        recommendations,
        dataQuality: [`Based on ${fmt(summary.rowCount)} records.`],
        suggestions: [
            `What happens if ${ranked[0]?.label || "the top category"} drops by 20%?`,
            `Show the worst performing categories and why`,
            `Break down ${numCols[1]?.name.replace(/_/g, " ") || "metrics"} by ${primaryCat?.name.replace(/_/g, " ") || "category"}`,
        ],
        transparency: {
            methodology: `Ranked ${primaryCat?.name || "categories"} by sum of ${primaryNum.name}. Performance gap = top category sum / bottom category sum.`,
            dataPoints: summary.rowCount,
            confidence: summary.rowCount > 100 ? "high" : summary.rowCount > 30 ? "medium" : "low",
            formulas: [
                { label: `#1 share`, formula: `sum(${primaryNum.name} where ${primaryCat?.name} = "${ranked[0]?.label}") / sum(${primaryNum.name})`, result: `${topPct}%` },
                { label: `Top/Bottom ratio`, formula: `${fmt(Math.round(ranked[0]?.sum || 0))} / ${fmt(Math.round(ranked[ranked.length - 1]?.sum || 1))}`, result: ranked.length >= 2 ? `${((ranked[0].sum / (ranked[ranked.length - 1].sum || 1))).toFixed(1)}x` : "—" },
            ],
            sampleData: dataset.rows.slice(0, 5),
            assumptions: [`Categories ranked by total sum — not adjusted for count or volume`, `All values treated as-is — no outlier removal`],
        },
    });
}


/* ── 3. UNDERPERFORMERS ───────────────────────────── */
function buildUnderperformers(
    dataset: { rows: Record<string, string>[] },
    summary: { rowCount: number },
    numCols: NumCol[],
    catCols: CatCol[],
): NextResponse {

    const primaryNum = numCols[0];
    const primaryCat = catCols[0];
    const totalVal = total(dataset.rows, primaryNum.name);

    let ranked: { label: string; sum: number; count: number }[] = [];
    if (primaryCat) {
        const grouped = new Map<string, number[]>();
        for (const row of dataset.rows) {
            const cat = row[primaryCat.name] || "Other";
            const val = Number(row[primaryNum.name]) || 0;
            if (!grouped.has(cat)) grouped.set(cat, []);
            grouped.get(cat)!.push(val);
        }
        ranked = Array.from(grouped.entries())
            .map(([label, vals]) => ({ label, sum: vals.reduce((a, b) => a + b, 0), count: vals.length }))
            .sort((a, b) => a.sum - b.sum); // worst first
    }

    const worstPct = ranked.length > 0 ? pct(ranked[0].sum, totalVal) : 0;
    const bestPct = ranked.length > 0 ? pct(ranked[ranked.length - 1].sum, totalVal) : 0;
    const gapRatio = ranked.length >= 2 ? ((ranked[ranked.length - 1].sum / (ranked[0].sum || 1))).toFixed(1) : "—";

    const actionTitle = ranked.length >= 2
        ? `"${ranked[0].label}" contributes only ${worstPct}% of ${primaryNum.name.replace(/_/g, " ")} — ${gapRatio}x below the top performer`
        : `Lowest ${primaryNum.name.replace(/_/g, " ")} is ${fmt(primaryNum.min)}, ${pct((primaryNum.mean || 0) - (primaryNum.min || 0), primaryNum.mean || 1)}% below average`;

    const situation = `Across ${fmt(summary.rowCount)} records, ${primaryNum.name.replace(/_/g, " ")} ranges from ${fmt(primaryNum.min)} to ${fmt(primaryNum.max)} with an average of ${fmt(primaryNum.mean)}.`;

    const complication = ranked.length >= 2
        ? `"${ranked[0].label}" generates only ${fmt(Math.round(ranked[0].sum))} (${worstPct}%) while the top category produces ${bestPct}%. That's a ${gapRatio}x gap that signals either an underperforming segment or a misallocation of resources.`
        : `The lowest value (${fmt(primaryNum.min)}) is ${pct((primaryNum.mean || 0) - (primaryNum.min || 0), primaryNum.mean || 1)}% below the average — a significant underperformance.`;

    const resolution = ranked.length >= 2
        ? `Determine whether "${ranked[0].label}" is worth investing in or should be deprioritized. There's no point growing everything equally.`
        : `Identify the specific records with the lowest values and investigate the root causes.`;

    const kpis: KPI[] = numCols.map(col => ({
        label: `Lowest ${col.name.replace(/_/g, " ")}`,
        value: fmt(col.min),
        sublabel: `${pct((col.mean || 0) - (col.min || 0), col.mean || 1)}% below avg (${fmt(col.mean)})`
    }));

    const tables: RankedTable[] = [];
    if (ranked.length > 0) {
        const maxSum = Math.max(...ranked.map(r => r.sum), 1);
        tables.push({
            title: `${primaryNum.name.replace(/_/g, " ")} by ${primaryCat?.name.replace(/_/g, " ")} (worst first)`,
            items: ranked.slice(0, 6).map((r, i) => ({ rank: i + 1, label: r.label, value: fmt(Math.round(r.sum)), percentage: Math.round((r.sum / maxSum) * 100) })),
        });
    }

    const strategicFindings: StrategicFinding[] = [];
    if (ranked.length >= 2) {
        strategicFindings.push({
            insight: `"${ranked[0].label}" is the weakest segment with a ${gapRatio}x gap to the leader`,
            evidence: `${fmt(Math.round(ranked[0].sum))} total (${worstPct}%) vs "${ranked[ranked.length - 1].label}" at ${fmt(Math.round(ranked[ranked.length - 1].sum))} (${bestPct}%).`,
            action: `Decide: invest to close the gap, or reallocate resources to higher-performing segments.`,
            priority: "high",
        });
    }

    for (const col of numCols) {
        const gap = col.mean ? pct((col.mean - (col.min || 0)), col.mean) : 0;
        if (gap > 50) {
            strategicFindings.push({
                insight: `${col.name.replace(/_/g, " ")} has extreme low-end outliers`,
                evidence: `Minimum (${fmt(col.min)}) is ${gap}% below the average (${fmt(col.mean)}).`,
                action: `Review the specific records at the bottom — this could be data errors or genuinely struggling performers.`,
                priority: gap > 70 ? "high" : "medium",
            });
        }
    }

    const risks: string[] = [];
    if (ranked.length >= 2 && Number(gapRatio) > 3) {
        risks.push(`${gapRatio}x gap between best and worst suggests structural imbalance, not just normal variation.`);
    }

    return json({
        actionTitle, situation, complication, resolution,
        kpis, tables, strategicFindings, risks,
        recommendations: [
            `Investigate root cause for "${ranked[0]?.label || "bottom"}" underperformance — is it market size, execution, or pricing?`,
            `Run a cost-benefit analysis: how much would it cost to improve bottom performers vs. doubling down on winners?`,
            `Check if underperformance is a recent trend or a structural pattern.`,
        ],
        dataQuality: [`Based on ${fmt(summary.rowCount)} records.`],
        suggestions: [
            `What makes the top performers successful?`,
            `Is "${ranked[0]?.label || "the bottom"}" worth investing in or should it be cut?`,
            `How does profitability compare across segments?`,
        ],
        transparency: {
            methodology: `Ranked ${primaryCat?.name || "categories"} by sum of ${primaryNum.name} (ascending). Gap calculated as top performer / bottom performer ratio.`,
            dataPoints: summary.rowCount,
            confidence: summary.rowCount > 100 ? "high" : summary.rowCount > 30 ? "medium" : "low",
            formulas: [
                { label: `Bottom performer`, formula: `min(grouped sum of ${primaryNum.name} by ${primaryCat?.name})`, result: `${ranked[0]?.label}: ${fmt(Math.round(ranked[0]?.sum || 0))}` },
            ],
            sampleData: dataset.rows.slice(0, 5),
            assumptions: [`Rankings based on total sum — volume not adjusted for`, `All records included — no outlier filtering`],
        },
    });
}


/* ── 4. RISK ASSESSMENT ───────────────────────────── */
function buildRiskAssessment(
    dataset: { rows: Record<string, string>[] },
    summary: { rowCount: number; columnCount: number; columns: { name: string; type: string }[] },
    numCols: NumCol[],
    catCols: CatCol[],
): NextResponse {

    const primaryNum = numCols[0];
    const totalVal = primaryNum ? total(dataset.rows, primaryNum.name) : 0;
    const risks: string[] = [];
    const strategicFindings: StrategicFinding[] = [];

    // Concentration risk
    if (catCols[0] && primaryNum) {
        const grouped = new Map<string, number>();
        for (const row of dataset.rows) {
            const cat = row[catCols[0].name] || "Other";
            grouped.set(cat, (grouped.get(cat) || 0) + (Number(row[primaryNum.name]) || 0));
        }
        const sorted = Array.from(grouped.entries()).sort((a, b) => b[1] - a[1]);
        const topPct = totalVal > 0 ? pct(sorted[0]?.[1] || 0, totalVal) : 0;
        if (topPct > 40) {
            risks.push(`"${sorted[0][0]}" generates ${topPct}% of ${primaryNum.name.replace(/_/g, " ")} — if it drops 20%, total falls by ${pct(sorted[0][1] * 0.2, totalVal)}%.`);
            strategicFindings.push({
                insight: `Single-category concentration risk at ${topPct}%`,
                evidence: `"${sorted[0][0]}" produces ${fmt(Math.round(sorted[0][1]))} out of ${fmt(totalVal)} total.`,
                action: `Diversify: develop growth plans for at least 2 other categories to reduce dependency.`,
                priority: "high",
            });
        }
    }

    // Variance risk
    for (const col of numCols) {
        const vals = dataset.rows.map(r => Number(r[col.name]) || 0).filter(v => v > 0);
        const cv = coefficientOfVariation(vals);
        if (cv > 0.5) {
            risks.push(`${col.name.replace(/_/g, " ")} has high variability (CV: ${(cv * 100).toFixed(0)}%) — results are unpredictable.`);
            strategicFindings.push({
                insight: `${col.name.replace(/_/g, " ")} is highly volatile, making forecasting unreliable`,
                evidence: `Coefficient of variation is ${(cv * 100).toFixed(0)}%. Values range from ${fmt(col.min)} to ${fmt(col.max)}.`,
                action: `Identify what drives the volatility — is it seasonal, category-dependent, or random?`,
                priority: "high",
            });
        }
    }

    // Small sample risk
    if (summary.rowCount < 30) {
        risks.push(`Only ${summary.rowCount} records — too small for statistically confident conclusions.`);
        strategicFindings.push({
            insight: `Sample size is too small for reliable statistical analysis`,
            evidence: `${summary.rowCount} records is below the 30-row minimum for confidence.`,
            action: `Collect more data before making strategic decisions based on this analysis.`,
            priority: "high",
        });
    }

    // Data quality risk
    const nullCols = summary.columns.filter(c => {
        return dataset.rows.filter(r => !r[c.name] || r[c.name].trim() === "").length > 0;
    });
    if (nullCols.length > 0) {
        risks.push(`${nullCols.length} columns have missing values — analysis may be incomplete or biased.`);
    }

    if (risks.length === 0) {
        risks.push(`No critical risks detected. Data shows normal variation and healthy distribution.`);
    }

    return json({
        actionTitle: risks.length > 1
            ? `${risks.length} risk factors identified in the data`
            : risks[0] || "Risk assessment complete — no critical issues found",
        situation: `Analyzed ${fmt(summary.rowCount)} records across ${fmt(summary.columnCount)} columns for concentration, volatility, and data quality risks.`,
        complication: risks.length > 0 ? `Found ${risks.length} areas of concern that could affect decision-making reliability.` : `No significant risks detected.`,
        resolution: `Address the highest-priority risks first before making strategic decisions based on this data.`,
        kpis: [
            { label: "Risk Factors", value: `${risks.length}`, sublabel: `${strategicFindings.filter(f => f.priority === "high").length} high priority` },
            { label: "Data Completeness", value: nullCols.length === 0 ? "100%" : `${100 - pct(nullCols.length, summary.columnCount)}%`, sublabel: `${nullCols.length} columns with gaps` },
        ],
        tables: [], strategicFindings, risks,
        recommendations: [
            `Address high-priority risks before using this data for strategic decisions.`,
            `Fill data gaps in ${nullCols.map(c => c.name).join(", ") || "affected columns"} if possible.`,
        ],
        dataQuality: [`${fmt(summary.rowCount)} rows · ${nullCols.length} columns with missing data.`],
        suggestions: [`Show top performers`, `Run a full data breakdown`, `What are the biggest opportunities?`],
        transparency: {
            methodology: `Risk assessment across ${fmt(summary.columnCount)} columns: concentration via top-2 share, volatility via coefficient of variation, data quality via null counts.`,
            dataPoints: summary.rowCount,
            confidence: summary.rowCount > 50 ? "high" : "medium",
            formulas: [
                { label: `Risk factors`, formula: `count(identified risks)`, result: `${risks.length}` },
            ],
            sampleData: dataset.rows.slice(0, 5),
            assumptions: [`Risk thresholds: concentration > 60%, CV > 0.5, nulls > 10%`, `All risks weighted equally`],
        },
    });
}


/* ── 5. BREAKDOWN ─────────────────────────────────── */
function buildBreakdown(
    dataset: { rows: Record<string, string>[] },
    summary: { rowCount: number; columnCount: number },
    numCols: NumCol[],
    catCols: CatCol[],
): NextResponse {

    const primaryNum = numCols[0];
    const totalVal = primaryNum ? total(dataset.rows, primaryNum.name) : 0;

    const tables: RankedTable[] = [];
    const strategicFindings: StrategicFinding[] = [];

    // Cross-tab for each categorical column
    for (const catCol of catCols.slice(0, 2)) {
        if (!primaryNum) continue;
        const grouped = new Map<string, number[]>();
        for (const row of dataset.rows) {
            const cat = row[catCol.name] || "Other";
            const val = Number(row[primaryNum.name]) || 0;
            if (!grouped.has(cat)) grouped.set(cat, []);
            grouped.get(cat)!.push(val);
        }
        const items = Array.from(grouped.entries())
            .map(([label, vals]) => ({ label, sum: vals.reduce((a, b) => a + b, 0), count: vals.length, avg: vals.reduce((a, b) => a + b, 0) / vals.length }))
            .sort((a, b) => b.sum - a.sum);
        const maxSum = items[0]?.sum || 1;
        tables.push({
            title: `${primaryNum.name.replace(/_/g, " ")} by ${catCol.name.replace(/_/g, " ")}`,
            items: items.map((r, i) => ({ rank: i + 1, label: r.label, value: fmt(Math.round(r.sum)), percentage: Math.round((r.sum / maxSum) * 100) })),
        });

        // Insight from dominance
        if (items.length >= 2) {
            const topShare = pct(items[0].sum, totalVal);
            const bottomShare = pct(items[items.length - 1].sum, totalVal);
            strategicFindings.push({
                insight: `${catCol.name.replace(/_/g, " ")} shows a ${((items[0].sum / (items[items.length - 1].sum || 1))).toFixed(1)}x gap between top and bottom`,
                evidence: `"${items[0].label}" has ${topShare}% of total while "${items[items.length - 1].label}" has ${bottomShare}%.`,
                action: `Investigate whether ${items[items.length - 1].label} is underserved or naturally smaller.`,
                priority: topShare > 40 ? "high" : "medium",
            });
        }
    }

    // Category distributions
    for (const col of catCols) {
        if (col.topValues && col.topValues.length > 0) {
            const maxC = Math.max(...col.topValues.map(v => v.count));
            tables.push({
                title: `${col.name.replace(/_/g, " ")} distribution`,
                items: col.topValues.map((v, i) => ({ rank: i + 1, label: v.value, value: v.count, percentage: Math.round((v.count / maxC) * 100) })),
            });
        }
    }

    const kpis: KPI[] = numCols.map(col => ({
        label: col.name.replace(/_/g, " "),
        value: fmt(total(dataset.rows, col.name)),
        sublabel: `avg ${fmt(col.mean)}`
    }));

    return json({
        actionTitle: catCols.length > 0 && primaryNum
            ? `${primaryNum.name.replace(/_/g, " ")} distribution across ${catCols.length} dimension${catCols.length > 1 ? "s" : ""} reveals structural patterns`
            : `Data breakdown across ${fmt(summary.columnCount)} columns`,
        situation: `Segmenting ${fmt(summary.rowCount)} records by ${catCols.map(c => c.name.replace(/_/g, " ")).join(" and ")}.`,
        complication: strategicFindings.some(f => f.priority === "high")
            ? `Significant imbalances found in the distribution — some segments carry disproportionate weight.`
            : `Distribution is relatively balanced, but segment-level differences reveal optimization opportunities.`,
        resolution: `Compare performance across segments to find where to invest and where to cut.`,
        kpis, tables, strategicFindings,
        risks: [],
        recommendations: [
            `Compare profitability (not just volume) across segments.`,
            `Look for segments that punch above their weight — high value despite low volume.`,
        ],
        dataQuality: [`${fmt(summary.rowCount)} rows segmented across ${catCols.length} dimensions.`],
        suggestions: [`Which segment has the best margins?`, `Show the risks in this data`, `What are the top performers?`],
        transparency: {
            methodology: `Segmented ${fmt(summary.rowCount)} records by ${catCols.map(c => c.name).join(", ")}. Computed sum and share of ${primaryNum?.name || "numeric columns"} per category.`,
            dataPoints: summary.rowCount,
            confidence: summary.rowCount > 100 ? "high" : summary.rowCount > 30 ? "medium" : "low",
            formulas: [],
            sampleData: dataset.rows.slice(0, 5),
            assumptions: [`Segments based on raw category values — no grouping or normalization applied`],
        },
    });
}
