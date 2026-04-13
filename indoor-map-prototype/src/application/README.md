# Application Layer

This layer coordinates the prototype flow.

Responsibilities:

- own page state such as `home`, `destination`, `confirm`, and `map`
- build navigation scenarios and route previews
- expose screen-ready actions to the presentation layer
- provide a stable place to attach future modules such as AR orchestration

Rules:

- this layer can call integration services
- this layer should not import raw asset files directly
- this layer should stay framework-light and focused on flow logic

Main folders:

- `flows/`: feature-specific controllers and route logic
- `modules/`: future product modules such as AR
