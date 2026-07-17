# Database setup and migrations

## Working directory

Run every `npx supabase ...` command from the `fyp_backend` repository root:

```bash
cd /path/to/fyp_backend
git submodule update --init --recursive
test -f supabase/config.toml
```

Do not run `npx supabase init`; `config.toml` already exists.

Install the Python dependency for the registry administration script separately:

```bash
python -m pip install -r supabase/requirements.txt
```

## Validate locally

Start Docker or another compatible container runtime, then run:

```bash
npx supabase start
npx supabase db reset
npx supabase db lint --level error
npx supabase migration list --local
```

The migration set contains:

1. `202607170001_create_positioning_schema.sql`: creates the public-readable `nodes` table and RLS
   policy.
2. `202607170002_import_registry_v1.sql`: inserts the initial 13 nodes.

There are no model tables or Storage objects.

## Apply to the hosted project

Create the project in the Supabase Dashboard and copy its project reference, then run:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase migration list
npx supabase db push --linked --dry-run
npx supabase db push --linked
```

Verify in the SQL editor:

```sql
select *
from public.nodes
order by node_id;
```

The query should return 13 rows after the initial push.

Do not use `npx supabase db reset --linked` on the hosted project. It destroys remote user-created
objects before replaying migrations.

Official reference: [Supabase CLI local development workflow](https://supabase.com/docs/guides/local-development/cli-workflows).
