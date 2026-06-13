// "Recipes" view: grid with filters by meal type, ingredient and macros.
const RecipesView = (() => {
  const MEAL_TYPES = ['desayuno', 'comida', 'merienda', 'cena'];
  let all = [];
  const filters = {
    types: new Set(),
    ingredient: '',
    macros: { carbohidratos: '', grasas: '', proteinas: '' },
  };

  async function init() {
    all = await Data.recipes();
    renderTypeFilters();
    bindEvents();
    render();
  }

  function renderTypeFilters() {
    const cont = document.getElementById('filter-types');
    cont.innerHTML = MEAL_TYPES.map(t => `
      <label data-type="${t}">
        <input type="checkbox" value="${t}" /> ${cap(t)}
      </label>
    `).join('');
    cont.querySelectorAll('label').forEach(lbl => {
      lbl.addEventListener('click', e => {
        e.preventDefault();
        const type = lbl.dataset.type;
        if (filters.types.has(type)) {
          filters.types.delete(type);
          lbl.classList.remove('active');
        } else {
          filters.types.add(type);
          lbl.classList.add('active');
        }
        render();
      });
    });
  }

  function bindEvents() {
    document.getElementById('filter-ingredient').addEventListener('input', e => {
      filters.ingredient = e.target.value.trim().toLowerCase();
      render();
    });
    document.querySelectorAll('.macro-filters select').forEach(sel => {
      sel.addEventListener('change', e => {
        filters.macros[sel.dataset.macro] = e.target.value;
        render();
      });
    });
    document.getElementById('reset-filters').addEventListener('click', () => {
      filters.types.clear();
      filters.ingredient = '';
      filters.macros = { carbohidratos: '', grasas: '', proteinas: '' };
      document.getElementById('filter-ingredient').value = '';
      document.querySelectorAll('.macro-filters select').forEach(s => s.value = '');
      document.querySelectorAll('#filter-types label').forEach(l => l.classList.remove('active'));
      render();
    });
  }

  function matches(recipe) {
    if (filters.types.size && !filters.types.has(recipe.tipo_comida)) return false;
    if (filters.ingredient) {
      const hit = recipe.ingredientes.some(i =>
        i.nombre.toLowerCase().includes(filters.ingredient) ||
        (i.tipo || '').toLowerCase().includes(filters.ingredient)
      );
      if (!hit) return false;
    }
    for (const macro of Object.keys(filters.macros)) {
      const v = filters.macros[macro];
      if (v && recipe.macros?.[macro] !== v) return false;
    }
    return true;
  }

  function render() {
    const grid = document.getElementById('recipes-grid');
    const filtered = all.filter(matches);
    document.getElementById('recipes-count').textContent = filtered.length;
    if (!filtered.length) {
      grid.innerHTML = `<p class="muted">No hay recetas que encajen con los filtros.</p>`;
      return;
    }
    grid.innerHTML = filtered.map(cardHTML).join('');
    bindActions();
  }

  function cardHTML(r) {
    const ings = r.ingredientes.map(i => `
      <li>
        <span>${escapeHtml(i.nombre)}</span>
        <span class="ing-qty">${escapeHtml(i.cantidad || '')}</span>
      </li>
    `).join('');
    const LEVELS = ['bajo', 'medio', 'alto'];
    const macros = r.macros ? Object.entries(r.macros)
      .filter(([, v]) => LEVELS.includes(v))
      .map(([k, v]) =>
        `<span class="macro-pill ${v}">${escapeHtml(cap(k.slice(0, 4)))}: ${v}</span>`
      ).join('') : '';
    return `
      <article class="recipe-card">
        <div class="recipe-top">
          <span class="type">${escapeHtml(r.tipo_comida)}</span>
          <div class="recipe-actions">
            <button type="button" class="btn-icon btn-edit" data-name="${escapeHtml(r.nombre)}" title="Editar">✎</button>
            <button type="button" class="btn-icon btn-delete" data-name="${escapeHtml(r.nombre)}" title="Borrar">🗑</button>
          </div>
        </div>
        <h3>${escapeHtml(r.nombre)}</h3>
        <ul>${ings}</ul>
        <div class="macros">${macros}</div>
      </article>
    `;
  }

  function bindActions() {
    document.querySelectorAll('#recipes-grid .btn-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const recipe = all.find(r => r.nombre === btn.dataset.name);
        if (recipe) ValidatorView.editRecipe(recipe);
      });
    });
    document.querySelectorAll('#recipes-grid .btn-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const name = btn.dataset.name;
        if (!confirm(`¿Borrar la receta "${name}"?\n\nSi está asignada en el plan semanal, quedará marcada como eliminada.`)) return;
        try {
          await Data.deleteRecipe(name);
          toast(`Receta "${name}" borrada`, 'ok');
          await reload();
          if (typeof PlanView !== 'undefined') PlanView.refresh();
        } catch (err) {
          toast(err.message, 'err');
        }
      });
    });
  }

  async function reload() {
    all = await Data.recipes(true);
    render();
  }

  return { init, reload };
})();
