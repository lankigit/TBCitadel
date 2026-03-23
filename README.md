# Citadel Calculator (Client-side)

A browser-only Citadel calculator inspired by the original GM-style layout.

## What this version now mirrors

- Left **Setup** panel (language, M8/M9 availability, citadel level, custom target power).
- Multi-card battle flow for:
  - Wall Killer
  - 1st / 2nd / 3rd Striker
  - Cleanup 1 through Cleanup 6
- Per-card troop selection and bonus inputs, with computed:
  - effective bonus
  - required troops
  - first strike losses (where applicable)
- Local save/load/delete of calculations in `localStorage`.

## Deploy

GitHub Pages workflow is included at `.github/workflows/deploy-pages.yml`.
