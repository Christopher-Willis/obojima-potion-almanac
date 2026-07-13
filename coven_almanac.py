#!/usr/bin/env python3
"""Generate curated coven almanacs by greedily covering potions with few ingredients.

Modes:
  strict      - all three ingredients must come from the coven's territory
  predominant - at least two of the three ingredients must come from the coven's territory

Output:
  coven_almanacs.json  - full curated data, recipes, and coverage curves
  coven_almanacs_summary.md - readable summary table
"""

import json
from collections import defaultdict

REGION_ORDER = [
    "BRACKWATER WETLANDS",
    "COASTAL HIGHLANDS",
    "GALE FIELDS",
    "GIFT OF SHURITASHI",
    "LAND OF HOT WATER",
    "MOUNT ARBORA",
    "SHALLOWS",
]
REGION_BIT = {name: 1 << i for i, name in enumerate(REGION_ORDER)}
# The complete set uses a single-region tie-break to get the smallest 100% coverage set.
# Mount Arbora produced a 20-ingredient set with the most balanced per-coven overlap.
COMPLETE_REGION_MASK = REGION_BIT["MOUNT ARBORA"]

COVENS = [
    ("The Crowsworn", ["BRACKWATER WETLANDS"]),
    ("League of the Gilded Gourd", ["COASTAL HIGHLANDS"]),
    ("Fish Head Coven", ["GALE FIELDS", "SHALLOWS"]),
    ("The Tall Hats", ["GIFT OF SHURITASHI"]),
    ("Patchwork Robe Coven", ["LAND OF HOT WATER"]),
    ("Cloud Cap Coven", ["MOUNT ARBORA"]),
]

RARITY_ORDER = {"common": 0, "uncommon": 1, "rare": 2}
TYPE_ORDER = {"combat": 0, "utility": 1, "whimsy": 2}


def load_data(repo_dir="/home/ubuntu/repos/obojima-potion-almanac"):
    with open(f"{repo_dir}/ingredients.json") as f:
        ingredients = json.load(f)
    with open(f"{repo_dir}/potion_formulas.json") as f:
        potion_formulas = json.load(f)
    with open(f"{repo_dir}/potions.json") as f:
        potions = json.load(f)

    ingredient_info = {}
    for ing in ingredients:
        mask = 0
        for r in ing.get("regions", []):
            mask |= REGION_BIT.get(r, 0)
        info = dict(ing)
        info["region_mask"] = mask
        info["rarity_score"] = RARITY_ORDER.get(info.get("rarity", "").lower(), 3)
        ingredient_info[info["name"]] = info

    all_formulas = []
    for pot_name, pdata in potion_formulas.items():
        for f in pdata["formulas"]:
            all_formulas.append(
                {
                    "potion": pot_name,
                    "type": pdata["type"],
                    "number": pdata["number"],
                    "ingredients": tuple(f["ingredients"]),
                }
            )

    potions_info = {p["name"]: p for p in potions}

    return ingredient_info, all_formulas, potions_info


def region_count(ingredients, coven_mask, ingredient_info):
    return sum(
        1 for ing in ingredients if ingredient_info[ing]["region_mask"] & coven_mask
    )


def set_cover(relevant_formulas, candidates, ingredient_info, region_mask=0, prefer_region=True):
    """Greedy set cover for a hypergraph where a potion is covered when one of its
    relevant formulas is fully contained in the selected ingredient set.
    """
    candidates = set(candidates)
    formula_by_candidate = {c: [] for c in candidates}
    for idx, f in enumerate(relevant_formulas):
        for ing in f["ingredients"]:
            formula_by_candidate[ing].append(idx)

    # Precomputed static tie-breakers
    static_key = {}
    for c in candidates:
        if prefer_region:
            in_region = bool(ingredient_info[c]["region_mask"] & region_mask)
            static_key[c] = (
                -int(in_region),
                -len(formula_by_candidate[c]),
                ingredient_info[c]["rarity_score"],
                c,
            )
        else:
            static_key[c] = (
                -len(formula_by_candidate[c]),
                ingredient_info[c]["rarity_score"],
                c,
            )

    count = [0] * len(relevant_formulas)
    covered = set()
    selected = []
    selected_set = set()
    universe = {f["potion"] for f in relevant_formulas}
    coverage_curve = []

    def score(c):
        gain = 0
        secondary = 0
        for fidx in formula_by_candidate[c]:
            f = relevant_formulas[fidx]
            if f["potion"] in covered:
                continue
            if count[fidx] == 2:
                gain += 1
            elif count[fidx] == 1:
                secondary += 1
        return (-gain, -secondary) + static_key[c]

    while selected_set != candidates and len(covered) < len(universe):
        remaining = candidates - selected_set
        best = min(remaining, key=score)

        selected.append(best)
        selected_set.add(best)
        for fidx in formula_by_candidate[best]:
            count[fidx] += 1
            if count[fidx] == 3:
                covered.add(relevant_formulas[fidx]["potion"])

        coverage_curve.append((len(selected), len(covered)))

    return selected, covered, coverage_curve


def choose_recipes(selected, relevant_formulas, ingredient_info, coven_mask):
    selected_set = set(selected)
    recipe_map = {}

    def recipe_key(f):
        rc = region_count(f["ingredients"], coven_mask, ingredient_info)
        rarity_sum = sum(ingredient_info[ing]["rarity_score"] for ing in f["ingredients"])
        return (rc, -rarity_sum, f["ingredients"])

    for f in relevant_formulas:
        if all(ing in selected_set for ing in f["ingredients"]):
            potion = f["potion"]
            if potion not in recipe_map:
                recipe_map[potion] = f
            else:
                if recipe_key(f) > recipe_key(recipe_map[potion]):
                    recipe_map[potion] = f
    return recipe_map


def build_almanac(coven, regions, mode, ingredient_info, all_formulas, potions_info):
    coven_mask = sum(REGION_BIT[r] for r in regions)
    relevant = []
    candidates = set()
    if mode == "complete":
        for f in all_formulas:
            fcopy = dict(f)
            fcopy["region_count"] = region_count(f["ingredients"], coven_mask, ingredient_info)
            relevant.append(fcopy)
            candidates.update(f["ingredients"])
    else:
        for f in all_formulas:
            rc = region_count(f["ingredients"], coven_mask, ingredient_info)
            if (mode == "strict" and rc == 3) or (mode == "predominant" and rc >= 2):
                fcopy = dict(f)
                fcopy["region_count"] = rc
                relevant.append(fcopy)
                candidates.update(f["ingredients"])

    universe = {f["potion"] for f in relevant}
    all_potion_set = set(potions_info.keys())

    if not relevant:
        return {
            "coven": coven,
            "regions": regions,
            "mode": mode,
            "selected_ingredients": [],
            "recipes": [],
            "missing_potions": sorted(all_potion_set, key=lambda p: (TYPE_ORDER.get(potions_info[p]["type"], 9), potions_info[p]["number"])),
            "stats": {
                "total_potions": len(all_potion_set),
                "max_coverable": 0,
                "covered": 0,
                "selected_count": 0,
                "region_percent": 0,
                "common": 0,
                "uncommon": 0,
                "rare": 0,
            },
        }

    selected, covered, coverage_curve = set_cover(
        relevant,
        candidates,
        ingredient_info,
        region_mask=coven_mask if mode != "complete" else COMPLETE_REGION_MASK,
        prefer_region=True,
    )
    recipe_map = choose_recipes(selected, relevant, ingredient_info, coven_mask)
    covered = set(recipe_map.keys())

    selected_data = []
    for ing in selected:
        info = ingredient_info[ing]
        in_region = bool(info["region_mask"] & coven_mask)
        selected_data.append(
            {
                "name": ing,
                "rarity": info.get("rarity"),
                "regions": info.get("regions", []),
                "in_coven_region": in_region,
                "combat": info.get("combat"),
                "utility": info.get("utility"),
                "whimsy": info.get("whimsy"),
            }
        )
    # Sort selected: region ingredients first, then by rarity, then name
    selected_data.sort(
        key=lambda d: (
            -int(d["in_coven_region"]),
            RARITY_ORDER.get(d.get("rarity", "").lower(), 3),
            d["name"],
        )
    )

    recipes = []
    for potion in sorted(
        covered, key=lambda p: (TYPE_ORDER.get(potions_info[p]["type"], 9), potions_info[p]["number"])
    ):
        f = recipe_map[potion]
        rc = region_count(f["ingredients"], coven_mask, ingredient_info)
        recipes.append(
            {
                "potion": potion,
                "type": f["type"],
                "number": f["number"],
                "description": potions_info[potion].get("description"),
                "ingredients": [
                    {
                        "name": ing,
                        "rarity": ingredient_info[ing].get("rarity"),
                        "in_coven_region": bool(ingredient_info[ing]["region_mask"] & coven_mask),
                    }
                    for ing in f["ingredients"]
                ],
                "region_count": rc,
                "is_strict": rc == 3,
            }
        )

    missing = sorted(
        all_potion_set - covered,
        key=lambda p: (TYPE_ORDER.get(potions_info[p]["type"], 9), potions_info[p]["number"]),
    )
    missing_potion_data = [
        {
            "potion": p,
            "type": potions_info[p]["type"],
            "number": potions_info[p]["number"],
            "description": potions_info[p].get("description"),
        }
        for p in missing
    ]

    region_ingredient_count = sum(1 for d in selected_data if d["in_coven_region"])
    rarity_counts = defaultdict(int)
    for d in selected_data:
        rarity_counts[d.get("rarity", "unknown").lower()] += 1

    stats = {
        "total_potions": len(all_potion_set),
        "max_coverable": len(universe),
        "covered": len(covered),
        "uncoverable": len(all_potion_set) - len(universe),
        "unreachable": len(universe) - len(covered),
        "selected_count": len(selected),
        "in_region_count": region_ingredient_count,
        "out_region_count": len(selected) - region_ingredient_count,
        "region_percent": round(100.0 * region_ingredient_count / len(selected), 1) if selected else 0,
        "common": rarity_counts.get("common", 0),
        "uncommon": rarity_counts.get("uncommon", 0),
        "rare": rarity_counts.get("rare", 0),
    }

    return {
        "coven": coven,
        "regions": regions,
        "mode": mode,
        "selected_ingredients": selected_data,
        "recipes": recipes,
        "missing_potions": missing_potion_data,
        "coverage_curve": coverage_curve,
        "stats": stats,
    }


def main():
    ingredient_info, all_formulas, potions_info = load_data()

    almanacs = []
    for coven, regions in COVENS:
        for mode in ("strict", "predominant", "complete"):
            print(f"Building {coven} ({mode})...")
            almanacs.append(build_almanac(coven, regions, mode, ingredient_info, all_formulas, potions_info))

    with open("/home/ubuntu/coven_almanacs.json", "w") as f:
        json.dump(almanacs, f, indent=2)

    with open("/home/ubuntu/coven_almanacs_summary.md", "w") as f:
        f.write("# Coven Almanac Summary\n\n")
        f.write("**Definitions:** `Covered` = potions we can make with the selected ingredients; `Max Coverable` = potions that have any possible recipe under the mode; `Uncoverable` = potions with no such recipe; `Unreachable` = possible recipes we did not end up selecting.\n\n")
        f.write("| Coven | Region(s) | Mode | Selected | In-Region | Out-Region | Region % | Common | Uncommon | Rare | Covered | Max Coverable | Uncoverable | Unreachable |\n")
        f.write("|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n")
        for a in almanacs:
            s = a["stats"]
            f.write(
                f"| {a['coven']} | {', '.join(a['regions'])} | {a['mode']} | "
                f"{s['selected_count']} | "
                f"{s['in_region_count']} | "
                f"{s['out_region_count']} | "
                f"{s['region_percent']}% | "
                f"{s['common']} | {s['uncommon']} | {s['rare']} | "
                f"{s['covered']} | {s['max_coverable']} | "
                f"{s['uncoverable']} | {s['unreachable']} |\n"
            )

    print("Wrote /home/ubuntu/coven_almanacs.json and /home/ubuntu/coven_almanacs_summary.md")


if __name__ == "__main__":
    main()
