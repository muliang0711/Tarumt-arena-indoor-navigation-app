# Canonical map graph contracts

`main-campus/map-graph-bundle.v1.json` is the canonical semantic graph shared
by Flutter and the Presence Gateway. UI labels, room metadata, images, and
Tiled rendering data deliberately remain outside this contract.

`map_revision` is `sha256:` followed by the SHA-256 digest of the bundle after:

1. removing the top-level `map_revision` member;
2. recursively sorting object keys by Unicode code point;
3. encoding arrays in their declared order and JSON without whitespace; and
4. encoding the result as UTF-8.

Array order is therefore meaningful. A graph change must create a new revision;
old revisions remain loadable while active journeys still reference them.

The current bundle contains only `floor-2`, but both the contract and runtime
registry support multiple floors and multiple revisions.

## Published map bundle

`v1/map-bundle-manifest.schema.json` defines the complete downloadable resource
set for one immutable `bundle_revision`. Unlike `map_revision`, which changes
only when the canonical navigation topology changes, `bundle_revision` changes
whenever any downloadable asset or its metadata changes.

`bundle_revision` uses the same canonical JSON rules as `map_revision`: remove
the top-level `bundle_revision`, recursively sort object keys, keep array order,
encode compact UTF-8 JSON, then prefix the SHA-256 digest with `sha256:`. Every
asset also carries its own SHA-256 digest and byte size so a downloader can
verify individual cached files.

`main-campus/map-bundle.source.json` is publisher input. The publisher validates
the canonical graph revision and these cross-file references before making a
revision current:

- room nodes exist on the declared canonical floor;
- local EDGE endpoints exist in the local node catalog;
- WiFi server/local node mappings resolve on the declared floor; and
- the PNG dimensions equal the visible TMJ tile-chunk surface.

From `services/presence-gateway`, run:

```sh
make publish-main-campus-map
```

This writes immutable resources below
`map-data/main-campus/revisions/<bundle_revision>/` and atomically replaces
`map-data/main-campus/current.json`. Re-publishing identical input reuses the
same revision only after checking the existing files for corruption.
