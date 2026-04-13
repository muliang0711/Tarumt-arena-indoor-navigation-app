# Integration Layer

This layer is the boundary to external or low-level data sources.

Responsibilities:

- load map packages and sprite registries
- parse raw map data into application-ready floor models
- provide adapter-style entry points for future backend, sensors, or storage

Rules:

- keep file loading and parsing here
- expose stable functions to the application layer
- avoid mixing UI decisions into this layer

Current focus:

- static prototype map loading from local assets

Future expansion:

- backend API client
- Supabase data adapter
- AR sensor and anchor adapters
