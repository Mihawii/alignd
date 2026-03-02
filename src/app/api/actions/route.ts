import { NextRequest, NextResponse } from "next/server";
import { getData } from "@/lib/dataStore";
import { executeExportAction } from "@/lib/actionEngine";

/* ── POST: Execute an Action ──────────────────────── */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, sessionId } = body;

        if (!action || !action.type) {
            return NextResponse.json({ error: "No action specified" }, { status: 400 });
        }

        const dataset = sessionId ? getData(sessionId) : null;

        switch (action.type) {
            case "export": {
                const payload = action.payload || { columns: dataset?.columns || [], rows: dataset?.rows || [] };
                const csv = executeExportAction(payload);
                return new NextResponse(csv, {
                    status: 200,
                    headers: {
                        "Content-Type": "text/csv",
                        "Content-Disposition": `attachment; filename="alignd-export-${Date.now()}.csv"`,
                    },
                });
            }

            case "share": {
                return NextResponse.json({ text: action.payload?.text || "No content to share" });
            }

            default:
                return NextResponse.json({ error: "Unknown action type" }, { status: 400 });
        }
    } catch (err) {
        console.error("Action error:", err);
        return NextResponse.json({ error: "Action failed" }, { status: 500 });
    }
}
