"use client";

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from "react";
import Link from "next/link";
import {
    Search,
    MessageSquare,
    ChevronRight,
    Target,
    Zap,
    Eye,
    Shield,
    BarChart3,
    Copy,
    Download,
    Upload,
    Send,
    FlaskConical,
    X,
    Layers,
    ArrowUpRight,
    DollarSign,
    TrendingUp,
    Activity,
    Hash,
} from "lucide-react";
import {
    Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Header } from "@/components/layout/header";
import { Main } from "@/components/layout/main";
import BarChartComp from "@/components/BarChart";
import LineChart from "@/components/LineChart";

/* ── Types ────────────────────────────────────────── */
interface Metric { name: string; min: number; max: number; mean: number; median: number; total: number; }
interface Category { name: string; values: { label: string; count: number }[]; label: string; count: number; uniqueCount: number; }
interface Distribution { name: string; bins: { label: string; count: number }[]; label: string; count: number; }
interface DashboardData {
    fileName: string; rowCount: number; columnCount: number; completeness: number;
    metrics: Metric[]; categories: Category[]; distributions: Distribution[];
    semantics?: {
        description: string; dataType: string;
        autoKPIs: { label: string; value: string; sublabel?: string }[];
        businessMetrics: { column: string; kind: string; label: string; importance: number }[];
        relationships: { from: string; to: string; type: string; description: string }[];
    };
}

interface StrategicFinding { insight: string; evidence: string; action: string; priority: "high" | "medium" | "low"; }
interface KPI { label: string; value: string; sublabel?: string; }
interface RankedTable { title: string; items: { rank: number; label: string; value: string | number; percentage?: number }[]; }
interface TransparencyInfo {
    methodology: string; dataPoints: number; confidence: "high" | "medium" | "low";
    formulas: { label: string; formula: string; result: string }[];
    sampleData?: Record<string, string>[]; assumptions: string[];
}
interface AIResponse {
    actionTitle?: string; situation?: string; complication?: string; resolution?: string;
    kpis?: KPI[]; tables?: RankedTable[]; strategicFindings?: StrategicFinding[];
    risks?: string[]; recommendations?: string[]; rawText?: string; suggestions?: string[];
    transparency?: TransparencyInfo;
    whatIf?: {
        results: { parameter: string; originalValue: string; projectedValue: string; delta: string; deltaPercent: string; impact: "positive" | "negative" | "neutral"; }[];
        confidence: "high" | "medium" | "low"; assumptions: string[]; summary: string;
    };
}
interface ChatMessage { role: "user" | "ai"; text: string; data?: AIResponse; }
interface ProactiveAlert {
    id: string; type: "anomaly" | "risk" | "opportunity" | "trend";
    severity: "critical" | "warning" | "info"; title: string; body: string;
    metric?: string; suggestedAction: string; suggestedQuestion: string; timestamp: number;
}

/* ── Main Page ────────────────────────────────────── */
export default function DashboardPage() {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [dashData, setDashData] = useState<DashboardData | null>(null);
    const [aiData, setAiData] = useState<AIResponse | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [chatOpen, setChatOpen] = useState(false);
    const [alerts, setAlerts] = useState<ProactiveAlert[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const chatRef = useRef<HTMLDivElement>(null);

    /* Init session */
    useEffect(() => {
        const sid = localStorage.getItem("alignd_session");
        setSessionId(sid);
    }, []);

    /* Auto-fetch data + initial AI analysis */
    useEffect(() => {
        if (!sessionId) return;
        setLoading(true);
        Promise.all([
            fetch(`/api/data?sessionId=${sessionId}`).then(r => r.json()),
            fetch("/api/chat", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question: "Give me a strategic overview of this data", sessionId }),
            }).then(r => r.json()),
            fetch(`/api/alerts?sessionId=${sessionId}`).then(r => r.json()),
        ]).then(([dataRes, aiRes, alertsRes]) => {
            if (!dataRes.error) setDashData(dataRes);
            setAiData(aiRes);
            if (alertsRes.alerts) setAlerts(alertsRes.alerts);
        }).catch(() => { }).finally(() => setLoading(false));
    }, [sessionId]);

    /* Ask AI */
    const askAI = useCallback(async (text?: string) => {
        const question = text || input.trim();
        if (!question || aiLoading || !sessionId) return;
        setInput(""); setAiLoading(true); setChatOpen(true);
        setMessages(prev => [...prev, { role: "user", text: question }]);
        try {
            const res = await fetch("/api/chat", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question, sessionId }),
            });
            const data: AIResponse = await res.json();
            setAiData(data);
            setMessages(prev => [...prev, {
                role: "ai", text: data.actionTitle || data.rawText || "Analysis complete.", data,
            }]);
        } catch {
            setMessages(prev => [...prev, { role: "ai", text: "Analysis failed. Try again." }]);
        } finally { setAiLoading(false); }
    }, [input, aiLoading, sessionId]);

    /* Scroll chat to bottom */
    useEffect(() => {
        if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }, [messages]);

    const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") { e.preventDefault(); askAI(); }
    };

    /* Derived */
    const displayKpis = aiData?.kpis || [];
    const displayTables = aiData?.tables || [];
    const displayFindings = aiData?.strategicFindings || [];
    const primaryMetric = dashData?.metrics?.[0];
    const primaryCategory = dashData?.categories?.[0];

    // 4 KPI cards from data or AI
    const kpiCards = displayKpis.length > 0 ? displayKpis.slice(0, 4).map((kpi, i) => ({
        title: kpi.label,
        value: kpi.value,
        sub: kpi.sublabel || "",
        icon: [DollarSign, TrendingUp, Activity, Hash][i % 4],
    })) : dashData ? [
        { title: "Total Rows", value: dashData.rowCount.toLocaleString(), sub: `${dashData.columnCount} columns`, icon: Hash },
        { title: primaryMetric ? primaryMetric.name.replace(/_/g, " ") : "Average", value: primaryMetric ? primaryMetric.mean.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—", sub: primaryMetric ? `Range: ${primaryMetric.min.toLocaleString()} – ${primaryMetric.max.toLocaleString()}` : "", icon: TrendingUp },
        { title: "Data Completeness", value: `${dashData.completeness}%`, sub: `${dashData.rowCount.toLocaleString()} records`, icon: Activity },
        { title: "Categories", value: dashData.categories.length.toString(), sub: `${dashData.distributions.length} distributions`, icon: BarChart3 },
    ] : [];

    return (
        <>
            {/* ===== Header ===== */}
            <Header>
                <div className="flex items-center gap-2 text-sm font-medium">
                    <BarChart3 className="size-4" />
                    Dashboard
                </div>
                <div className="ms-auto flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                        <Input
                            ref={inputRef}
                            placeholder="Ask about your data..."
                            className="w-[320px] pl-9 pr-12"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKey}
                            disabled={!sessionId || aiLoading}
                        />
                        <kbd className="pointer-events-none absolute right-2.5 top-2 hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:block">
                            ⌘K
                        </kbd>
                    </div>
                    <Button
                        size="sm"
                        onClick={() => input.trim() ? askAI() : setChatOpen(!chatOpen)}
                        disabled={aiLoading}
                    >
                        <MessageSquare className="size-4 mr-1" />
                        {aiLoading ? "Analyzing..." : input.trim() ? "Run AI" : "Chat"}
                    </Button>
                </div>
            </Header>

            {/* ===== Main ===== */}
            <Main>
                {/* No data */}
                {!sessionId && (
                    <div className="flex flex-col items-center justify-center gap-4 py-24">
                        <Upload className="size-12 text-muted-foreground" />
                        <h2 className="text-xl font-semibold">No data connected</h2>
                        <p className="text-muted-foreground">Upload a CSV to see your dashboard</p>
                        <Button asChild>
                            <Link href="/upload">Upload File</Link>
                        </Button>
                    </div>
                )}

                {/* Loading */}
                {sessionId && loading && !dashData && (
                    <div className="flex flex-col items-center gap-4 py-24">
                        <div className="size-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
                        <span className="text-sm text-muted-foreground">Loading data...</span>
                    </div>
                )}

                {/* ===== DASHBOARD ===== */}
                {dashData && (
                    <>
                        <div className="mb-2 flex items-center justify-between space-y-2">
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
                                <p className="text-sm text-muted-foreground">{dashData.fileName} · {dashData.rowCount.toLocaleString()} rows · {dashData.columnCount} columns</p>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Button variant="outline" onClick={async () => {
                                    const res = await fetch("/api/actions", {
                                        method: "POST", headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ action: { type: "export" }, sessionId }),
                                    });
                                    const blob = await res.blob();
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement("a");
                                    a.href = url; a.download = `alignd-export-${Date.now()}.csv`; a.click();
                                    URL.revokeObjectURL(url);
                                }}>
                                    <Download className="size-4 mr-2" /> Download
                                </Button>
                            </div>
                        </div>

                        <Tabs orientation="vertical" defaultValue="overview" className="space-y-4">
                            <div className="w-full overflow-x-auto pb-2">
                                <TabsList>
                                    <TabsTrigger value="overview">Overview</TabsTrigger>
                                    <TabsTrigger value="analytics">Analytics</TabsTrigger>
                                    <TabsTrigger value="alerts" className="relative">
                                        Alerts
                                        {alerts.length > 0 && (
                                            <span className="ml-1.5 flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-white">
                                                {alerts.length}
                                            </span>
                                        )}
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            {/* ── OVERVIEW TAB ── */}
                            <TabsContent value="overview" className="space-y-4">
                                {/* KPI Cards */}
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                    {kpiCards.map((kpi, i) => (
                                        <Card key={i}>
                                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                                <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
                                                <kpi.icon className="h-4 w-4 text-muted-foreground" />
                                            </CardHeader>
                                            <CardContent>
                                                <div className="text-2xl font-bold">{kpi.value}</div>
                                                {kpi.sub && <p className="text-xs text-muted-foreground">{kpi.sub}</p>}
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>

                                {/* AI Understanding card */}
                                {dashData.semantics && (
                                    <Card className="border-primary/20 bg-primary/[0.02]">
                                        <CardHeader className="pb-3">
                                            <div className="flex items-center justify-between">
                                                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                                                    <span className="flex size-2 rounded-full bg-primary animate-pulse" />
                                                    AI Understanding
                                                </CardTitle>
                                                <Badge variant="outline">{dashData.semantics.dataType} data</Badge>
                                            </div>
                                            <CardDescription>{dashData.semantics.description}</CardDescription>
                                        </CardHeader>
                                    </Card>
                                )}

                                {/* AI headline */}
                                {aiData?.actionTitle && (
                                    <Card>
                                        <CardContent className="py-4 px-6">
                                            <p className="font-medium">{aiData.actionTitle}</p>
                                            {aiData.complication && (
                                                <p className="mt-1 text-sm text-amber-600 flex items-center gap-1.5">
                                                    <span className="flex size-1.5 rounded-full bg-amber-500" />
                                                    {aiData.complication}
                                                </p>
                                            )}
                                            {aiData.resolution && (
                                                <p className="mt-1 text-sm text-emerald-600 flex items-center gap-1.5">
                                                    <span className="flex size-1.5 rounded-full bg-emerald-500" />
                                                    {aiData.resolution}
                                                </p>
                                            )}
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Charts: Overview + Distribution (shadcn-admin 7-col grid) */}
                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
                                    <Card className="col-span-1 lg:col-span-4">
                                        <CardHeader>
                                            <CardTitle>{displayTables[0]?.title || primaryCategory?.name.replace(/_/g, " ") || "Overview"}</CardTitle>
                                        </CardHeader>
                                        <CardContent className="ps-2">
                                            {displayTables.length > 0 ? (
                                                <BarChartComp
                                                    title=""
                                                    data={displayTables[0].items.map(item => ({
                                                        label: item.label,
                                                        value: typeof item.value === "number" ? item.value.toLocaleString() : item.value,
                                                        percentage: item.percentage ?? 50,
                                                    }))}
                                                />
                                            ) : primaryCategory ? (
                                                <BarChartComp
                                                    title=""
                                                    data={primaryCategory.values.map(v => ({
                                                        label: v.label,
                                                        value: v.count.toLocaleString(),
                                                        percentage: (v.count / (primaryCategory.values[0]?.count || 1)) * 100,
                                                    }))}
                                                />
                                            ) : (
                                                <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">No chart data available</div>
                                            )}
                                        </CardContent>
                                    </Card>

                                    <Card className="col-span-1 lg:col-span-3">
                                        <CardHeader>
                                            <CardTitle>{dashData.distributions[0]?.name.replace(/_/g, " ") || "Distribution"}</CardTitle>
                                            <CardDescription>{dashData.distributions[0] ? "Value distribution" : "No distributions found"}</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            {dashData.distributions[0] ? (
                                                <LineChart title="" data={dashData.distributions[0].bins} color="#3b82f6" height={200} />
                                            ) : (
                                                <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">No distribution data</div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Strategic Findings */}
                                {displayFindings.length > 0 && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Strategic Findings</CardTitle>
                                            <CardDescription>{displayFindings.length} insights from your data</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-4">
                                                {displayFindings.slice(0, 4).map((f, i) => (
                                                    <div key={i} className="flex items-start gap-4">
                                                        <Badge variant={f.priority === "high" ? "destructive" : f.priority === "medium" ? "default" : "secondary"} className="mt-0.5 text-[10px]">
                                                            {f.priority}
                                                        </Badge>
                                                        <div className="flex-1 space-y-1">
                                                            <p className="text-sm font-medium leading-none">{f.insight}</p>
                                                            <p className="text-xs text-muted-foreground">{f.evidence}</p>
                                                            <p className="text-xs text-primary">→ {f.action}</p>
                                                            <div className="flex gap-1.5 pt-1">
                                                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => askAI(f.action)}>
                                                                    <Target className="size-3 mr-1" /> Drill Down
                                                                </Button>
                                                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                                                                    navigator.clipboard.writeText(`${f.insight}\n\nEvidence: ${f.evidence}\n\n${f.action}\n\n— Generated by alignd`);
                                                                }}>
                                                                    <Copy className="size-3 mr-1" /> Share
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Risks */}
                                {aiData?.risks && aiData.risks.length > 0 && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2">
                                                <Shield className="size-4" /> Risk Flags
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-2">
                                                {aiData.risks.map((r, i) => (
                                                    <p key={i} className="text-sm flex items-start gap-2">
                                                        <span className="mt-1.5 flex size-1.5 shrink-0 rounded-full bg-destructive" />
                                                        {r}
                                                    </p>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* What-If */}
                                {aiData?.whatIf && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2">
                                                <FlaskConical className="size-4" /> Scenario Analysis
                                            </CardTitle>
                                            <CardDescription>{aiData.whatIf.summary}</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                {aiData.whatIf.results.map((r, i) => (
                                                    <div key={i} className="rounded-lg border p-3">
                                                        <div className="text-xs text-muted-foreground mb-1">{r.parameter}</div>
                                                        <div className="flex items-center gap-2 text-sm">
                                                            <span className="text-muted-foreground">{r.originalValue}</span>
                                                            <ArrowUpRight className="size-3" />
                                                            <span className="font-medium">{r.projectedValue}</span>
                                                        </div>
                                                        <span className={`mt-1 inline-block text-xs font-medium ${r.impact === "positive" ? "text-emerald-600" : r.impact === "negative" ? "text-red-600" : "text-muted-foreground"}`}>
                                                            {r.delta} ({r.deltaPercent})
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Recommendations */}
                                {aiData?.recommendations && aiData.recommendations.length > 0 && (
                                    <Card>
                                        <CardHeader><CardTitle>Recommended Actions</CardTitle></CardHeader>
                                        <CardContent>
                                            <div className="space-y-3">
                                                {aiData.recommendations.map((r, i) => (
                                                    <div key={i} className="flex items-start gap-3 text-sm">
                                                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{i + 1}</span>
                                                        <span>{r}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Transparency */}
                                {aiData?.transparency && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2">
                                                <Eye className="size-4" /> How This Was Calculated
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-4">
                                                <div className="flex gap-2">
                                                    <Badge variant={aiData.transparency.confidence === "high" ? "default" : aiData.transparency.confidence === "medium" ? "secondary" : "destructive"}>
                                                        {aiData.transparency.confidence} confidence
                                                    </Badge>
                                                    <Badge variant="outline">{aiData.transparency.dataPoints.toLocaleString()} data points</Badge>
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-medium text-muted-foreground mb-1">Methodology</h4>
                                                    <p className="text-sm">{aiData.transparency.methodology}</p>
                                                </div>
                                                {aiData.transparency.formulas.length > 0 && (
                                                    <div>
                                                        <h4 className="text-xs font-medium text-muted-foreground mb-1">Formulas</h4>
                                                        <div className="space-y-1.5">
                                                            {aiData.transparency.formulas.map((f, i) => (
                                                                <div key={i} className="flex items-center gap-3 text-sm">
                                                                    <span className="text-muted-foreground">{f.label}</span>
                                                                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{f.formula}</code>
                                                                    <span className="font-medium">= {f.result}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {aiData.transparency.sampleData && aiData.transparency.sampleData.length > 0 && (
                                                    <div>
                                                        <h4 className="text-xs font-medium text-muted-foreground mb-1">Sample Data Used</h4>
                                                        <div className="overflow-x-auto rounded-lg border">
                                                            <table className="w-full text-xs">
                                                                <thead><tr className="border-b bg-muted/50">
                                                                    {Object.keys(aiData.transparency.sampleData[0]).slice(0, 6).map(col => (
                                                                        <th key={col} className="px-3 py-2 text-left font-medium">{col}</th>
                                                                    ))}
                                                                </tr></thead>
                                                                <tbody>
                                                                    {aiData.transparency.sampleData.slice(0, 5).map((row, i) => (
                                                                        <tr key={i} className="border-b last:border-0">
                                                                            {Object.keys(row).slice(0, 6).map(col => (
                                                                                <td key={col} className="px-3 py-2">{row[col]}</td>
                                                                            ))}
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}
                            </TabsContent>

                            {/* ── ANALYTICS TAB ── */}
                            <TabsContent value="analytics" className="space-y-4">
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                    <Card>
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-sm font-medium">Rows</CardTitle>
                                            <Hash className="h-4 w-4 text-muted-foreground" />
                                        </CardHeader>
                                        <CardContent><div className="text-2xl font-bold">{dashData.rowCount.toLocaleString()}</div></CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-sm font-medium">Columns</CardTitle>
                                            <BarChart3 className="h-4 w-4 text-muted-foreground" />
                                        </CardHeader>
                                        <CardContent><div className="text-2xl font-bold">{dashData.columnCount}</div></CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-sm font-medium">Completeness</CardTitle>
                                            <Activity className="h-4 w-4 text-muted-foreground" />
                                        </CardHeader>
                                        <CardContent><div className="text-2xl font-bold">{dashData.completeness}%</div></CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-sm font-medium">Categories</CardTitle>
                                            <Layers className="h-4 w-4 text-muted-foreground" />
                                        </CardHeader>
                                        <CardContent><div className="text-2xl font-bold">{dashData.categories.length}</div></CardContent>
                                    </Card>
                                </div>

                                {dashData.metrics.length > 0 && (
                                    <Card>
                                        <CardHeader><CardTitle>Numeric Metrics</CardTitle></CardHeader>
                                        <CardContent>
                                            <div className="overflow-x-auto rounded-lg border">
                                                <table className="w-full text-sm">
                                                    <thead><tr className="border-b bg-muted/50">
                                                        <th className="px-4 py-2 text-left font-medium">Metric</th>
                                                        <th className="px-4 py-2 text-right font-medium">Min</th>
                                                        <th className="px-4 py-2 text-right font-medium">Max</th>
                                                        <th className="px-4 py-2 text-right font-medium">Mean</th>
                                                        <th className="px-4 py-2 text-right font-medium">Median</th>
                                                        <th className="px-4 py-2 text-right font-medium">Total</th>
                                                    </tr></thead>
                                                    <tbody>
                                                        {dashData.metrics.map((m, i) => (
                                                            <tr key={i} className="border-b last:border-0">
                                                                <td className="px-4 py-2 font-medium">{m.name.replace(/_/g, " ")}</td>
                                                                <td className="px-4 py-2 text-right">{m.min.toLocaleString()}</td>
                                                                <td className="px-4 py-2 text-right">{m.max.toLocaleString()}</td>
                                                                <td className="px-4 py-2 text-right">{m.mean.toLocaleString()}</td>
                                                                <td className="px-4 py-2 text-right">{m.median.toLocaleString()}</td>
                                                                <td className="px-4 py-2 text-right font-medium">{m.total.toLocaleString()}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {dashData.distributions.length > 0 && (
                                    <div className="grid gap-4 lg:grid-cols-2">
                                        {dashData.distributions.map((dist, i) => (
                                            <Card key={i}>
                                                <CardHeader><CardTitle className="text-sm">{dist.name.replace(/_/g, " ")}</CardTitle></CardHeader>
                                                <CardContent>
                                                    <LineChart title="" data={dist.bins} color={["#ff5100", "#3b82f6", "#16a34a", "#f59e0b"][i % 4]} height={180} />
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </TabsContent>

                            {/* ── ALERTS TAB ── */}
                            <TabsContent value="alerts" className="space-y-4">
                                {alerts.length === 0 ? (
                                    <div className="flex flex-col items-center gap-3 py-16">
                                        <Zap className="size-10 text-muted-foreground" />
                                        <p className="text-muted-foreground">No proactive alerts at this time.</p>
                                    </div>
                                ) : alerts.map(alert => (
                                    <Card key={alert.id} className={alert.severity === "critical" ? "border-destructive/50" : alert.severity === "warning" ? "border-amber-500/50" : ""}>
                                        <CardContent className="py-4 px-6">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Badge variant={alert.severity === "critical" ? "destructive" : alert.severity === "warning" ? "default" : "secondary"}>
                                                    {alert.severity}
                                                </Badge>
                                                <Badge variant="outline">{alert.type}</Badge>
                                            </div>
                                            <p className="font-medium">{alert.title}</p>
                                            <p className="text-sm text-muted-foreground mt-1">{alert.body}</p>
                                            <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={() => askAI(alert.suggestedQuestion)}>
                                                Investigate <ArrowUpRight className="size-3 ml-1" />
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </TabsContent>
                        </Tabs>
                    </>
                )}
            </Main>

            {/* ═══ CHAT PANEL ═════════════════ */}
            {chatOpen && (
                <div className="fixed right-0 top-0 z-50 flex h-svh w-[380px] flex-col border-l bg-background shadow-lg">
                    <div className="flex h-14 items-center justify-between border-b px-4">
                        <span className="flex items-center gap-2 text-sm font-medium">
                            <span className="flex size-2 rounded-full bg-primary animate-pulse" />
                            alignd AI
                        </span>
                        <Button variant="ghost" size="icon" className="size-7" onClick={() => setChatOpen(false)}>
                            <X className="size-4" />
                        </Button>
                    </div>

                    <ScrollArea className="flex-1 p-4" ref={chatRef}>
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center gap-3 py-12 px-4 text-center">
                                <MessageSquare className="size-10 text-muted-foreground/40" />
                                <p className="text-sm font-medium">Ask about your data</p>
                                <p className="text-xs text-muted-foreground">I analyze patterns, flag risks, and find insights you might miss.</p>
                                <div className="mt-2 space-y-1.5 w-full">
                                    <Button variant="outline" size="sm" className="w-full justify-start text-xs" onClick={() => askAI("What are the key patterns in this data?")}>
                                        <Target className="size-3 mr-2" /> Key patterns
                                    </Button>
                                    <Button variant="outline" size="sm" className="w-full justify-start text-xs" onClick={() => askAI("What are the biggest risks?")}>
                                        <Zap className="size-3 mr-2" /> Biggest risks
                                    </Button>
                                    <Button variant="outline" size="sm" className="w-full justify-start text-xs" onClick={() => askAI("Break down the data by category")}>
                                        <Layers className="size-3 mr-2" /> Category breakdown
                                    </Button>
                                </div>
                            </div>
                        )}
                        <div className="space-y-3">
                            {messages.map((msg, i) => (
                                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start gap-2"}`}>
                                    {msg.role === "ai" && (
                                        <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">A</div>
                                    )}
                                    <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                                        {msg.text}
                                        {msg.data?.complication && (
                                            <p className="mt-1 text-xs opacity-80 flex items-center gap-1">
                                                <span className="flex size-1.5 rounded-full bg-amber-500" />
                                                {msg.data.complication}
                                            </p>
                                        )}
                                        {msg.data?.resolution && (
                                            <p className="mt-1 text-xs opacity-80 flex items-center gap-1">
                                                <span className="flex size-1.5 rounded-full bg-emerald-500" />
                                                {msg.data.resolution}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {aiLoading && (
                                <div className="flex justify-start gap-2">
                                    <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">A</div>
                                    <div className="rounded-xl bg-muted px-3 py-2">
                                        <div className="flex gap-1">
                                            <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                                            <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                                            <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>

                    <div className="flex items-center gap-2 border-t p-3">
                        <Input
                            placeholder="Ask about your data..."
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKey}
                            disabled={aiLoading}
                            className="flex-1"
                        />
                        <Button size="icon" onClick={() => askAI()} disabled={!input.trim() || aiLoading}>
                            <Send className="size-4" />
                        </Button>
                    </div>
                </div>
            )}
        </>
    );
}
