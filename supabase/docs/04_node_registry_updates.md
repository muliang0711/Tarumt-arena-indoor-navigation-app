# Updating or exporting the node registry

Node data can be edited directly in the Supabase Table Editor. A normal edit does not need a SQL
migration. Restart the API server afterward so it reloads the registry.

For reviewable bulk changes, use `supabase/scripts/sync_node_registry.py` from the `fyp_backend`
repository root. Its default local file is
`knn-api-server/resources/node-registry.json`.

Install the script dependency once in the Python environment used for administration:

```bash
python -m pip install -r supabase/requirements.txt
```

## Environment

Read-only comparison and download require:

```bash
export SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
export SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

Uploading also requires a backend-only key:

```bash
export SUPABASE_SECRET_KEY=sb_secret_YOUR_KEY
```

The legacy `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` names are accepted as fallbacks.

## Compare local JSON with the database

```bash
python supabase/scripts/sync_node_registry.py diff
```

The command reports nodes that would be added, changed, or exist only in the database.

## Upload local JSON

Preview first:

```bash
python supabase/scripts/sync_node_registry.py upload
```

Apply upserts:

```bash
python supabase/scripts/sync_node_registry.py upload --apply
```

The default upload never deletes database rows. To make the database IDs exactly match the local
file, explicitly request deletion of database-only nodes:

```bash
python supabase/scripts/sync_node_registry.py upload --apply --delete-missing
```

Review the diff carefully before using `--delete-missing`.

## Export the database source of truth

Print the database registry as canonical node JSON:

```bash
python supabase/scripts/sync_node_registry.py download
```

Overwrite `knn-api-server/resources/node-registry.json` with it:

```bash
python supabase/scripts/sync_node_registry.py download --apply
```

Run a download before training so the WKNN Triplet configuration uses the current database
geometry.

## Coordinate changes and the model

- `coordinates.lh` changes affect placement in the existing Android app only.
- `coordinates.xy` changes affect node placement in the future Flutter app and take effect in API
  inference after restart. At startup the API replaces each bundle reference's stored geometry with
  current database values.
- Small calibration corrections can therefore be made without rebuilding the bundle.
- Meaningful `xy`, floor, or building changes can invalidate the spatial assumptions used during
  triplet training. Export the registry, retrain, and reevaluate after such changes.
- Renaming or removing a node referenced by the bundle prevents API startup until a compatible
  bundle is deployed. Adding new database nodes is allowed.
