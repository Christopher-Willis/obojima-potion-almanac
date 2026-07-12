# Obojima Potion Almanac

Private GM tools for Obojima: Tales from the Tall Grass potion brewing.

## Usage

Open the tool in a browser by serving the files locally:

```bash
python -m http.server 8080
```

Then visit `http://localhost:8080`.

### Tool 1: Find Potion from Ingredients

Select three or more ingredients from the rarity columns and click **Find Recipes** to see which potions can be brewed. Results are grouped by potion type (combat, utility, whimsy).

### Tool 2: Find Recipes for a Potion

Select any potion from the list to see every possible 3-ingredient combination that can create it. Recipes are sorted by overall rarity (common ingredients first).

## Data

- `ingredients.json` — ingredient stats, rarity, and regions.
- `potions.json` — potion list with descriptions.
- `potion_formulas.json` — every 3-ingredient recipe for each potion.
- `potion_formulas_by_region.json` — region-specific recipe lookup.
