// "Log" view: marks which planned meals were met each day and shows the
// weekly adherence percentage.
const LogView = (() => {
  const MEALS = ['desayuno', 'comida', 'merienda', 'cena'];
  // getDay(): 0=Sunday ... 6=Saturday → plan day name
  const PLAN_DAY = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

  let weekOffset = 0; // 0 = current week, -1 = previous...

  function init() {
    document.getElementById('log-prev').addEventListener('click', () => { weekOffset--; render(); });
    document.getElementById('log-next').addEventListener('click', () => { weekOffset++; render(); });
    document.getElementById('log-today').addEventListener('click', () => { weekOffset = 0; render(); });
    render();
  }

  function isoDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  // Monday of the week at the given offset.
  function mondayOfWeek(offset) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = (today.getDay() + 6) % 7; // days since Monday
    const monday = new Date(today);
    monday.setDate(today.getDate() - diff + offset * 7);
    return monday;
  }

  async function render() {
    const box = document.getElementById('log-grid');
    box.innerHTML = '<p class="muted">Cargando...</p>';
    try {
      const [plan, log] = await Promise.all([Data.plan(), Data.log(true)]);
      const monday = mondayOfWeek(weekOffset);
      const todayISO = isoDate(new Date());

      const days = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        days.push(date);
      }

      const end = new Date(monday); end.setDate(monday.getDate() + 6);
      document.getElementById('log-range').textContent =
        `${monday.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} — ${end.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`;

      let totalOk = 0, totalMarked = 0, totalPlanned = 0;

      const rows = days.map(date => {
        const iso = isoDate(date);
        const dayName = PLAN_DAY[date.getDay()];
        const isToday = iso === todayISO;
        const isFuture = iso > todayISO;

        const cells = MEALS.map(meal => {
          const recipe = plan?.[dayName]?.[meal];
          if (!recipe) return '<td class="log-empty">—</td>';
          if (!isFuture) totalPlanned++;
          const state = log?.[iso]?.[meal] || null;
          if (state === 'ok') { totalOk++; totalMarked++; }
          if (state === 'fallo') totalMarked++;
          const cls = state === 'ok' ? 'log-ok' : state === 'fallo' ? 'log-fail' : '';
          return `
            <td class="log-cell ${cls}">
              <div class="log-recipe" title="${escapeHtml(recipe)}">${escapeHtml(recipe)}</div>
              <div class="log-buttons">
                <button type="button" class="log-btn ${state === 'ok' ? 'on' : ''}" data-date="${iso}" data-meal="${meal}" data-state="ok" title="Cumplido">✓</button>
                <button type="button" class="log-btn ${state === 'fallo' ? 'on' : ''}" data-date="${iso}" data-meal="${meal}" data-state="fallo" title="No cumplido">✗</button>
              </div>
            </td>`;
        }).join('');

        return `<tr class="${isToday ? 'log-today-row' : ''}">
          <td class="plan-day">${cap(dayName)} <span class="muted">${date.getDate()}</span></td>
          ${cells}
        </tr>`;
      }).join('');

      const pct = totalPlanned > 0 ? Math.round((totalOk / totalPlanned) * 100) : null;
      const summary = pct === null
        ? '<p class="muted">No hay comidas planificadas esta semana. Asigna recetas en la pestaña Plan.</p>'
        : `<div class="log-summary">
             <div class="log-pct ${pct >= 80 ? 'ok' : pct >= 50 ? 'warn' : 'err'}">${pct}%</div>
             <p class="muted">adherencia: ${totalOk} de ${totalPlanned} comidas cumplidas
             (${totalPlanned - totalMarked} sin marcar)</p>
           </div>`;

      box.innerHTML = `
        ${summary}
        <table class="plan-table log-table">
          <thead><tr><th>Día</th>${MEALS.map(m => `<th>${cap(m)}</th>`).join('')}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `;

      box.querySelectorAll('.log-btn').forEach(btn => {
        btn.addEventListener('click', () => mark(btn));
      });
    } catch (err) {
      box.innerHTML = `<p class="muted">Error: ${escapeHtml(err.message)}</p>`;
    }
  }

  async function mark(btn) {
    const { date, meal, state } = btn.dataset;
    // If already active, unmark it (state null).
    const next = btn.classList.contains('on') ? null : state;
    try {
      await Data.markLog(date, meal, next);
      render();
    } catch (err) {
      toast(err.message, 'err');
    }
  }

  return { init, refresh: render };
})();
