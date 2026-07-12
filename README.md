# Obojima Potion Almanac

A static JavaScript GM tool for Obojima: Tales from the Tall Grass potion brewing.

## Deploy

This is a pure static site, so it can be hosted on any static host (Vercel, GitHub Pages, Netlify, etc.).

### Vercel

Import the GitHub repo in Vercel and deploy. `vercel.json` already tells Vercel to serve the files directly with no build step.

### GitHub Pages

Enable GitHub Pages in the repo settings and point it to the `main` branch root.

## Local development

No Python needed. Use any static file server, for example:

```bash
npm run dev
# or
npx serve -l 8080 .
```

Then visit `http://localhost:8080`.

## Data files

- `ingredients.json` — ingredient stats, rarity, and regions.
- `potions.json` — potion list with descriptions.
- `potion_formulas.json` — every 3-ingredient recipe for each potion.
- `potion_formulas_by_region.json` — region-specific recipe lookup.
