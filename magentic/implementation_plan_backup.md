# Magnetometer Data Collection App — Implementation Plan

A React Native (Expo SDK 54) app to record magnetometer data for two floors, compare them using cosine similarity and Dynamic Time Warping (DTW), and export the datasets.

## Target Directory

`c:\Code\project\New folder\magentic\magentic-app`

---

## Proposed Changes

### 1. Project Scaffold

#### [NEW] Project initialization

- Run `npx create-expo-app@latest ./ --template blank-typescript` inside `magentic-app`
- Ensure `expo` resolves to SDK 54 (`~54.0.0`)
- Install required packages:
  - `expo-sensors` — Magnetometer API
  - `expo-file-system` — persistent storage
  - `expo-sharing` — export/share JSON files

---

### 2. Data Models

#### [NEW] `src/types.ts`

Define TypeScript types:

```ts
interface Sample {
  timestamp: number;    // ms since epoch
  x: number;
  y: number;
  z: number;
  magnitude: number;   // sqrt(x²+y²+z²)
}

interface Dataset {
  datasetId: string;     // uuid
  label: 'Floor 1' | 'Floor 2';
  createdAt: string;     // ISO8601
  samples: Sample[];
  meta: {
    samplingHz: number;
    device: string;
    notes?: string;
  };
}

interface CompareResult {
  cosineSimilarity: number;   // 0–1
  dtwDistance: number;         // lower = more similar
  normalizedDTW: number;      // 0–1 normalized
  conclusion: 'Very Similar' | 'Similar' | 'Different';
}
```

---

### 3. Storage Service (expo-file-system)

#### [NEW] `src/storage.ts`

**Why `expo-file-system` over AsyncStorage:**
- AsyncStorage has a ~6 MB limit on Android and is slow for large JSON blobs
- Magnetometer data at 50 Hz for 60 seconds = 3,000 samples ≈ 300 KB per dataset — manageable, but it grows if users record longer sessions
- `expo-file-system` writes to `documentDirectory` which persists across app restarts and has no size limit
- It also makes export trivial — the file is already on disk

Functions:
- `saveDataset(dataset: Dataset): Promise<void>` — writes to `${documentDirectory}floor1.json` or `floor2.json`
- `loadDataset(label): Promise<Dataset | null>` — reads and parses
- `deleteDataset(label): Promise<void>` — removes file
- `datasetExists(label): Promise<boolean>` — check existence
- `getExportUri(label): Promise<string>` — returns file URI for sharing

---

### 4. Magnetometer Recording

#### [NEW] `src/useMagnetometer.ts`

A custom React hook:
- `Magnetometer.setUpdateInterval(ms)` based on configured Hz (default 50 Hz → 20ms)
- Subscribes on `startRecording()`, unsubscribes on `stopRecording()`
- Accumulates `Sample[]` in a `useRef` (not state, to avoid re-render overhead)
- Exposes: `isRecording`, `sampleCount`, `lastMagnitude`, `samples`, `startRecording()`, `stopRecording()`, `clearSamples()`

---

### 5. Comparison Algorithms

#### [NEW] `src/compare.ts`

Preprocessing pipeline:
1. **Smoothing** — Simple Moving Average (window = 5) on magnitude sequence
2. **Z-score normalization** — `(x - mean) / std` to remove device bias
3. **No resampling needed** — both DTW and cosine similarity handle different-length sequences; DTW naturally handles length differences, and for cosine similarity we'll resample to the shorter length using linear interpolation

Algorithms:
- **Cosine Similarity** — dot(A,B) / (‖A‖·‖B‖) after resampling to equal length → returns 0–1
- **DTW Distance** — O(n·m) dynamic programming with Euclidean cost on normalized magnitude; normalized by path length → returns a distance value
- **Conclusion** — Thresholds on cosine similarity:
  - ≥ 0.85 → "Very Similar"
  - ≥ 0.60 → "Similar"
  - < 0.60 → "Different"

---

### 6. Export/Share Service

#### [NEW] `src/export.ts`

- Uses `expo-file-system` to get the dataset file path
- Uses `Sharing.shareAsync(fileUri, { mimeType: 'application/json' })` to invoke the OS share sheet
- Works on both iOS (AirDrop, Files) and Android (WhatsApp, Drive, etc.)

---

### 7. Main UI — Single-Screen Layout

#### [NEW] `App.tsx` (rewrite)

**Layout (top to bottom):**

| Section | Content |
|---------|---------|
| **Header** | App title + current floor indicator |
| **Floor Selector** | Two-button segment: `Floor 1` / `Floor 2` |
| **Recording Panel** | Start/Stop/Save/Clear buttons, sample count, live magnitude |
| **Dataset Cards** | Two cards showing Floor 1 & Floor 2 status (exists?, sample count, duration) |
| **Compare Section** | Compare button → results card (similarity, DTW, conclusion) |
| **Export Section** | Export Floor 1 / Export Floor 2 buttons |

**Styling:**
- Dark theme with accent colors (blue for Floor 1, green for Floor 2)
- Status indicators (recording = red pulse, saved = green check)
- Card-based layout with shadows
- Clean typography using system fonts

---

### 8. ASCII Data Flow Diagram

Will be included directly in the App's documentation and in the walkthrough artifact.

```
┌──────────────────────────────────────────────────────────┐
│                    USER INTERACTION                       │
│  [Select Floor] → [Start] → [Stop] → [Save] → [Compare] │
└──────────┬───────────┬────────┬────────┬─────────┬───────┘
           │           │        │        │         │
           ▼           ▼        │        ▼         ▼
  ┌──────────────┐ ┌────────┐   │  ┌──────────┐ ┌──────────────┐
  │ Floor Select │ │Magneto.│   │  │ Storage  │ │  Compare     │
  │ State: F1/F2 │ │subscribe│  │  │ Service  │ │  Engine      │
  └──────┬───────┘ └───┬────┘   │  └────┬─────┘ └──────┬───────┘
         │             │        │       │               │
         │       ┌─────▼─────┐  │  ┌────▼─────┐  ┌─────▼────────┐
         │       │  Sample   │  │  │  Write   │  │ 1. Smooth    │
         │       │ Accumulate├──┘  │  JSON to │  │ 2. Z-score   │
         │       │ (useRef)  │     │  docDir  │  │ 3. CosSim    │
         │       └───────────┘     └────┬─────┘  │ 4. DTW       │
         │                              │        └──────┬────────┘
         │                         ┌────▼─────┐         │
         │                         │floor1.json│   ┌─────▼──────┐
         │                         │floor2.json│   │  Result:   │
         │                         └────┬─────┘   │  Sim / DTW │
         │                              │         │  Conclusion │
         │                         ┌────▼─────┐   └────────────┘
         │                         │  Export   │
         │                         │(Sharing) │
         │                         └──────────┘
```

---

## User Review Required

> [!IMPORTANT]
> **Storage choice**: Using `expo-file-system` (documentDirectory) instead of AsyncStorage. This is more reliable for potentially large datasets and makes export straightforward. Confirm this is acceptable.

> [!NOTE]
> **Sampling frequency default**: Will default to **50 Hz** (20ms interval). The indoor-nav-app already uses `expo-sensors` at similar rates on SDK 54 successfully.

---

## Verification Plan

### In-App Testing (Manual — Expo Go)

1. **Start the app**: `npx expo start` → scan QR with Expo Go
2. **Recording test**:
   - Select "Floor 1" → tap "Start Recording"
   - Verify sample count increases, live magnitude updates
   - Tap "Stop" → verify recording stops
   - Tap "Save" → verify success toast/message
3. **Persistence test**:
   - Close and reopen the app
   - Verify Floor 1 card shows saved dataset info (sample count, duration)
4. **Second dataset**:
   - Switch to "Floor 2" → record + save at a different location
5. **Compare test**:
   - Tap "Compare Floor 1 vs Floor 2"
   - Verify scores appear (similarity %, DTW distance, conclusion label)
   - Scores should NOT be exactly 0 or exactly 1
6. **Export test**:
   - Tap "Export Floor 1" → verify share sheet appears
   - On Android: share to Files; on iOS: share to Files app
7. **Edge case**:
   - Delete Floor 2 → tap Compare → verify it shows "please record both datasets first"
