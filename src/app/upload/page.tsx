"use client";

import { useState, useRef, useCallback, DragEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import styles from "./page.module.css";

interface UploadResponse {
    sessionId: string;
    columns: string[];
    rowCount: number;
    sampleRows: Record<string, string>[];
}

export default function UploadPage() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [file, setFile] = useState<File | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [preview, setPreview] = useState<UploadResponse | null>(null);

    const handleFile = useCallback((f: File) => {
        if (!f.name.endsWith(".csv")) {
            setError("Please upload a CSV file.");
            return;
        }
        setError(null);
        setFile(f);
        setPreview(null);
        uploadFile(f);
    }, []);

    const uploadFile = async (f: File) => {
        setUploading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append("file", f);

            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Upload failed");
            }

            const data: UploadResponse = await res.json();
            setPreview(data);
            localStorage.setItem("alignd_session", data.sessionId);
            localStorage.setItem("alignd_filename", f.name);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Upload failed");
        } finally {
            setUploading(false);
        }
    };

    const handleDrop = useCallback(
        (e: DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            setDragActive(false);
            const f = e.dataTransfer.files[0];
            if (f) handleFile(f);
        },
        [handleFile]
    );

    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragActive(true);
    };

    const handleDragLeave = () => setDragActive(false);

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) handleFile(f);
    };

    const handleAnalyze = () => {
        if (preview?.sessionId) {
            router.push("/chat");
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1048576).toFixed(1)} MB`;
    };

    /** Guess column type from sample data */
    const getColumnType = (col: string, rows: Record<string, string>[]): "numeric" | "categorical" => {
        const values = rows.map(r => r[col]).filter(Boolean);
        const numericCount = values.filter(v => !isNaN(Number(v))).length;
        return numericCount > values.length * 0.5 ? "numeric" : "categorical";
    };

    return (
        <>
            <Header />
            <main className={styles.uploadPage}>
                <div className={styles.container}>
                    <div className={styles.heading}>
                        <h1>Upload Your Data</h1>
                        <p>Drop a CSV file — AI will map your columns and detect patterns</p>
                    </div>

                    {/* Drop Zone */}
                    <div
                        className={`${styles.dropZone} ${dragActive ? styles.dropZoneActive : ""}`}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onClick={() => fileInputRef.current?.click()}
                        id="drop-zone"
                    >
                        <span className={styles.dropIcon}>
                            {uploading ? "⏳" : "📂"}
                        </span>
                        <p className={styles.dropTitle}>
                            {uploading
                                ? "Processing your data..."
                                : "Drag & drop your CSV"}
                        </p>
                        <p className={styles.dropSubtitle}>
                            {uploading ? "AI is analyzing columns and patterns" : "or click to browse"}
                        </p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            onChange={handleInputChange}
                            className={styles.fileInput}
                            id="file-input"
                        />
                    </div>

                    {/* Error */}
                    {error && <div className={styles.error}>{error}</div>}

                    {/* Data Health Cards */}
                    {file && !uploading && preview && (
                        <>
                            <div className={styles.dataHealth}>
                                <div className={styles.healthCard}>
                                    <div className={styles.healthCardValue}>{preview.rowCount}</div>
                                    <div className={styles.healthCardLabel}>Rows</div>
                                </div>
                                <div className={styles.healthCard}>
                                    <div className={styles.healthCardValue}>{preview.columns.length}</div>
                                    <div className={styles.healthCardLabel}>Columns</div>
                                </div>
                                <div className={styles.healthCard}>
                                    <div className={styles.healthCardValue}>{formatSize(file.size)}</div>
                                    <div className={styles.healthCardLabel}>File Size</div>
                                </div>
                            </div>

                            {/* Column Type Badges */}
                            <div className={styles.columnTypes}>
                                <div className={styles.columnTypesTitle}>Detected Columns</div>
                                <div className={styles.columnList}>
                                    {preview.columns.map((col) => {
                                        const type = getColumnType(col, preview.sampleRows);
                                        return (
                                            <span
                                                key={col}
                                                className={`${styles.columnBadge} ${type === "numeric" ? styles.columnBadgeNumeric : styles.columnBadgeCategorical}`}
                                            >
                                                <span className={`${styles.columnTypeDot} ${type === "numeric" ? styles.columnTypeDotNumeric : styles.columnTypeDotCategorical}`} />
                                                {col}
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Preview Table */}
                    {preview && (
                        <div className={styles.preview}>
                            <p className={styles.previewTitle}>Data Preview</p>
                            <div className={styles.tableWrapper}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            {preview.columns.map((col) => (
                                                <th key={col}>{col}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {preview.sampleRows.map((row, i) => (
                                            <tr key={i}>
                                                {preview.columns.map((col) => (
                                                    <td key={col}>{row[col]}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Analyze CTA */}
                    {preview && (
                        <button
                            className={styles.analyzeBtn}
                            onClick={handleAnalyze}
                            id="analyze-btn"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                            </svg>
                            Start Analysis →
                        </button>
                    )}

                    {uploading && (
                        <button className={styles.analyzeBtn} disabled>
                            <div className={styles.spinner} />
                            Processing...
                        </button>
                    )}
                </div>
            </main>
        </>
    );
}
