# TB Citadel Attack Planner (Client-side)

A pure client-side calculator inspired by the TB Citadel planner. It estimates a troop assignment to hit Citadel level 25, level 30, or a custom target while minimizing expected losses.

## What's improved

- Fresh, cleaner UX with a guided 3-step flow.
- Quick target buttons for Citadel 25 / 30 / custom.
- Results dashboard with clear status, summary metrics, and assignment table.
- Browser-only scenario management: save, load, duplicate, delete.
- Import/export scenarios as JSON.

## Calculation model

- Required attack is adjusted using safety buffer and attack bonus:
  - `required = targetPower * (1 + safetyBuffer%) / (1 + attackBonus%)`
- Troops are ranked by expected loss-per-attack (`lossRate / attack`).
- A greedy assignment picks the lowest expected-loss options first.

## Run locally

Open `index.html` directly in a browser.

## Deploy on GitHub Pages

This repo includes `.github/workflows/deploy-pages.yml` for automatic GitHub Pages deployment (with Pages auto-enable in workflow).

1. Push this repository to GitHub.
2. In repository **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Push to `main`, `master`, or `work` to trigger deployment.
4. Your site will be available at:
   - `https://<your-github-username>.github.io/<repo-name>/`
