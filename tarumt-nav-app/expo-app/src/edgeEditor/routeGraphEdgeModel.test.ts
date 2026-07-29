import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  createRouteGraphEdge,
  parseEdgeFieldValue,
  stringifyRouteGraphEdgeDocument,
} from './routeGraphEdgeModel';

describe('routeGraphEdgeModel', () => {
  it('creates an export edge with required and custom fields', () => {
    assert.deepEqual(
      createRouteGraphEdge({
        distance: 12.345,
        fields: [
          { key: 'floor', value: '2' },
          { key: 'accessible', value: 'true' },
          { key: 'distance', value: '999' },
          { key: '', value: 'ignored' },
        ],
        from: 'node-1',
        id: 'edge-1',
        to: 'node-2',
      }),
      {
        accessible: true,
        distance: 12.35,
        floor: 2,
        from: 'node-1',
        id: 'edge-1',
        to: 'node-2',
      },
    );
  });

  it('parses field values into useful JSON scalars', () => {
    assert.equal(parseEdgeFieldValue('42'), 42);
    assert.equal(parseEdgeFieldValue('false'), false);
    assert.equal(parseEdgeFieldValue('TA257'), 'TA257');
    assert.equal(parseEdgeFieldValue(''), '');
  });

  it('serializes a stable edge document', () => {
    assert.equal(
      stringifyRouteGraphEdgeDocument(
        [{ distance: 10, from: 'node-1', id: 'edge-1', to: 'node-2' }],
        'demo_1.tmj',
      ),
      '{\n' +
        '  "edges": [\n' +
        '    {\n' +
        '      "distance": 10,\n' +
        '      "from": "node-1",\n' +
        '      "id": "edge-1",\n' +
        '      "to": "node-2"\n' +
        '    }\n' +
        '  ],\n' +
        '  "kind": "route-graph-edges",\n' +
        '  "sourceMap": "demo_1.tmj",\n' +
        '  "version": 1\n' +
        '}\n',
    );
  });
});
