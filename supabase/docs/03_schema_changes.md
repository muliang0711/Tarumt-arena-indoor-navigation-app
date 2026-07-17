# Changing the database schema

Use migrations only for structural changes such as adding a column, changing a constraint, or
changing RLS. Normal node-coordinate and metadata edits are data changes and do not need a
migration.

After the initial migrations have been applied anywhere, never rewrite them. Create a new one from
the `fyp_backend` repository root:

```bash
npx supabase migration new short_description
```

Edit the generated SQL, then validate it:

```bash
npx supabase start
npx supabase db reset
npx supabase db lint --level error
python -m unittest discover -s supabase/scripts/tests -v
```

Preview and push the forward migration:

```bash
npx supabase migration list
npx supabase db push --linked --dry-run
npx supabase db push --linked
```

If a schema change alters node fields, update together:

- `knn-api-server/models/node.py`
- `knn-api-server/services/node_registry_loader.py`
- `knn-api-server/services/supabase_node_registry.py`
- the existing Android app's node parser
- Flutter's database row parser
- migration/script tests and documentation
