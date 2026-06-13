// "Validator" view: takes a recipe, validates it against the meal-type
// pattern, shows issues/suggestions and lets the user save it.
const ValidatorView = (() => {
  const ING_TYPES = [
    'cereales', 'legumbres', 'tuberculos', 'carne blanca', 'carne roja',
    'carne procesada', 'pescado blanco', 'pescado azul', 'marisco', 'huevo',
    'lacteos proteicos', 'lacteos grasos', 'grasas', 'grasas vegetales',
    'fruta', 'verdura',
  ];

  let ingRows = [];
  let lastRecipe = null;
  let lastValidation = null;
  let editingName = null; // original name when editing an existing recipe

  function init() {
    ingRows = [];
    addIngredient();
    document.getElementById('v-add-ing').addEventListener('click', () => addIngredient());
    document.getElementById('form-validator').addEventListener('submit', onValidate);
    document.getElementById('v-autofix').addEventListener('click', onAutofix);
    document.getElementById('v-save').addEventListener('click', onSave);
  }

  function addIngredient(preset = {}) {
    const cont = document.getElementById('v-ingredients');
    const row = document.createElement('div');
    row.className = 'ingredient-row';
    row.innerHTML = `
      <input type="text" class="ing-name" placeholder="Ingrediente" value="${escapeHtml(preset.nombre || '')}" />
      <input type="text" class="ing-quantity" placeholder="120 g" value="${escapeHtml(preset.cantidad || '')}" />
      <select class="ing-type">
        <option value="">(tipo)</option>
        ${ING_TYPES.map(t => `<option value="${t}" ${preset.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}
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

  function readRecipe() {
    const ingredientes = ingRows
      .map(row => ({
        nombre: row.querySelector('.ing-name').value.trim(),
        cantidad: row.querySelector('.ing-quantity').value.trim(),
        tipo: row.querySelector('.ing-type').value.trim() || undefined,
      }))
      .filter(i => i.nombre);
    return {
      nombre: document.getElementById('v-name').value.trim(),
      tipo_comida: document.getElementById('v-type').value,
      ingredientes,
      macros: {
        carbohidratos: document.getElementById('v-m-carbs').value || undefined,
        grasas: document.getElementById('v-m-fats').value || undefined,
        proteinas: document.getElementById('v-m-proteins').value || undefined,
      },
    };
  }

  // Used by the Adjust view to pass a pre-filled recipe.
  function loadRecipe(recipe) {
    exitEditMode();
    document.getElementById('v-name').value = recipe.nombre || '';
    document.getElementById('v-type').value = recipe.tipo_comida || 'comida';
    document.getElementById('v-ingredients').innerHTML = '';
    ingRows = [];
    (recipe.ingredientes || []).forEach(i => addIngredient(i));
    if (!ingRows.length) addIngredient();
    document.getElementById('v-m-carbs').value = recipe.macros?.carbohidratos || '';
    document.getElementById('v-m-fats').value = recipe.macros?.grasas || '';
    document.getElementById('v-m-proteins').value = recipe.macros?.proteinas || '';
    document.getElementById('v-result').innerHTML = `<p class="muted">Pulsa "Validar" para comprobar.</p>`;
    document.getElementById('v-save').disabled = true;
  }

  // Loads an existing recipe in edit mode (save will PUT).
  function editRecipe(recipe) {
    loadRecipe(recipe);
    editingName = recipe.nombre;
    const notice = document.getElementById('v-edit-notice');
    notice.innerHTML = `Editando <strong>${escapeHtml(recipe.nombre)}</strong>
      <button type="button" class="btn btn-ghost" id="v-cancel-edit">Cancelar edición</button>`;
    notice.classList.remove('hidden');
    document.getElementById('v-cancel-edit').addEventListener('click', () => {
      exitEditMode();
      loadRecipe({ nombre: '', tipo_comida: 'comida', ingredientes: [] });
    });
    document.getElementById('v-save').textContent = 'Actualizar receta';
    document.querySelector('.tab[data-tab="validator"]').click();
  }

  function exitEditMode() {
    editingName = null;
    const notice = document.getElementById('v-edit-notice');
    notice.classList.add('hidden');
    notice.innerHTML = '';
    document.getElementById('v-save').textContent = 'Guardar receta';
  }

  function onValidate(e) {
    e.preventDefault();
    const recipe = readRecipe();
    if (!recipe.nombre || !recipe.ingredientes.length) {
      return toast('Falta el nombre o los ingredientes', 'err');
    }
    const val = Blocks.validateRecipe(recipe);
    lastRecipe = recipe;
    lastValidation = val;
    renderResult(val, recipe);
    // Allow saving if there are no errors (even with warnings), because the
    // user may have reasons to deviate from the pattern.
    document.getElementById('v-save').disabled = !val.valid;
  }

  function onAutofix() {
    const recipe = readRecipe();
    if (!recipe.ingredientes.length) return toast('Añade al menos un ingrediente', 'err');
    const { adjusted, notes, error } = Blocks.adjustQuantities(recipe.ingredientes, recipe.tipo_comida);
    if (error) return toast(error, 'err');
    // Fill the rows with the new quantities
    adjusted.forEach((ing, idx) => {
      if (!ingRows[idx]) return;
      ingRows[idx].querySelector('.ing-quantity').value = ing.cantidad;
      if (ing.tipo && !ingRows[idx].querySelector('.ing-type').value) {
        ingRows[idx].querySelector('.ing-type').value = ing.tipo;
      }
    });
    toast('Cantidades ajustadas. Vuelve a validar.', 'ok');
    if (notes.length) {
      const box = document.getElementById('v-result');
      box.innerHTML = `
        <div class="suggestion-box">
          <h4>Notas del autocorrector</h4>
          <ul>${notes.map(n => `<li>${escapeHtml(n)}</li>`).join('')}</ul>
        </div>
      `;
    }
  }

  async function onSave() {
    if (!lastRecipe || !lastValidation?.valid) {
      return toast('Valida la receta antes de guardar', 'err');
    }
    const payload = {
      nombre: lastRecipe.nombre,
      tipo_comida: lastRecipe.tipo_comida,
      ingredientes: lastRecipe.ingredientes.map(i => ({
        nombre: i.nombre, cantidad: i.cantidad, tipo: i.tipo,
      })).filter(i => i.tipo),
      macros: Object.fromEntries(
        Object.entries(lastRecipe.macros || {}).filter(([, v]) => v)
      ),
    };
    try {
      if (editingName) {
        await Data.updateRecipe(editingName, payload);
        toast(`Receta "${payload.nombre}" actualizada`, 'ok');
        exitEditMode();
        if (typeof PlanView !== 'undefined') PlanView.refresh();
      } else {
        await Data.saveRecipe(payload);
        toast(`Receta "${payload.nombre}" guardada`, 'ok');
      }
      document.getElementById('v-save').disabled = true;
      await RecipesView.reload();
    } catch (err) {
      toast(err.message, 'err');
    }
  }

  function renderResult(val, recipe) {
    const box = document.getElementById('v-result');
    const status = val.fits
      ? `<div class="status ok"><strong>Encaja en el menú ✓</strong>La receta cumple el patrón de ${escapeHtml(recipe.tipo_comida)}.</div>`
      : val.valid
        ? `<div class="status warn"><strong>Guardable con reservas</strong>Hay avisos pero no errores bloqueantes. Revísalos.</div>`
        : `<div class="status err"><strong>No encaja</strong>Corrige los errores antes de guardar.</div>`;

    const rows = val.comparisons.map(c => {
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

    const table = `
      <table class="blocks-table">
        <thead><tr><th>Categoría</th><th>Actual</th><th>Objetivo</th><th>Δ</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    const issues = val.issues.length
      ? `<ul class="issues">${val.issues.map(i =>
          `<li class="${i.level}">${escapeHtml(i.msg)}</li>`
        ).join('')}</ul>`
      : `<p class="muted">Sin incidencias.</p>`;

    const breakdown = val.details.filter(d => d.blocks > 0 || d.free).map(d => `
      <li>${escapeHtml(d.name)} → <strong>${d.free ? 'libre' : d.blocks + ' bloques'}</strong>
      ${d.category ? `<span class="muted">(${Blocks.categoryLabel(d.category)})</span>` : ''}</li>
    `).join('');

    const unrecognized = val.details.filter(d => !d.recognized || d.unknown);
    const aiBlock = unrecognized.length ? `
      <div class="suggestion-box">
        <h4>Ingredientes no reconocidos</h4>
        <p class="muted">La IA puede calcular la equivalencia por bloques (categoría + gramos por bloque) para estos alimentos.</p>
        <ul class="ai-list">
          ${unrecognized.map(d => `
            <li>
              <span>${escapeHtml(d.name)}</span>
              <button type="button" class="btn btn-ghost btn-ai" data-name="${escapeHtml(d.name)}">Preguntar a IA</button>
            </li>
          `).join('')}
        </ul>
      </div>
    ` : '';

    box.innerHTML = `
      ${status}
      ${table}
      ${issues}
      ${aiBlock}
      <div class="suggestion-box">
        <h4>Desglose por ingrediente</h4>
        <ul>${breakdown || '<li class="muted">Sin datos</li>'}</ul>
      </div>
    `;

    box.querySelectorAll('.btn-ai').forEach(btn => {
      btn.addEventListener('click', () => askAI(btn));
    });
  }

  async function askAI(btn) {
    const name = btn.dataset.name;
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Consultando...';
    try {
      const { alias } = await Data.queryAI(name);
      const summary = alias.libre
        ? 'libre'
        : alias.gPorBloque != null
          ? `${alias.gPorBloque} g / bloque`
          : alias.unidadBloque != null
            ? `${alias.unidadBloque} ud / bloque`
            : '—';
      if (!confirm(`Propuesta para "${name}":\n\nCategoría: ${alias.cat}\nEquivalencia: ${summary}\n\n¿Aprobar y guardar?\n\nJustificación: ${alias.justificacion || '—'}`)) {
        btn.disabled = false;
        btn.textContent = original;
        return;
      }
      await Data.saveAlias(alias);
      Blocks.mergeAliases([alias]);
      if (typeof EquivalencesView !== 'undefined') EquivalencesView.refresh();
      toast(`"${alias.nombre}" añadido`, 'ok');
      // Re-validate with the freshly merged alias
      onValidate(new Event('submit'));
    } catch (err) {
      toast(err.message, 'err');
      btn.disabled = false;
      btn.textContent = original;
    }
  }

  return { init, loadRecipe, editRecipe };
})();
