// "Adjust" view: the user lists ingredients without quantities, the app
// proposes the quantities that fit the menu pattern and offers to continue
// in the Validator to save it as a new recipe.
const AdjustView = (() => {
  const ING_TYPES = [
    'cereales', 'legumbres', 'tuberculos', 'carne blanca', 'carne roja',
    'carne procesada', 'pescado blanco', 'pescado azul', 'marisco', 'huevo',
    'lacteos proteicos', 'lacteos grasos', 'grasas', 'grasas vegetales',
    'fruta', 'verdura',
  ];

  let ingRows = [];
  let lastProposal = null;
  let lastType = null;

  function init() {
    ingRows = [];
    addIngredient();
    document.getElementById('a-add-ing').addEventListener('click', () => addIngredient());
    document.getElementById('form-adjust').addEventListener('submit', onCompute);
    document.getElementById('a-suggest-ai').addEventListener('click', onSuggestAI);
  }

  function addIngredient() {
    const cont = document.getElementById('a-ingredients');
    const row = document.createElement('div');
    row.className = 'ingredient-row no-qty';
    row.innerHTML = `
      <input type="text" class="ing-name" placeholder="Ingrediente (ej. pollo)" />
      <select class="ing-type">
        <option value="">(tipo opcional)</option>
        ${ING_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}
      </select>
      <button type="button" class="btn-remove" title="Eliminar">×</button>
    `;
    row.querySelector('.btn-remove').addEventListener('click', () => {
      row.remove();
      ingRows = ingRows.filter(r => r !== row);
    });
    cont.appendChild(row);
    ingRows.push(row);
  }

  function readIngredients() {
    return ingRows
      .map(row => ({
        nombre: row.querySelector('.ing-name').value.trim(),
        tipo: row.querySelector('.ing-type').value.trim() || undefined,
      }))
      .filter(i => i.nombre);
  }

  function onCompute(e) {
    e.preventDefault();
    const ings = readIngredients();
    const type = document.getElementById('a-type').value;
    if (!ings.length) return toast('Añade al menos un ingrediente', 'err');

    const { adjusted, notes, error } = Blocks.adjustQuantities(ings, type);
    if (error) return toast(error, 'err');

    lastProposal = adjusted;
    lastType = type;

    // Validate the resulting proposal to show blocks to the user
    const val = Blocks.validateRecipe({
      nombre: 'Propuesta', tipo_comida: type, ingredientes: adjusted,
    });

    renderResult(adjusted, val, notes);
  }

  function renderResult(adjusted, val, notes) {
    const box = document.getElementById('a-result');
    const ingRowsHtml = adjusted.map(i => `
      <li>
        <strong>${escapeHtml(i.nombre)}</strong> — ${escapeHtml(i.cantidad || 'libre')}
        ${i.tipo ? `<span class="muted">(${i.tipo})</span>` : ''}
      </li>
    `).join('');

    const blockRows = val.comparisons.map(c => {
      const cls = c.state === 'ok' ? 'delta-ok' : c.state === 'warn' ? 'delta-warn' : 'delta-err';
      const sign = c.diff > 0 ? '+' : '';
      return `
        <tr>
          <td>${Blocks.categoryLabel(c.category)}</td>
          <td>${c.current}</td>
          <td>${c.target}</td>
          <td class="${cls}">${sign}${c.diff}</td>
        </tr>
      `;
    }).join('');

    const warnings = notes.length
      ? `<ul class="issues">${notes.map(n => `<li class="warn">${escapeHtml(n)}</li>`).join('')}</ul>`
      : '';

    box.innerHTML = `
      <div class="status ok"><strong>Cantidades propuestas</strong>Basadas en el patrón de ${escapeHtml(lastType)}.</div>
      <div class="suggestion-box">
        <h4>Receta ajustada</h4>
        <ul>${ingRowsHtml}</ul>
      </div>
      <table class="blocks-table">
        <thead><tr><th>Categoría</th><th>Actual</th><th>Objetivo</th><th>Δ</th></tr></thead>
        <tbody>${blockRows}</tbody>
      </table>
      ${warnings}
      <div class="actions">
        <button type="button" class="btn btn-primary" id="a-send-validator">Crear receta a partir de esta propuesta</button>
      </div>
    `;
    document.getElementById('a-send-validator').addEventListener('click', sendToValidator);
  }

  // Asks the AI for a full recipe from the listed ingredients.
  async function onSuggestAI() {
    const ings = readIngredients().map(i => i.nombre);
    const type = document.getElementById('a-type').value;
    if (!ings.length) return toast('Añade al menos un ingrediente', 'err');

    const btn = document.getElementById('a-suggest-ai');
    const box = document.getElementById('a-result');
    btn.disabled = true;
    btn.textContent = 'Consultando IA...';
    box.innerHTML = '<p class="muted">La IA está componiendo una receta que encaje en el patrón (puede tardar unos segundos)...</p>';
    try {
      const { receta, justificacion } = await Data.suggestRecipeAI(type, ings);
      const val = Blocks.validateRecipe(receta);
      lastProposal = receta.ingredientes;
      lastType = receta.tipo_comida;

      const ingRowsHtml = receta.ingredientes.map(i => `
        <li><strong>${escapeHtml(i.nombre)}</strong> — ${escapeHtml(i.cantidad || 'libre')}
        ${i.tipo ? `<span class="muted">(${escapeHtml(i.tipo)})</span>` : ''}</li>
      `).join('');
      const blockRows = val.comparisons.map(c => {
        const cls = c.state === 'ok' ? 'delta-ok' : c.state === 'warn' ? 'delta-warn' : 'delta-err';
        const sign = c.diff > 0 ? '+' : '';
        return `<tr><td>${Blocks.categoryLabel(c.category)}</td><td>${c.current}</td><td>${c.target}</td><td class="${cls}">${sign}${c.diff}</td></tr>`;
      }).join('');

      box.innerHTML = `
        <div class="status ok"><strong>${escapeHtml(receta.nombre)}</strong>Receta propuesta por la IA para ${escapeHtml(type)}.</div>
        ${justificacion ? `<p class="muted">${escapeHtml(justificacion)}</p>` : ''}
        <div class="suggestion-box"><h4>Ingredientes</h4><ul>${ingRowsHtml}</ul></div>
        <table class="blocks-table">
          <thead><tr><th>Categoría</th><th>Actual</th><th>Objetivo</th><th>Δ</th></tr></thead>
          <tbody>${blockRows}</tbody>
        </table>
        <div class="actions">
          <button type="button" class="btn btn-primary" id="a-ai-validator">Revisar y guardar en el validador</button>
        </div>
      `;
      document.getElementById('a-ai-validator').addEventListener('click', () => {
        ValidatorView.loadRecipe(receta);
        document.querySelector('.tab[data-tab="validator"]').click();
        toast('Receta cargada en el validador. Valida y guarda.', 'ok');
      });
    } catch (err) {
      box.innerHTML = `<div class="status err"><strong>Error:</strong> ${escapeHtml(err.message)}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sugerir receta (IA)';
    }
  }

  function sendToValidator() {
    if (!lastProposal) return;
    const recipe = {
      nombre: '',
      tipo_comida: lastType,
      ingredientes: lastProposal.map(i => ({ nombre: i.nombre, cantidad: i.cantidad, tipo: i.tipo })),
    };
    ValidatorView.loadRecipe(recipe);
    // switch tab
    document.querySelector('.tab[data-tab="validator"]').click();
    toast('Propuesta enviada al validador. Ponle nombre y valida para guardar.', 'ok');
  }

  return { init };
})();
