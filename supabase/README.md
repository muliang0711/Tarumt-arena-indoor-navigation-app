# Shared Supabase project

This directory is owned by the overall `fyp_backend` system. It contains the database schema,
migrations, administration scripts, and client contracts shared by `android-app`,
`knn-api-server`, and the future Flutter app.

Supabase stores one thing for this system: the node registry in `public.nodes`. It is the runtime
source of truth. The API reads it at startup, the existing Android app receives it through the API,
and the future Flutter app will read it directly from Supabase.

The trained WKNN Triplet bundle is not stored in the database or Supabase Storage. It is deployed
as a local file with `knn-api-server`.

## Apply the initial database

Run all Supabase CLI commands from the `fyp_backend` repository root, which contains
`supabase/config.toml`:

```bash
cd /path/to/fyp_backend
git submodule update --init --recursive
test -f supabase/config.toml

npx supabase start
npx supabase db reset
npx supabase db lint --level error

npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push --linked --dry-run
npx supabase db push --linked
```

The two existing migrations create `public.nodes` and insert the current 13-node bootstrap
registry. They have intentionally been rewritten in place because they have not been applied yet.

After the first hosted push, do not edit an applied migration. Schema changes get new migrations;
ordinary node-data changes do not. Update node rows through the Table Editor or the synchronization
script described below.

## Registry administration environment

Install the dependency used by the registry synchronization script:

```bash
python -m pip install -r supabase/requirements.txt
```

Read-only comparison and download use `SUPABASE_URL` plus `SUPABASE_PUBLISHABLE_KEY`. Upload also
requires the backend-only `SUPABASE_SECRET_KEY`. See the registry-update guide for exact commands.

The API server has its own runtime environment and model bundle. From `knn-api-server`, its existing
helper can still be loaded with:

```bash
cd knn-api-server
source export-env.sh
```

See the API server's operations and model-deployment documentation for runtime details.

## Documentation

- [Architecture and security](docs/01_architecture_and_security.md)
- [Database setup and migrations](docs/02_database_setup_and_migrations.md)
- [Changing the schema](docs/03_schema_changes.md)
- [Updating or exporting the registry](docs/04_node_registry_updates.md)
- [Flutter node-registry contract](docs/06_flutter_node_registry.md)
- API model deployment: `knn-api-server/documentation/06_model_deployment.md`
