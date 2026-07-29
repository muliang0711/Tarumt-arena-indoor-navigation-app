# Migration parity fixtures

`input.json` contains deterministic TypeScript PDR inputs. Every clock value,
timestamp, configuration override, and sample series is fixed. Uniform sample
series are expanded deterministically by index.

`golden.json` is the canonical output of the current TypeScript implementation.
It includes complete PDR results and the route metrics derived from the current
map assets. The approved route distance is 46m.

Run `npm --prefix expo-app run parity:print-golden` from the repository root to print a candidate
golden document after an intentional TypeScript behavior change. Do not replace
the checked-in golden merely to make a test pass; first explain and approve the
behavior change.

JSON cannot encode non-finite numbers. Fixtures use the tagged strings `NaN`,
`Infinity`, and `-Infinity`. Parity comparison must preserve the same numeric
classification.

Runtime raw sensor recording remains disabled. These fixtures are synthetic and
must not be populated by adding a raw-sensor persistence path to the app.

No particle filter or random-number behavior exists in the current source tree,
so no random seed fixture is applicable. If a random algorithm is added later,
its seed and generator contract must be included here before migration.
