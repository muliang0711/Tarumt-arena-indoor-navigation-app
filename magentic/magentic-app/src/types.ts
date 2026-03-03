// ─── Data Models ─────────────────────────────────────────

export interface Sample {
    timestamp: number;   // ms since epoch
    x: number;
    y: number;
    z: number;
    magnitude: number;   // sqrt(x² + y² + z²)
}

export type FloorLabel = 'Floor 1' | 'Floor 2';

export interface Dataset {
    datasetId: string;
    label: FloorLabel;
    createdAt: string;   // ISO 8601
    samples: Sample[];
    meta: {
        samplingHz: number;
        device: string;
        notes?: string;
    };
}

export interface CompareResult {
    cosineSimilarity: number;    // 0–1
    dtwDistance: number;          // raw DTW distance
    normalizedDTW: number;       // 0–1, lower = more similar
    conclusion: 'Very Similar' | 'Similar' | 'Different';
}

export interface DatasetSummary {
    exists: boolean;
    sampleCount: number;
    durationMs: number;
    createdAt: string | null;
}
