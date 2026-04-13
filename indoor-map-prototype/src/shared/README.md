# Shared Support

This folder contains cross-layer support code that is reused by more than one layer.

Current contents:

- `types.ts`: shared TypeScript contracts
- `theme/`: design tokens used by presentation components

This is not a business layer by itself. It exists to prevent duplicated contracts and styling primitives across the real layers.
