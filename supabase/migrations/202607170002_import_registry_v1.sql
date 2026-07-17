-- Bootstrap data for a new Supabase project. Later registry edits are ordinary data changes.
begin;

insert into public.nodes (
    node_id,
    building_id,
    floor_id,
    coordinates,
    node_type,
    name,
    enabled,
    positioning_enabled,
    metadata
) values
    ('node-1', 'default', 'floor-2', '{"lh":{"x":55.756,"y":33.909},"xy":{"x":55.756,"y":33.909}}'::jsonb, 'ELEVATOR', 'West Elevator', true, true, '{}'::jsonb),
    ('node-15', 'default', 'floor-2', '{"lh":{"x":45.361,"y":53.354},"xy":{"x":45.361,"y":53.354}}'::jsonb, 'DESTINATION', 'TA/244 door', true, true, '{}'::jsonb),
    ('node-14', 'default', 'floor-2', '{"lh":{"x":37.419,"y":53.354},"xy":{"x":37.419,"y":53.354}}'::jsonb, 'DESTINATION', 'TA/245 door', true, true, '{}'::jsonb),
    ('node-13', 'default', 'floor-2', '{"lh":{"x":32.572,"y":53.354},"xy":{"x":32.572,"y":53.354}}'::jsonb, 'DESTINATION', 'TA/246 door', true, true, '{}'::jsonb),
    ('node-17', 'default', 'floor-2', '{"lh":{"x":22.469,"y":35.544},"xy":{"x":22.469,"y":35.544}}'::jsonb, 'DESTINATION', 'TA/254 door', true, true, '{}'::jsonb),
    ('node-18', 'default', 'floor-2', '{"lh":{"x":30.762,"y":35.544},"xy":{"x":30.762,"y":35.544}}'::jsonb, 'DESTINATION', 'TA/255 door', true, true, '{}'::jsonb),
    ('node-19', 'default', 'floor-2', '{"lh":{"x":39.054,"y":35.544},"xy":{"x":39.054,"y":35.544}}'::jsonb, 'DESTINATION', 'TA/256 door', true, true, '{}'::jsonb),
    ('node-20', 'default', 'floor-2', '{"lh":{"x":47.347,"y":35.544},"xy":{"x":47.347,"y":35.544}}'::jsonb, 'DESTINATION', 'TA/257 door', true, true, '{}'::jsonb),
    ('center-of-road-north-of-elevwest', 'default', 'floor-2', '{"lh":{"x":55.814,"y":44.887},"xy":{"x":55.814,"y":44.887}}'::jsonb, 'JUNCTION', 'Center of road north of West Elevator', true, true, '{}'::jsonb),
    ('node-2', 'default', 'floor-2', '{"lh":{"x":55.814,"y":52.186},"xy":{"x":55.814,"y":52.186}}'::jsonb, 'JUNCTION', 'East end of corridor along TA/244-246', true, true, '{}'::jsonb),
    ('node-12', 'default', 'floor-2', '{"lh":{"x":16.396,"y":52.186},"xy":{"x":16.396,"y":52.186}}'::jsonb, 'JUNCTION', 'West end of corridor along TA/244-246', true, true, '{}'::jsonb),
    ('node-16', 'default', 'floor-2', '{"lh":{"x":16.396,"y":36.945},"xy":{"x":16.396,"y":36.945}}'::jsonb, 'JUNCTION', 'West end of corridor along TA/254-257', true, true, '{}'::jsonb),
    ('west-of-TA246door-opp-TA254', 'default', 'floor-2', '{"lh":{"x":22.586,"y":53.354},"xy":{"x":22.586,"y":53.354}}'::jsonb, 'JUNCTION', 'Slightly west of TA/246 door, opposite TA/254 door', true, true, '{}'::jsonb);

do $migration$
begin
    if (select count(*) from public.nodes) <> 13 then
        raise exception 'Expected 13 bootstrap node rows';
    end if;
end;
$migration$;

commit;
