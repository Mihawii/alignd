# Synaptic — Technical Documentation

## What is Synaptic?

Synaptic is an **AI-powered data analytics engine** that transforms raw CSV data into executive-grade strategic insights. Instead of building dashboards manually or writing SQL queries, users upload a dataset and ask questions in plain English. The system responds with structured analysis following the **Pyramid Principle** (answer first, then evidence) and the **SCR framework** (Situation → Complication → Resolution) — the same methodology used by McKinsey, BCG, and Bain.

### Core Value Proposition

> _"From raw data to executive insights in seconds — no SQL, no pivot tables, no dashboards to build."_

---

## Tech Stack

| Layer        | Technology                  | Version   |
|--------------|-----------------------------|-----------|
| Framework    | Next.js (App Router)        | 16.1.6    |
| Language     | TypeScript                  | 5.x       |
| Frontend     | React                       | 19.2.3    |
| CSV Parsing  | PapaParse                   | 5.5.3     |
| Session IDs  | uuid                        | 13.0.0    |
| AI Backend   | Configurable (Gemini, etc.) | via env   |
| Styling      | CSS Modules (vanilla)       | —         |
| Bundler      | Turbopack (via Next.js)     | built-in  |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     CLIENT (React)                      │
│                                                         │
│  Landing Page ─── Upload Page ─── Dashboard + Chat      │
│     page.tsx       upload/         chat/page.tsx         │
│                   page.tsx                               │
└────────────┬───────────┬──────────────┬─────────────────┘
             │           │              │
             ▼           ▼              ▼
┌────────────────────────────────────────────────────────┐
│                   API ROUTES (Server)                   │
│                                                        │
│  /api/upload     /api/data         /api/chat           │
│  CSV parsing     Stats +           AI analysis +       │
│  + session       summaries         local fallback      │
└───────┬────────────┬──────────────────┬────────────────┘
        │            │                  │
        ▼            ▼                  ▼
┌────────────────────────────────────────────────────────┐
│                 DATA LAYER (lib/)                       │
│                                                        │
│  dataStore.ts          dataAnalysis.ts                  │
│  In-memory session     Column detection, summarization, │
│  storage via           identifier filtering,            │
│  globalThis            AI context builder               │
└────────────────────────────────────────────────────────┘
```

---

## Project File Structure

```
src/
├── app/
│   ├── page.tsx                  # Landing page (hero, features, CTA)
│   ├── page.module.css           # Landing page styles
│   ├── HeroFrames.tsx            # Scroll-driven hero animation
│   ├── globals.css               # Design tokens + global styles
│   ├── layout.tsx                # Root layout (fonts, metadata)
│   ├── upload/
│   │   ├── page.tsx              # File upload UI
│   │   └── page.module.css
│   ├── chat/
│   │   ├── page.tsx              # Dashboard + AI chat panel
│   │   └── page.module.css
│   └── api/
│       ├── upload/route.ts       # POST — CSV parsing + session creation
│       ├── data/route.ts         # GET  — Dataset statistics + distributions
│       └── chat/route.ts         # POST — AI analysis | GET — Smart suggestions
├── components/
│   ├── BarChart.tsx              # Canvas-rendered horizontal bar chart
│   ├── LineChart.tsx             # Canvas-rendered line/area chart
│   ├── DonutChart.tsx            # Canvas-rendered donut chart
│   ├── Header.tsx                # Global navigation header
│   └── Header.module.css
└── lib/
    ├── dataStore.ts              # In-memory session store
    └── dataAnalysis.ts           # Data summarization + AI context builder
```

---

## How the Data Pipeline Works

### 1. Upload (`/api/upload`)

When a user uploads a CSV file, the server:

1. Validates the file (must be `.csv`)
2. Parses it using PapaParse with `header: true`
3. Generates a UUID session ID
4. Stores the parsed data in memory

```typescript
// src/app/api/upload/route.ts
const text = await file.text();

const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,  // keep everything as strings for consistency
});

const sessionId = uuidv4();
setData(sessionId, {
    columns,
    rows,
    fileName: file.name,
    uploadedAt: Date.now(),
});
```

The session ID is returned to the client and stored in `localStorage` for persistence across page navigations.

---

### 2. Data Storage (`lib/dataStore.ts`)

Data is stored in-memory using a `Map<string, DataSet>` attached to `globalThis`. This survives Next.js hot-module reloads in development:

```typescript
// src/lib/dataStore.ts
export interface DataSet {
    columns: string[];
    rows: Record<string, string>[];
    fileName: string;
    uploadedAt: number;
}

const globalStore = globalThis as typeof globalThis & {
    __synapticDataStore?: Map<string, DataSet>;
};

if (!globalStore.__synapticDataStore) {
    globalStore.__synapticDataStore = new Map<string, DataSet>();
}
```

> **Note:** This is an MVP in-memory store. In production, this would be replaced with a database (e.g., PostgreSQL, Redis, or S3-backed storage).

---

### 3. Data Analysis (`lib/dataAnalysis.ts`)

This module is the intelligence layer. It performs three key functions:

#### Column Type Detection

Every column is classified as `numeric`, `categorical`, `date`, or `text` by sampling the first 50 values:

```typescript
function detectColumnType(values: string[]): "numeric" | "categorical" | "date" | "text" {
    const sample = nonEmpty.slice(0, Math.min(50, nonEmpty.length));
    const numericCount = sample.filter(isNumeric).length;
    const dateCount = sample.filter(isDate).length;

    if (numericCount / sample.length > 0.8) return "numeric";
    if (dateCount / sample.length > 0.8) return "date";

    const uniqueRatio = new Set(nonEmpty).size / nonEmpty.length;
    if (uniqueRatio < 0.5 || new Set(nonEmpty).size <= 20) return "categorical";

    return "text";
}
```

#### Identifier Column Detection

Columns that are row identifiers (not business metrics) are detected and excluded from analysis. This prevents the AI from generating nonsensical insights like _"9,899x gap between the highest and lowest reviewer_id"_:

```typescript
const ID_PATTERNS = /^(.*_)?(id|key|code|index|idx|pk|fk|uuid|guid|sku|ref)(_.+)?$/i;

export function isIdentifierColumn(name: string, values: string[]): boolean {
    // Name-based: matches reviewer_id, product_key, sku_code, etc.
    if (ID_PATTERNS.test(name.replace(/\s+/g, "_"))) return true;

    // Statistical: high-cardinality sequential integers
    const nums = nonEmpty.map(Number).filter(n => !isNaN(n) && Number.isInteger(n));
    if (nums.length > 20) {
        const uniqueRatio = new Set(nums).size / nums.length;
        if (uniqueRatio > 0.9) return true;  // >90% unique integers = ID
    }
    return false;
}
```

#### Data Summarization

Each column gets a statistical summary:

- **Numeric columns**: min, max, mean, median
- **Categorical columns**: top 8 values with frequency counts
- **All columns**: unique count, null count, type, identifier flag

#### AI Context Builder

The `buildContext()` function generates a structured text representation of the dataset for the AI model. It explicitly marks identifier columns so the AI knows to skip them:

```typescript
export function buildContext(dataset: DataSet): string {
    const summary = summarizeData(dataset);
    // ...
    // Mark ID columns prominently
    const idCols = summary.columns.filter(c => c.isIdentifier).map(c => c.name);
    if (idCols.length > 0) {
        lines.push(`## IDENTIFIER COLUMNS (ignore these — they are IDs, NOT metrics):`);
        lines.push(`  ${idCols.join(", ")}`);
    }
    // ...includes column details, sample data, and full data for small datasets
}
```

---

### 4. AI Analysis (`/api/chat`)

The chat API route has two modes:

#### Mode A: AI Model (Primary)

When `AI_API_KEY` is configured, the system calls an external AI model (default: Gemini 2.0 Flash) via an OpenAI-compatible API:

```typescript
const AI_API_KEY  = process.env.AI_API_KEY || "";
const AI_BASE_URL = process.env.AI_API_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai";
const AI_MODEL    = process.env.AI_MODEL || "gemini-2.0-flash";
```

The AI receives a system prompt that enforces:
- **Pyramid Principle**: lead with the answer, then evidence
- **SCR Framework**: Situation → Complication → Resolution
- **Structured JSON output** with KPIs, ranked tables, strategic findings, risks, recommendations
- **Rule #8**: explicitly bans analysis of identifier columns

#### Mode B: Local Fallback Engine

When no AI key is configured, a built-in analysis engine generates McKinsey-grade structured responses using pure statistics. It includes specialized analyzers for:

| Query Type | Trigger Keywords | Analysis |
|---|---|---|
| Overview | (default) | Dataset summary, top metrics, concentration analysis |
| Top Performers | "best", "top", "highest" | Rankings by numeric columns, cross-tabulated by categories |
| Underperformers | "worst", "lowest", "weak" | Bottom performers, gap analysis |
| Risk Assessment | "risk", "danger", "concern" | Concentration risk, data quality issues, outliers |
| Breakdown | "breakdown", "distribution" | Category segmentation, percentage splits |

#### Response Schema

Both modes return the same structured JSON:

```typescript
interface AnalysisResponse {
    actionTitle: string;      // Main conclusion (McKinsey slide title style)
    situation: string;        // Neutral facts — what the data shows
    complication: string;     // The "so what" — why this matters
    resolution: string;       // What to do about it
    kpis: KPI[];              // Key metrics with "so what" sublabels
    tables: RankedTable[];    // Ranked comparison tables
    strategicFindings: StrategicFinding[];  // Conclusion → evidence → action
    risks: string[];          // Red flags
    recommendations: string[];// Prioritized actions
    suggestions: string[];    // Follow-up questions
}
```

---

### 5. Dashboard Statistics (`/api/data`)

The data API computes dashboard-ready statistics from the stored dataset:

- **Metrics**: min, max, mean, median, total for each numeric column (excluding identifiers)
- **Categories**: top values with counts for each categorical column
- **Distributions**: histogram bins for each numeric column (excluding identifiers)
- **Completeness**: percentage of non-empty cells

Identifier columns are filtered out at the API level so charts never display meaningless ID distributions.

---

## Frontend Components

### Dashboard (`chat/page.tsx`)

The main dashboard renders:

1. **Overview Card** — file name, row/column counts, AI's main conclusion
2. **KPI Row** — key metrics from AI analysis with "so what" sublabels
3. **Charts Row** — bar charts (ranked tables or categories) + line charts (distributions)
4. **Findings + Risks** — strategic findings with priority badges + risk flags
5. **Recommendations** — numbered action items
6. **Category Breakdowns** — additional categorical data visualizations

All sections use a `CollapseCard` component that makes every card expandable/collapsible:

```tsx
function CollapseCard({ title, badge, className, defaultOpen = true, children }: {
    title: string; badge?: string; className?: string; defaultOpen?: boolean;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className={`${styles.card} ${className || ""}`}>
            <div className={styles.cardHead} onClick={() => setOpen(!open)}>
                <span className={styles.cardTitle}>
                    <span className={styles.collapseArrow}
                          style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}>›</span>
                    {title}
                </span>
                {badge && <span className={styles.cardBadge}>{badge}</span>}
            </div>
            {open && children}
        </div>
    );
}
```

### Chat Panel

A slide-in panel for conversational data exploration. Features:
- AI avatar marks on responses
- Animated typing indicator (bouncing dots)
- Quick-start suggestion buttons
- Messages show the SCR breakdown (complication + resolution)

### Chart Components

All charts render on HTML `<canvas>` using the Canvas 2D API — no chart library dependency:

- **`BarChart.tsx`** — Horizontal bar chart with inline labels, percentage fills, and hover tooltips
- **`LineChart.tsx`** — Line/area chart with gradient fill, grid lines, axis labels, and hover crosshair
- **`DonutChart.tsx`** — Donut/ring chart with category segments and center label

---

## Environment Configuration

```env
# .env.local
AI_API_KEY=your_api_key_here
AI_API_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
AI_MODEL=gemini-2.0-flash
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `AI_API_KEY` | No | `""` | API key for the AI model. If empty, uses local fallback. |
| `AI_API_BASE_URL` | No | Gemini endpoint | OpenAI-compatible base URL. |
| `AI_MODEL` | No | `gemini-2.0-flash` | Model identifier. |

---

## Running the Project

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

The app runs on `http://localhost:3000` by default.

---

## Design System

The visual identity uses a premium dark theme defined in `globals.css`:

```css
:root {
    --bg: #09090b;
    --surface: #0f0f13;
    --text: #e4e4e7;
    --text-secondary: #a1a1aa;
    --text-tertiary: #52525b;
    --accent: #6387ff;
    --font-sans: "Inter", system-ui, sans-serif;
    --font-serif: "Instrument Serif", Georgia, serif;
    --font-mono: "JetBrains Mono", monospace;
}
```

- **Colors**: Dark backgrounds with subtle blue accent (#6387ff)
- **Cards**: Glassmorphic borders with faint blue glow on hover
- **Typography**: Inter for UI, Instrument Serif for branding, JetBrains Mono for code
- **Animations**: Subtle fade-ups, smooth 0.2s transitions, pulse effects

---

## User Flow

```
1. LANDING PAGE (/)
   ├── Hero section with scroll animation
   ├── "How It Works" — 3 steps (Upload → Ask → Decide)
   ├── Features grid
   └── CTA → links to /upload

2. UPLOAD PAGE (/upload)
   ├── Drag & drop or file picker
   ├── CSV parsing + preview
   └── Redirect to /chat with session ID in localStorage

3. DASHBOARD (/chat)
   ├── Auto-loads data + runs initial AI analysis
   ├── Sidebar: data source info + suggestion buttons
   ├── Main: KPIs, charts, findings, recommendations
   ├── Search bar: ask any question → updates all panels
   └── Chat panel: slide-in conversational interface
```
