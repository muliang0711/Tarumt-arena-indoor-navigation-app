# Application Modules

## Purpose

This folder is reserved for product modules that are adjacent to, but not identical with, the main indoor-map flow. It gives the repo a place to grow without overloading `flows/` with every future capability.

At the moment the folder is mostly structural, which is useful architectural signal: the project anticipates more modules than the current demo implements.

## Contains

- `ar/`: placeholder for a future augmented-reality guidance module

## Entry Points

- no active runtime entry point yet

## Dependencies And Coupling

- future modules here will likely depend on `src/application/flows/`, `src/integration/`, and `src/shared/`
- keeping this folder separate prevents speculative AR concerns from leaking into the current navigation flow prematurely

## When To Read Deeper

Read deeper only when you are introducing a new top-level capability, such as AR guidance, that should not live inside the existing flow folder.
