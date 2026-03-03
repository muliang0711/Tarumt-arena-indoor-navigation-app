import { File, Paths } from 'expo-file-system';
import { Dataset, FloorLabel, DatasetSummary } from './types';

// ─── File Helpers ────────────────────────────────────────

function fileFor(label: FloorLabel): File {
    const name = label === 'Floor 1' ? 'floor1.json' : 'floor2.json';
    return new File(Paths.document, name);
}

// ─── Save ────────────────────────────────────────────────

export async function saveDataset(dataset: Dataset): Promise<void> {
    const file = fileFor(dataset.label);
    const json = JSON.stringify(dataset);
    file.write(json);
}

// ─── Load ────────────────────────────────────────────────

export async function loadDataset(label: FloorLabel): Promise<Dataset | null> {
    const file = fileFor(label);
    if (!file.exists) return null;
    const json = await file.text();
    return JSON.parse(json) as Dataset;
}

// ─── Delete ──────────────────────────────────────────────

export async function deleteDataset(label: FloorLabel): Promise<void> {
    const file = fileFor(label);
    if (file.exists) {
        file.delete();
    }
}

// ─── Existence check ─────────────────────────────────────

export function datasetExists(label: FloorLabel): boolean {
    return fileFor(label).exists;
}

// ─── Summary (for UI cards) ──────────────────────────────

export async function getDatasetSummary(label: FloorLabel): Promise<DatasetSummary> {
    const ds = await loadDataset(label);
    if (!ds || ds.samples.length === 0) {
        return { exists: false, sampleCount: 0, durationMs: 0, createdAt: null };
    }
    const first = ds.samples[0].timestamp;
    const last = ds.samples[ds.samples.length - 1].timestamp;
    return {
        exists: true,
        sampleCount: ds.samples.length,
        durationMs: last - first,
        createdAt: ds.createdAt,
    };
}

// ─── Export URI ──────────────────────────────────────────

export function getExportUri(label: FloorLabel): string {
    return fileFor(label).uri;
}
