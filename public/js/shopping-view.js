// "Shopping" view: builds the shopping list by aggregating the ingredients of
// the recipes assigned in the weekly plan. The "bought" state is kept in
// localStorage.
const ShoppingView = (() => {
  const DAYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
  const LS_KEY = 'shopping-checked';

  let selectedDays = new Set(DAYS);

  function init() {
    renderDays();
    document.getElementById('shopping-generate').addEventListener('click', generate);
    generate();
  }

  function renderDays() {
    const cont = document.getElementById('shopping-days');
    cont.innerHTML = DAYS.map(d => `
      <label data-day="${d}" class="active"><input type="checkbox" checked /> ${cap(d)}</label>
    `).join('');
    cont.querySelectorAll('label').forEach(lbl => {
      lbl.addEventListener('click', e => {
        e.preventDefault();
        const day = lbl.dataset.day;
        if (selectedDays.has(day)) {
          selectedDays.delete(day);
          lbl.classList.remove('active');
        } else {
          selectedDays.add(day);
          lbl.classList.add('active');
        }
      });
    });
  }

  function readChecked() {
    try { return new Set(JSON.parse(localStorage.getItem(LS_KEY) || '[]')); }
    catch { return new Set(); }
  }

  function saveChecked(set) {
    localStorage.setItem(LS_KEY, JSON.stringify([...set]));
  }

  async function generate() {
    const box = document.getElementById('shopping-list');
    box.innerHTML = '<p class="muted">Generando...</p>';
    try {
      const [plan, recipes] = await Promise.all([Data.plan(true), Data.recipes()]);
      const byName = new Map(recipes.map(r => [r.nombre.toLowerCase(), r]));

      // normalized name → { name, grams, units, free, category, unparsed[] }
      const items = new Map();
      let plannedMeals = 0;

      for (const day of DAYS) {
        if (!selectedDays.has(day)) continue;
        for (const recipeName of Object.values(plan[day] || {})) {
          if (!recipeName) continue;
          const recipe = byName.get(recipeName.toLowerCase());
          if (!recipe) continue;
          plannedMeals++;
          for (const ing of recipe.ingredientes || []) {
            const key = Blocks.normalize(ing.nombre);
            if (!items.has(key)) {
              const d = Blocks.calcIngredientBlocks(ing);
              items.set(key, {
                name: ing.nombre, grams: 0, units: 0,
                free: false, category: d.category, unparsed: [],
              });
            }
            const item = items.get(key);
            const q = Blocks.parseQuantity(ing.cantidad);
            if (q.unit === 'libre') item.free = true;
            else if (q.unit === 'unidad' && q.value != null) item.units += q.value;
            else if (q.unit === 'g' && q.value != null) item.grams += q.value;
            else if (ing.cantidad) item.unparsed.push(ing.cantidad);
            else item.free = true;
          }
        }
      }

      if (plannedMeals === 0) {
        box.innerHTML = '<p class="muted">No hay comidas planificadas en los días seleccionados. Asigna recetas en la pestaña Plan.</p>';
        return;
      }
      render([...items.values()], plannedMeals);
    } catch (err) {
      box.innerHTML = `<p class="muted">Error: ${escapeHtml(err.message)}</p>`;
    }
  }

  function quantityText(item) {
    const parts = [];
    if (item.grams > 0) parts.push(`${Math.round(item.grams)} g`);
    if (item.units > 0) parts.push(`${Math.round(item.units * 10) / 10} ud`);
    if (item.free && parts.length === 0) parts.push('al gusto');
    if (item.unparsed.length) parts.push(item.unparsed.join(' + '));
    return parts.join(' + ') || '—';
  }

  function render(items, mealCount) {
    const box = document.getElementById('shopping-list');
    const checked = readChecked();

    const groups = {};
    for (const item of items) {
      const cat = item.category || 'otros';
      (groups[cat] = groups[cat] || []).push(item);
    }

    const order = ['carbohidratos', 'proteinas_magras', 'proteinas_grasas', 'grasas', 'fruta', 'verduras', 'otros'];
    const sections = order.filter(c => groups[c]).map(cat => {
      const rows = groups[cat]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(item => {
          const key = Blocks.normalize(item.name);
          const isChecked = checked.has(key) ? 'checked' : '';
          return `
            <li class="shopping-item ${isChecked ? 'bought' : ''}">
              <label>
                <input type="checkbox" data-key="${escapeHtml(key)}" ${isChecked} />
                <span class="shopping-name">${escapeHtml(item.name)}</span>
                <span class="shopping-qty">${escapeHtml(quantityText(item))}</span>
              </label>
            </li>`;
        }).join('');
      const label = cat === 'otros' ? 'Otros / sin categoría' : Blocks.categoryLabel(cat);
      return `<div class="shopping-group"><h4>${escapeHtml(label)}</h4><ul>${rows}</ul></div>`;
    }).join('');

    box.innerHTML = `
      <p class="muted">${items.length} ingredientes para ${mealCount} comidas planificadas.</p>
      ${sections}
      <div class="actions"><button type="button" class="btn btn-ghost" id="shopping-reset">Desmarcar todo</button></div>
    `;

    box.querySelectorAll('input[type=checkbox]').forEach(chk => {
      chk.addEventListener('change', () => {
        const set = readChecked();
        if (chk.checked) set.add(chk.dataset.key); else set.delete(chk.dataset.key);
        saveChecked(set);
        chk.closest('.shopping-item').classList.toggle('bought', chk.checked);
      });
    });
    document.getElementById('shopping-reset').addEventListener('click', () => {
      saveChecked(new Set());
      generate();
    });
  }

  return { init, refresh: generate };
})();
