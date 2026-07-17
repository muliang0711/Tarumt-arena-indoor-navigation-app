# Architecture and security

## Data ownership

Supabase contains only `public.nodes`. It is the node-registry source of truth.

```text
Supabase public.nodes
    |-- Future Flutter app reads the complete registry directly
    `-- API reads the complete registry during startup
        `-- Existing Android app reads the registry from API /nodes

API server filesystem
    `-- bundle.pt is loaded once during startup
```

There are no database model versions, supported-node tables, positioning deployments, model
checksums, or Supabase Storage buckets.

The checked-in `knn-api-server/resources/node-registry.json` remains useful as bootstrap, bulk-edit,
export, and training input. It is not read by the production API runtime.

## Database schema

`public.nodes` contains:

- `node_id`
- `building_id`
- `floor_id`
- `coordinates`
- `node_type`
- `name`
- `enabled`
- `positioning_enabled`
- `metadata`

Each node contains both coordinate frames:

```json
{
  "lh": {"x": 55.756, "y": 33.909},
  "xy": {"x": 55.756, "y": 33.909}
}
```

- `coordinates.lh` is the coordinate frame used by the existing Android app.
- `coordinates.xy` is used by model estimates, geographic nearest-node selection, and the future
  Flutter app.

Both client applications read the same node rows, but they must select the appropriate nested
coordinate frame rather than treating `lh` and `xy` as interchangeable.

## Read security

Row Level Security is enabled. The `anon` and `authenticated` roles have read-only access to every
node because the future Flutter app must fetch the full registry. They cannot insert, update, or
delete rows.

The future Flutter app and the API server can therefore use the project URL and publishable key. A
publishable key is client-safe; access is constrained by table grants and RLS.

Registry administration uses a server-side Supabase secret key or the Dashboard. Never put a secret
key, legacy service-role key, or database password in a client application or source control.

## API startup behavior

At startup, the API server:

1. Fetches and validates all rows from `public.nodes`.
2. Loads the local `bundle.pt`.
3. Verifies that every model reference `location_id` exists in the database registry.
4. Replaces the bundle reference rows' stored coordinates, floor, and building with current database
   values.
5. Builds one in-memory WKNN Triplet positioner.

Additional database nodes are allowed even if the model has no training fingerprint for them. They
are still returned to clients and can be selected by `/findClosestNode` when geographically
closest to the inferred position.

The API does not query Supabase for each scan. Restart it after registry updates so it reloads the
source-of-truth data.

## Positioning behavior

- `/calcPosition` transforms the live Wi-Fi scan using the preprocessing state in `bundle.pt` and
  runs the WKNN Triplet model and reference database.
- `/findClosestNode` first performs the same inference, then finds the nearest database node by
  `coordinates.xy` within the inferred building and floor.
- Nearest-node eligibility is not limited to nodes represented in the model's training fingerprints.

The legacy `checkedNodeIds` request field remains accepted for compatibility but is ignored by the
WKNN Triplet runtime.
