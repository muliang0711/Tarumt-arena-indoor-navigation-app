# Flutter node-registry contract

The future Flutter app reads the complete `public.nodes` table directly from Supabase. It does not
read nodes from the API server and does not filter the catalog according to model training
fingerprints. The existing Android app has a different integration: it obtains the registry from
the API server and uses the LH coordinate frame.

## Client configuration

The application needs only:

- Supabase project URL.
- Supabase publishable key.

Never package a secret key, legacy service-role key, or database password in Flutter.

## Query contract

Select every row and order by `node_id`:

```text
table: public.nodes
select: node_id, building_id, floor_id, coordinates, node_type, name,
        enabled, positioning_enabled, metadata
order: node_id ascending
```

The database fields map to the application node contract as follows:

| Database | Application |
| --- | --- |
| `node_id` | `nodeId` |
| `building_id` | `buildingId` |
| `floor_id` | `floorId` |
| `coordinates` | `coordinates` |
| `node_type` | `type` |
| `positioning_enabled` | `positioningEnabled` |

The future Flutter app must use `coordinates.xy` for node placement. The API also uses
`coordinates.xy` for positioning and nearest-node calculations. The separate `coordinates.lh`
frame belongs to the existing Android app and should not be used by Flutter.

RLS permits both `anon` and authenticated users to select the full table. There is no
`get_active_nodes()` RPC and no active-model concept in the database.

Official references:

- [Supabase Flutter quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/flutter)
- [Understanding Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
