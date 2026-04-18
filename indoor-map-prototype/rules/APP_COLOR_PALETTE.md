# App Color Palette

This file defines the approved application color palette and its intended usage.

## Source Of Truth

- use this palette as the visual baseline for new UI work
- if existing tokens or screens differ from this file, treat this file as the rule and align implementation to it in follow-up changes
- keep the overall look soft, clean, and low-saturation

## Palette List

| Token | Hex | Usage |
| --- | --- | --- |
| Primary Blue | `#2F6BFF` | main buttons, underlines, highlighted action areas |
| Soft Blue | `#5C8DFF` | secondary highlights, icon backgrounds, status accents |
| Light Blue Background | `#EAF2FF` | light card backgrounds, information section fills |
| Card Surface | `#F4F7FC` | primary card surfaces with a soft clean feel |
| Page Background | `#F8FAFD` | overall page background; near white but not pure white |
| Primary Text / Dark Navy | `#0F172A` | titles and emphasis text |
| Secondary Text / Muted Gray | `#64748B` | supporting copy and secondary information |
| Divider / Border | `#D9E2F2` | separators and light borders |
| Success Green | `#22C55E` | connected, active, high-confidence, and strong-success states |
| Accent Purple | `#A855F7` | indoor status, feature icons, and small emphasis accents |
| Soft Purple Background | `#F1EAFE` | indoor cards and pale purple icon backgrounds |

## Pairing Rules

- overall base: light blue + white-gray surfaces + dark navy text
- functional emphasis: use blue, especially `Primary Blue`
- success state: use green only for clear positive state feedback
- indoor and positioning accents: use purple in small controlled areas
- avoid high saturation and avoid too many competing accent colors in the same view

## Visual Tone

- prefer soft contrast over harsh contrast
- do not use pure white as the dominant background when `Page Background` or `Card Surface` fits
- keep accent colors purposeful rather than decorative noise
- favor calm, glassy, modern blue-led compositions over loud multi-color palettes

## Implementation Notes

- theme tokens should map back to this palette rather than inventing near-duplicate blues and grays
- when a new semantic color is needed, add the semantic token only after deciding which palette color it should derive from
- use opacity variants carefully; preserve the original hue identity of the palette
