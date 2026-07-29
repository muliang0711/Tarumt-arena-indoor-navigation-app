import input from '../../flutter_app/test/fixtures/parity/input.json';
import {
  createParityBaseline,
  type ParityInputDocument,
} from '../src/parity/parityBaselineModel';

const baseline = createParityBaseline(
  input as unknown as ParityInputDocument,
);

process.stdout.write(`${JSON.stringify(baseline, null, 2)}\n`);
