import { CompareResult } from './types';

// ─── Preprocessing ───────────────────────────────────────

/**
 * Simple Moving Average smoothing.
 */
function smooth(data: number[], window: number = 5): number[] {
    const result: number[] = [];
    const half = Math.floor(window / 2);
    for (let i = 0; i < data.length; i++) {
        let sum = 0;
        let count = 0;
        for (let j = i - half; j <= i + half; j++) {
            if (j >= 0 && j < data.length) {
                sum += data[j];
                count++;
            }
        }
        result.push(sum / count);
    }
    return result;
}

/**
 * Z-score normalization: (x - mean) / std
 */
function zNormalize(data: number[]): number[] {
    if (data.length === 0) return [];
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const variance =
        data.reduce((sum, x) => sum + (x - mean) * (x - mean), 0) / data.length;
    const std = Math.sqrt(variance);
    if (std === 0) return data.map(() => 0);
    return data.map((x) => (x - mean) / std);
}

/**
 * Linear interpolation to resample a signal to a target length.
 */
function resample(data: number[], targetLen: number): number[] {
    if (data.length === 0) return [];
    if (data.length === targetLen) return [...data];
    const result: number[] = [];
    for (let i = 0; i < targetLen; i++) {
        const srcIdx = (i / (targetLen - 1)) * (data.length - 1);
        const lo = Math.floor(srcIdx);
        const hi = Math.min(lo + 1, data.length - 1);
        const frac = srcIdx - lo;
        result.push(data[lo] * (1 - frac) + data[hi] * frac);
    }
    return result;
}

// ─── Cosine Similarity ──────────────────────────────────

/**
 * Cosine similarity between two equal-length vectors.
 * Returns value in [−1, 1]; we clamp to [0, 1] for display.
 */
function cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    if (denom === 0) return 0;
    const raw = dot / denom;
    return Math.max(0, Math.min(1, raw)); // clamp [0,1]
}

// ─── Dynamic Time Warping ───────────────────────────────

/**
 * DTW distance between two sequences (standard O(n*m) algorithm).
 * Returns raw accumulated cost.
 */
function dtwDistance(a: number[], b: number[]): number {
    const n = a.length;
    const m = b.length;

    // For very long sequences, downsample to keep computation reasonable
    const MAX_LEN = 2000;
    let sa = a;
    let sb = b;
    if (n > MAX_LEN) sa = resample(a, MAX_LEN);
    if (m > MAX_LEN) sb = resample(b, MAX_LEN);

    const N = sa.length;
    const M = sb.length;

    // Use two rows instead of full matrix to save memory
    let prev = new Float64Array(M + 1);
    let curr = new Float64Array(M + 1);

    // Initialize
    prev.fill(Infinity);
    prev[0] = 0;

    for (let i = 1; i <= N; i++) {
        curr.fill(Infinity);
        for (let j = 1; j <= M; j++) {
            const cost = Math.abs(sa[i - 1] - sb[j - 1]);
            curr[j] =
                cost +
                Math.min(
                    prev[j],     // insertion
                    curr[j - 1], // deletion
                    prev[j - 1]  // match
                );
        }
        [prev, curr] = [curr, prev];
    }

    return prev[M];
}

// ─── Main Compare Function ─────────────────────────────

export function compareDatasets(
    magnitudesA: number[],
    magnitudesB: number[]
): CompareResult {
    if (magnitudesA.length === 0 || magnitudesB.length === 0) {
        return {
            cosineSimilarity: 0,
            dtwDistance: Infinity,
            normalizedDTW: 1,
            conclusion: 'Different',
        };
    }

    // 1. Smooth
    const smoothA = smooth(magnitudesA, 5);
    const smoothB = smooth(magnitudesB, 5);

    // 2. Z-score normalize
    const normA = zNormalize(smoothA);
    const normB = zNormalize(smoothB);

    // 3. Cosine similarity (resample to equal length)
    const targetLen = Math.min(normA.length, normB.length);
    const resA = resample(normA, targetLen);
    const resB = resample(normB, targetLen);
    const cosSim = cosineSimilarity(resA, resB);

    // 4. DTW distance (works with different lengths)
    const rawDtw = dtwDistance(normA, normB);

    // Normalize DTW: divide by path length (approx n+m)
    const pathLen = normA.length + normB.length;
    const normalizedDtw = pathLen > 0 ? rawDtw / pathLen : 0;

    // Clamp normalizedDTW to [0, 1] for display
    // Typical z-normalized DTW per step is ~0–2; use sigmoid-like mapping
    const dtwScore = Math.min(1, normalizedDtw / 2);

    // 5. Conclusion based on cosine similarity
    let conclusion: CompareResult['conclusion'];
    if (cosSim >= 0.85) {
        conclusion = 'Very Similar';
    } else if (cosSim >= 0.60) {
        conclusion = 'Similar';
    } else {
        conclusion = 'Different';
    }

    return {
        cosineSimilarity: cosSim,
        dtwDistance: rawDtw,
        normalizedDTW: dtwScore,
        conclusion,
    };
}
