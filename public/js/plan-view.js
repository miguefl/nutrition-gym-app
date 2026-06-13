// "Weekly plan" view: assigns recipes to each day/meal and saves the plan.
const PlanView = (() => {
  const DAYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
  const MEALS = ['desayuno', 'comida', 'merienda', 'cena'];
  const DAY_LABEL = {
    lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves',
    viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo',
  };

  let plan = null;
  let recipes = [];

  async function init() {
    document.getElementById('plan-save').addEventListener('click', save);
    await refresh();
  }

  async function refresh() {
    [plan, recipes] = await Promise.all([Data.plan(true), Data.recipes()]);
    render();
  }

  function recipesOfType(type) {
    return recipes
      .filter(r => r.tipo_comida === type)
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  function render() {
    const box = document.getElementById('plan-grid');
    const head = `<tr><th>Día</th>${MEALS.map(m => `<th>${cap(m)}</th>`).join('')}</tr>`;
    const rows = DAYS.map(day => {
      const cells = MEALS.map(meal => {
        const current = plan?.[day]?.[meal] || '';
        const options = recipesOfType(meal).map(r => {
          const sel = r.nombre === current ? 'selected' : '';
          return `<option value="${escapeHtml(r.nombre)}" ${sel}>${escapeHtml(r.nombre)}</option>`;
        }).join('');
        const orphan = current && !recipes.some(r => r.nombre === current)
          ? `<option value="${escapeHtml(current)}" selected>${escapeHtml(current)} (eliminada)</option>`
          : '';
        return `<td><select data-day="${day}" data-meal="${meal}">
          <option value="">—</option>${orphan}${options}
        </select></td>`;
      }).join('');
      return `<tr><td class="plan-day">${DAY_LABEL[day]}</td>${cells}</tr>`;
    }).join('');

    box.innerHTML = `<table class="plan-table"><thead>${head}</thead><tbody>${rows}</tbody></table>`;
  }

  function readPlan() {
    const next = {};
    DAYS.forEach(d => { next[d] = {}; MEALS.forEach(m => { next[d][m] = null; }); });
    document.querySelectorAll('#plan-grid select').forEach(sel => {
      const { day, meal } = sel.dataset;
      next[day][meal] = sel.value || null;
    });
    return next;
  }

  async function save() {
    const btn = document.getElementById('plan-save');
    btn.disabled = true;
    try {
      plan = await Data.savePlan(readPlan());
      toast('Plan semanal guardado', 'ok');
      if (typeof ShoppingView !== 'undefined') ShoppingView.refresh();
      if (typeof LogView !== 'undefined') LogView.refresh();
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  return { init, refresh };
})();
