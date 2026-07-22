begin;

create table public.nodes (
    node_id text primary key check (length(btrim(node_id)) > 0),
    building_id text not null default 'default'
        check (length(btrim(building_id)) > 0),
    floor_id text not null check (length(btrim(floor_id)) > 0),
    coordinates jsonb not null check (
        jsonb_typeof(coordinates) = 'object'
        and coordinates ? 'lh'
        and coordinates ? 'xy'
        and jsonb_typeof(coordinates -> 'lh') = 'object'
        and jsonb_typeof(coordinates -> 'xy') = 'object'
        and (coordinates -> 'lh') ? 'x'
        and (coordinates -> 'lh') ? 'y'
        and (coordinates -> 'xy') ? 'x'
        and (coordinates -> 'xy') ? 'y'
        and jsonb_typeof(coordinates -> 'lh' -> 'x') = 'number'
        and jsonb_typeof(coordinates -> 'lh' -> 'y') = 'number'
        and jsonb_typeof(coordinates -> 'xy' -> 'x') = 'number'
        and jsonb_typeof(coordinates -> 'xy' -> 'y') = 'number'
    ),
    node_type text not null
        check (node_type in ('ELEVATOR', 'DESTINATION', 'JUNCTION')),
    name text,
    enabled boolean not null default true,
    positioning_enabled boolean not null default true,
    metadata jsonb not null default '{}'::jsonb
        check (jsonb_typeof(metadata) = 'object')
);

alter table public.nodes enable row level security;

revoke all on table public.nodes from anon, authenticated;
grant select on table public.nodes to anon, authenticated;
grant select, insert, update, delete on table public.nodes to service_role;

create policy "Node registry is publicly readable"
on public.nodes
for select
to anon, authenticated
using (true);

comment on table public.nodes is
    'The shared node registry and runtime source of truth for system clients.';
comment on column public.nodes.coordinates is
    'Nested frames: LH is used by Android and positioning; XY is used by the future Flutter app.';

commit;
