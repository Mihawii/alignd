import { NextRequest, NextResponse } from "next/server";
import { getData } from "@/lib/dataStore";
import { generateAlerts } from "@/lib/proactiveEngine";

/* ── GET: Proactive Alerts ────────────────────────── */
export async function GET(request: NextRequest) {
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    if (!sessionId) return NextResponse.json({ error: "No session" }, { status: 400 });

    const dataset = getData(sessionId);
    if (!dataset) return NextResponse.json({ error: "No data" }, { status: 404 });

    const alerts = generateAlerts(dataset, dataset.semantics);

    return NextResponse.json({
        alerts,
        count: alerts.length,
        criticalCount: alerts.filter(a => a.severity === "critical").length,
        warningCount: alerts.filter(a => a.severity === "warning").length,
    });
}
