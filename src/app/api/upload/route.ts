import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { v4 as uuidv4 } from "uuid";
import { setData, DataSet } from "@/lib/dataStore";
import { buildSemanticProfile } from "@/lib/semanticLayer";

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file");

        if (!file || !(file instanceof File)) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        if (!file.name.endsWith(".csv")) {
            return NextResponse.json({ error: "Only CSV files are supported" }, { status: 400 });
        }

        const text = await file.text();

        // Parse CSV
        const result = Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false, // keep everything as strings for consistency
        });

        if (result.errors.length > 0 && result.data.length === 0) {
            return NextResponse.json(
                { error: `CSV parsing failed: ${result.errors[0].message}` },
                { status: 400 }
            );
        }

        const rows = result.data as Record<string, string>[];
        // Filter out empty/whitespace-only column names (from trailing commas or blank headers)
        const columns = (result.meta.fields || []).filter(c => c.trim() !== "");

        if (columns.length === 0) {
            return NextResponse.json({ error: "No columns found in CSV" }, { status: 400 });
        }

        // Generate session ID and store
        const sessionId = uuidv4();
        const dataSet: DataSet = {
            columns,
            rows,
            fileName: file.name,
            uploadedAt: Date.now(),
        };

        // Auto-run semantic analysis (zero-config)
        const semantics = buildSemanticProfile(dataSet);
        dataSet.semantics = semantics as typeof dataSet.semantics;

        setData(sessionId, dataSet);

        return NextResponse.json({
            sessionId,
            columns,
            rowCount: rows.length,
            sampleRows: rows.slice(0, 5),
        });
    } catch (err) {
        console.error("Upload error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
