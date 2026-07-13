let ingredients = [];
let ingredientByName = {};
let potions = [];
let potionByName = {};
let potionFormulas = null;
let selectedIngredients = new Set();
let covenAlmanacs = [];
let covenAlmanacsByKey = {};

const rarityOrder = { common: 0, uncommon: 1, rare: 2 };
const typeOrder = { combat: 0, utility: 1, whimsy: 2 };

function sortByName(a, b) {
  return a.name.localeCompare(b.name);
}

function valuesString(ing) {
  return `${ing.combat}-${ing.utility}-${ing.whimsy}`;
}

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

function classForRarity(rarity) {
  return `rarity-tag ${rarity}`;
}

function renderIngredientList() {
  const commonEl = document.getElementById('common-list');
  const uncommonEl = document.getElementById('uncommon-list');
  const rareEl = document.getElementById('rare-list');
  [commonEl, uncommonEl, rareEl].forEach(el => el.innerHTML = '');

  ingredients.slice().sort(sortByName).forEach(ing => {
    const card = document.createElement('div');
    card.className = 'ingredient-card';
    card.dataset.name = ing.name;
    card.innerHTML = `
      <span class="name">${ing.name}</span>
      <span class="values">[${valuesString(ing)}]</span>
      <span class="${classForRarity(ing.rarity)}">${ing.rarity}</span>
    `;
    card.addEventListener('click', () => toggleIngredient(ing.name, card));
    const target = ing.rarity === 'uncommon' ? uncommonEl : ing.rarity === 'rare' ? rareEl : commonEl;
    target.appendChild(card);
  });
}

function toggleIngredient(name, cardEl) {
  if (selectedIngredients.has(name)) {
    selectedIngredients.delete(name);
    cardEl.classList.remove('selected');
  } else {
    selectedIngredients.add(name);
    cardEl.classList.add('selected');
  }
  updateSelectionCount();
}

function updateSelectionCount() {
  const count = selectedIngredients.size;
  document.getElementById('selection-count').textContent = `${count} selected`;
}

function combinations(arr, k) {
  const result = [];
  function helper(start, path) {
    if (path.length === k) {
      result.push(path.slice());
      return;
    }
    for (let i = start; i < arr.length; i++) {
      path.push(arr[i]);
      helper(i + 1, path);
      path.pop();
    }
  }
  helper(0, []);
  return result;
}

function findPotionFromIngredients(ingNames) {
  const ings = ingNames.map(n => ingredientByName[n]);
  const combat = ings.reduce((s, i) => s + i.combat, 0);
  const utility = ings.reduce((s, i) => s + i.utility, 0);
  const whimsy = ings.reduce((s, i) => s + i.whimsy, 0);
  const m = Math.max(combat, utility, whimsy);
  if (m === 0) return [];
  const results = [];
  if (combat === m) results.push({ type: 'combat', number: combat, ingredients: ingNames });
  if (utility === m) results.push({ type: 'utility', number: utility, ingredients: ingNames });
  if (whimsy === m) results.push({ type: 'whimsy', number: whimsy, ingredients: ingNames });
  return results;
}

function findRecipes() {
  const resultsEl = document.getElementById('ingredient-results');
  if (selectedIngredients.size < 3) {
    resultsEl.innerHTML = `<h2>Results</h2><p class="hint">Select at least 3 ingredients.</p>`;
    return;
  }

  const selected = Array.from(selectedIngredients);
  const combos = combinations(selected, 3);
  const potionMap = {};

  combos.forEach(combo => {
    const results = findPotionFromIngredients(combo);
    results.forEach(r => {
      const key = `${r.type}-${r.number}`;
      if (!potionMap[key]) {
        const potion = potions.find(p => p.type === r.type && p.number === r.number);
        potionMap[key] = {
          type: r.type,
          number: r.number,
          name: potion ? potion.name : r.type,
          description: potion ? potion.description : '',
          combinations: [],
        };
      }
      potionMap[key].combinations.push(r.ingredients.sort());
    });
  });

  const sorted = Object.values(potionMap).sort((a, b) => {
    if (typeOrder[a.type] !== typeOrder[b.type]) return typeOrder[a.type] - typeOrder[b.type];
    return a.number - b.number;
  });

  const byType = { combat: [], utility: [], whimsy: [] };
  sorted.forEach(p => byType[p.type].push(p));

  let html = '<h2>Results</h2>';
  if (sorted.length === 0) {
    html += '<p class="hint">No potions could be brewed from these selections.</p>';
  } else {
    ['combat', 'utility', 'whimsy'].forEach(type => {
      const list = byType[type];
      if (list.length === 0) return;
      html += `<div class="type-section ${type}"><h3>${type}</h3>`;
      list.forEach(p => {
        html += `<div class="potion-card">
          <h4>${p.name} <span class="number">#${p.number}</span></h4>
          <div class="meta">${p.type} potion</div>
          <div class="description">${p.description}</div>
          <div class="combination-list">`;
        p.combinations.forEach(combo => {
          html += `<div class="combination">`;
          combo.forEach(name => {
            const ing = ingredientByName[name];
            html += `<span class="ingredient-chip ${ing.rarity}">${name}</span>`;
          });
          html += `</div>`;
        });
        html += `</div></div>`;
      });
      html += `</div>`;
    });
  }

  resultsEl.innerHTML = html;
}

function clearSelection() {
  selectedIngredients.clear();
  document.querySelectorAll('.ingredient-card.selected').forEach(el => el.classList.remove('selected'));
  updateSelectionCount();
  document.getElementById('ingredient-results').innerHTML = `<h2>Results</h2><p class="hint">Select at least 3 ingredients and click Find Recipes.</p>`;
}

function renderPotionList() {
  const listEl = document.getElementById('potion-list');
  const byType = { combat: [], utility: [], whimsy: [] };
  potions.forEach(p => byType[p.type].push(p));
  Object.keys(byType).forEach(type => byType[type].sort((a, b) => a.number - b.number));

  let html = '';
  ['combat', 'utility', 'whimsy'].forEach(type => {
    html += `<h3 class="type-section ${type}">${type}</h3>`;
    byType[type].forEach(p => {
      html += `
        <div class="potion-group" data-name="${p.name}">
          <h4>
            <span>${p.name}</span>
            <span class="number">#${p.number} ${p.type}</span>
          </h4>
        </div>
      `;
    });
  });
  listEl.innerHTML = html;

  listEl.querySelectorAll('.potion-group h4').forEach(header => {
    header.addEventListener('click', () => {
      const group = header.parentElement;
      const name = group.dataset.name;
      listEl.querySelectorAll('.potion-group.active').forEach(g => g.classList.remove('active'));
      group.classList.add('active');
      renderRecipesForPotion(name);
    });
  });
}

function recipeRarityScore(formula) {
  return formula.ingredients.reduce((s, name) => s + rarityOrder[ingredientByName[name].rarity], 0);
}

function renderRecipesForPotion(name) {
  const container = document.getElementById('potion-recipes');
  if (!potionFormulas) {
    container.innerHTML = '<h2>Recipes</h2><p class="hint">Loading recipes...</p>';
    return;
  }
  const data = potionFormulas[name];
  const potion = potionByName[name];
  if (!data || !data.formulas || data.formulas.length === 0) {
    container.innerHTML = `<h2>${name}</h2><p class="hint">No recipes found.</p>`;
    return;
  }

  const formulas = data.formulas.slice().sort((a, b) => {
    const sa = recipeRarityScore(a);
    const sb = recipeRarityScore(b);
    if (sa !== sb) return sa - sb;
    return a.ingredients.join(',').localeCompare(b.ingredients.join(','));
  });

  let html = `<h2>${name}</h2>`;
  if (potion) {
    html += `<div class="meta">#${potion.number} ${potion.type} potion</div>`;
    html += `<div class="description">${potion.description}</div>`;
  }
  html += `<p class="hint">${formulas.length} recipe(s) found</p>`;
  formulas.forEach(f => {
    html += `<div class="combination">`;
    f.ingredients.forEach(name => {
      const ing = ingredientByName[name];
      html += `<span class="ingredient-chip ${ing.rarity}">${name} [${valuesString(ing)}]</span>`;
    });
    html += `</div>`;
  });
  container.innerHTML = html;
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  document.getElementById(`view-${tab}`).classList.add('active');
}

async function init() {
  try {
    const [ingData, potData] = await Promise.all([
      loadJSON('ingredients.json'),
      loadJSON('potions.json'),
    ]);
    ingredients = ingData;
    ingredientByName = Object.fromEntries(ingredients.map(i => [i.name, i]));
    potions = potData;
    potionByName = Object.fromEntries(potions.map(p => [p.name, p]));

    renderIngredientList();
    renderPotionList();

    document.getElementById('find-recipes').addEventListener('click', findRecipes);
    document.getElementById('clear-selection').addEventListener('click', clearSelection);
    document.querySelectorAll('.tab').forEach(t => {
      t.addEventListener('click', () => switchTab(t.dataset.tab));
    });

    loadJSON('potion_formulas.json').then(data => {
      potionFormulas = data;
      document.getElementById('potion-loading').style.display = 'none';
    }).catch(err => {
      console.error(err);
      document.getElementById('potion-loading').textContent = 'Error loading potion recipes.';
    });

    loadJSON('coven_almanacs.json').then(data => {
      covenAlmanacs = data;
      covenAlmanacs.forEach(entry => {
        covenAlmanacsByKey[`${entry.coven}|${entry.mode}`] = entry;
      });
      initCovenAlmanac();
    }).catch(err => {
      console.error(err);
      document.getElementById('coven-loading').textContent = 'Error loading coven almanacs.';
    });
  } catch (err) {
    console.error(err);
    document.body.innerHTML = `<p class="loading">Failed to load data: ${err.message}</p>`;
  }
}

function getCovens() {
  const seen = new Set();
  return covenAlmanacs.map(e => e.coven).filter(c => {
    if (seen.has(c)) return false;
    seen.add(c);
    return true;
  });
}

function getModesForCoven(coven) {
  const modes = [];
  const order = ['strict', 'predominant', 'complete', 'economical'];
  const entryModes = new Set(covenAlmanacs.filter(e => e.coven === coven).map(e => e.mode));
  order.forEach(m => { if (entryModes.has(m)) modes.push(m); });
  return modes;
}

function getCovenEntry(coven, mode) {
  return covenAlmanacsByKey[`${coven}|${mode}`] || null;
}

function initCovenAlmanac() {
  const covenSelect = document.getElementById('coven-select');
  const modeSelect = document.getElementById('coven-mode-select');
  const covens = getCovens();
  if (covens.length === 0) return;

  covenSelect.innerHTML = covens.map(c => `<option value="${c}">${c}</option>`).join('');

  function updateModes() {
    const modes = getModesForCoven(covenSelect.value);
    const current = modeSelect.value;
    modeSelect.innerHTML = modes.map(m => `<option value="${m}">${m}</option>`).join('');
    if (modes.includes(current)) modeSelect.value = current;
    renderCovenAlmanac();
  }

  covenSelect.addEventListener('change', updateModes);
  modeSelect.addEventListener('change', renderCovenAlmanac);

  document.getElementById('coven-loading').style.display = 'none';
  document.getElementById('coven-controls').style.display = 'flex';
  document.getElementById('coven-dashboard').style.display = 'block';

  updateModes();
}

function renderCovenAlmanac() {
  const coven = document.getElementById('coven-select').value;
  const mode = document.getElementById('coven-mode-select').value;
  const entry = getCovenEntry(coven, mode);
  if (!entry) return;

  renderCovenStats(entry.stats);
  renderCovenIngredients(entry.selected_ingredients);
  renderCovenRecipes(entry.recipes);
  renderCovenMissing(entry.missing_potions);
}

function renderCovenStats(stats) {
  const el = document.getElementById('coven-stats');
  el.innerHTML = `
    <div class="stat-card"><span class="stat-value">${stats.selected_count}</span><span class="stat-label">Ingredients</span></div>
    <div class="stat-card"><span class="stat-value">${stats.in_region_count}</span><span class="stat-label">In-Region</span></div>
    <div class="stat-card"><span class="stat-value">${stats.out_region_count}</span><span class="stat-label">Out-Region</span></div>
    <div class="stat-card"><span class="stat-value">${stats.region_percent}%</span><span class="stat-label">Region %</span></div>
    <div class="stat-card"><span class="stat-value">${stats.common}</span><span class="stat-label">Common</span></div>
    <div class="stat-card"><span class="stat-value">${stats.uncommon}</span><span class="stat-label">Uncommon</span></div>
    <div class="stat-card"><span class="stat-value">${stats.rare}</span><span class="stat-label">Rare</span></div>
    <div class="stat-card"><span class="stat-value">${stats.total_cost}</span><span class="stat-label">Total Cost</span></div>
    <div class="stat-card"><span class="stat-value">${stats.cost_per_potion}</span><span class="stat-label">Cost / Potion</span></div>
    <div class="stat-card"><span class="stat-value">${stats.covered}</span><span class="stat-label">Covered</span></div>
    <div class="stat-card"><span class="stat-value">${stats.uncoverable}</span><span class="stat-label">Uncoverable</span></div>
    <div class="stat-card"><span class="stat-value">${stats.unreachable}</span><span class="stat-label">Unreachable</span></div>
  `;
}

function renderCovenIngredients(selectedIngredients) {
  const el = document.getElementById('coven-ingredients');
  const byRarity = { common: [], uncommon: [], rare: [] };
  selectedIngredients.forEach(ing => {
    byRarity[ing.rarity].push(ing);
  });

  let html = '';
  ['common', 'uncommon', 'rare'].forEach(rarity => {
    const list = byRarity[rarity].sort((a, b) => a.name.localeCompare(b.name));
    if (list.length === 0) return;
    html += `<div class="coven-rarity-group ${rarity}"><h4>${rarity}</h4><div class="coven-ingredient-list">`;
    list.forEach(ing => {
      const regionBadge = ing.in_coven_region ? '<span class="region-badge in-region">in-region</span>' : '<span class="region-badge out-region">out-of-region</span>';
      const regions = ing.regions ? ing.regions.join(', ') : 'Any';
      html += `<div class="coven-ingredient-card">
        <div class="coven-ingredient-name">
          <span class="coven-rarity-dot ${ing.rarity}"></span>
          ${ing.name}
          ${regionBadge}
        </div>
        <div class="coven-ingredient-meta">[${valuesString(ing)}] &mdash; ${regions}</div>
      </div>`;
    });
    html += `</div></div>`;
  });
  el.innerHTML = html || '<p class="hint">No ingredients selected.</p>';
}

function renderCovenRecipes(recipes) {
  const el = document.getElementById('coven-recipes');
  const byType = { combat: [], utility: [], whimsy: [] };
  recipes.forEach(r => {
    const type = r.type || 'unknown';
    if (byType[type]) byType[type].push(r);
  });

  let html = '';
  ['combat', 'utility', 'whimsy'].forEach(type => {
    const list = byType[type].sort((a, b) => a.number - b.number);
    if (list.length === 0) return;
    html += `<div class="type-section ${type}"><h4>${type}</h4>`;
    list.forEach(r => {
      html += `<div class="coven-recipe-card">
        <div class="coven-recipe-title">
          <strong>${r.potion}</strong>
          <span class="number">#${r.number}</span>
          <span class="coven-recipe-tags">${r.region_count} region${r.region_count === 1 ? '' : 's'}${r.is_strict ? ' &bull; strict' : ''}</span>
        </div>
        <div class="description">${r.description || ''}</div>
        <div class="combination">`;
      r.ingredients.forEach(i => {
        html += `<span class="ingredient-chip ${i.rarity}">${i.name}</span>`;
      });
      html += `</div></div>`;
    });
    html += `</div>`;
  });
  el.innerHTML = html || '<p class="hint">No recipes available.</p>';
}

function renderCovenMissing(missing) {
  const el = document.getElementById('coven-missing');
  if (!missing || missing.length === 0) {
    el.innerHTML = '<p class="hint">All 180 potions are covered.</p>';
    return;
  }
  const byType = { combat: [], utility: [], whimsy: [] };
  missing.forEach(p => {
    const type = p.type || 'unknown';
    if (byType[type]) byType[type].push(p);
  });

  let html = '';
  ['combat', 'utility', 'whimsy'].forEach(type => {
    const list = byType[type].sort((a, b) => a.number - b.number);
    if (list.length === 0) return;
    html += `<div class="type-section ${type}"><h4>${type}</h4>`;
    list.forEach(p => {
      html += `<div class="coven-missing-card">
        <strong>${p.potion}</strong> <span class="number">#${p.number}</span>
        <div class="description">${p.description || ''}</div>
      </div>`;
    });
    html += `</div>`;
  });
  el.innerHTML = html;
}

init();
