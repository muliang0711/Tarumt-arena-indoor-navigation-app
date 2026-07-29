import demoEdges from '../../assets/maps/demo_1.edges.json';
import demoMap from '../../assets/maps/demo_1.tmj.json';
import {
  createRouteMetricModel,
  type RouteGraphEdgeDocument,
} from '../edgeEditor';
import { runPdrPipeline } from '../pdr';
import type {
  MotionInputSample,
  MotionVector,
  PdrPipelineConfig,
  PdrPipelineState,
} from '../pdr';
import { createPngMapModel } from '../tiled/model';
import type { TiledMap } from '../tiled/type';

type SpecialNumber = 'Infinity' | '-Infinity' | 'NaN';
type EncodedNumber = number | SpecialNumber;

type EncodedMotionVector = {
  x: EncodedNumber;
  y: EncodedNumber;
  z: EncodedNumber;
};

type EncodedMotionSample = {
  acceleration: EncodedMotionVector;
  headingDegrees: EncodedNumber;
  timestampMs: number;
};

type ExplicitSampleSeries = {
  type: 'explicit';
  values: EncodedMotionSample[];
};

type UniformSampleSeries = {
  acceleration: EncodedMotionVector;
  count: number;
  headingDegrees: EncodedNumber;
  intervalMs: number;
  overrides?: Array<{
    acceleration?: EncodedMotionVector;
    headingDegrees?: EncodedNumber;
    index: number;
  }>;
  startTimestampMs: number;
  type: 'uniform';
};

type PdrParityCase = {
  config?: Partial<PdrPipelineConfig>;
  description: string;
  desiredHeadingDegrees: number;
  id: string;
  nowMs: number;
  pixelsPerMeter?: number;
  previousState: PdrPipelineState;
  samples: ExplicitSampleSeries | UniformSampleSeries;
};

export type ParityInputDocument = {
  approvedDivergences: Array<{
    id: string;
    legacyBehavior: string;
    parityExempt: boolean;
    targetBehavior: string;
  }>;
  pdrCases: PdrParityCase[];
  schemaVersion: number;
  tolerances: {
    absolute: number;
    exactFields: string[];
    relative: number;
    specialNumbers: string;
  };
};

export function createParityBaseline(input: ParityInputDocument) {
  const mapModel = createPngMapModel(demoMap as TiledMap);
  const routeMetrics = createRouteMetricModel(
    mapModel.routePath,
    (demoEdges as RouteGraphEdgeDocument).edges,
  );
  const baseline = {
    approvedDivergences: input.approvedDivergences,
    pdr: input.pdrCases.map((parityCase) => ({
      description: parityCase.description,
      id: parityCase.id,
      result: runPdrPipeline({
        config: parityCase.config,
        desiredHeadingDegrees: parityCase.desiredHeadingDegrees,
        nowMs: parityCase.nowMs,
        pixelsPerMeter: parityCase.pixelsPerMeter,
        previousState: parityCase.previousState,
        samples: expandSamples(parityCase.samples),
      }),
    })),
    routeMetrics,
    schemaVersion: input.schemaVersion,
    tolerances: input.tolerances,
  };

  return canonicalizeForJson(baseline);
}

function expandSamples(
  series: ExplicitSampleSeries | UniformSampleSeries,
): MotionInputSample[] {
  if (series.type === 'explicit') {
    return series.values.map(decodeMotionSample);
  }

  const overrides = new Map(
    (series.overrides ?? []).map((override) => [override.index, override]),
  );

  return Array.from({ length: series.count }, (_, index) => {
    const override = overrides.get(index);
    return {
      acceleration: decodeMotionVector(
        override?.acceleration ?? series.acceleration,
      ),
      headingDegrees: decodeNumber(
        override?.headingDegrees ?? series.headingDegrees,
      ),
      timestampMs: series.startTimestampMs + index * series.intervalMs,
    };
  });
}

function decodeMotionSample(sample: EncodedMotionSample): MotionInputSample {
  return {
    acceleration: decodeMotionVector(sample.acceleration),
    headingDegrees: decodeNumber(sample.headingDegrees),
    timestampMs: sample.timestampMs,
  };
}

function decodeMotionVector(vector: EncodedMotionVector): MotionVector {
  return {
    x: decodeNumber(vector.x),
    y: decodeNumber(vector.y),
    z: decodeNumber(vector.z),
  };
}

function decodeNumber(value: EncodedNumber) {
  switch (value) {
    case 'Infinity':
      return Number.POSITIVE_INFINITY;
    case '-Infinity':
      return Number.NEGATIVE_INFINITY;
    case 'NaN':
      return Number.NaN;
    default:
      return value;
  }
}

function canonicalizeForJson(value: unknown): unknown {
  return JSON.parse(JSON.stringify(encodeSpecialNumbers(value))) as unknown;
}

function encodeSpecialNumbers(value: unknown): unknown {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    if (Number.isNaN(value)) {
      return 'NaN';
    }
    return value > 0 ? 'Infinity' : '-Infinity';
  }

  if (Array.isArray(value)) {
    return value.map(encodeSpecialNumbers);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        encodeSpecialNumbers(nestedValue),
      ]),
    );
  }

  return value;
}
