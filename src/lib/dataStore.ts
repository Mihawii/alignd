import type { SemanticProfile } from "./semanticLayer";

export interface DataSet {
    columns: string[];
    rows: Record<string, string>[];
    fileName: string;
    uploadedAt: number;
    semantics?: SemanticProfile;
}

// Persist across hot-reloads using globalThis
// Next.js dev mode wipes module-scope variables on HMR, but globalThis survives.
const globalStore = globalThis as typeof globalThis & {
    __aligndDataStore?: Map<string, DataSet>;
};

if (!globalStore.__aligndDataStore) {
    globalStore.__aligndDataStore = new Map<string, DataSet>();
}

const store = globalStore.__aligndDataStore;

export function setData(sessionId: string, data: DataSet): void {
    store.set(sessionId, data);
}

export function getData(sessionId: string): DataSet | undefined {
    return store.get(sessionId);
}

export function hasData(sessionId: string): boolean {
    return store.has(sessionId);
}

export function deleteData(sessionId: string): boolean {
    return store.delete(sessionId);
}
