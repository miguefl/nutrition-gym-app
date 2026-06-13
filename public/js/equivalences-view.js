// "Equivalences" view: lists all known equivalences (builtin + dynamic) and
// lets the user query the AI to add new ones.
const EquivalencesView = (() => {
  const CATS = [
    'carbohidratos', 'proteinas_magras', 'proteinas_grasas',
    'grasas', 'fruta', 'verduras',
  ];

  let lastProposal = null;

  async function init() {
    document.getElementById('form-ai').addEventListener('submit', onQuery);
    document.getElementById('eq-filter').addEventListener('input', renderList);
    renderList();
  }

  function renderList() {
    const box = document.getElementById('eq-list');
    const filter = Blocks.normalize(document.getElementById('eq-filter').value);
    const all = Blocks.listAliases()
      .filter(a => !filter || a.nombre.includes(filter) || a.cat.includes(filter))
      .sort((a, b) => {
        if (a.builtin !== b.builtin) return a.builtin ? 1 : -1;
        if (a.cat !== b.cat) return a.cat.localeCompare(b.cat);
        return a.nombre.localeCompare(b.nombre);
      });

    if (!all.length) {
      box.innerHTML = '<p class="muted">No hay equivalencias que coincidan.</p>';
      return;
    }

    const rows = all.map(a => {
      const equiv = a.libre
        ? '<span class="tag">libre</span>'
        : a.gPorBloque != null
          ? `${escapeHtml(a.gPorBloque)} g / bloque`
          : a.unidadBloque != null
            ? `${escapeHtml(a.unidadBloque)} unidad${a.unidadBloque !== 1 ? 'es' : ''} / bloque`
            : '—';
      const source = a.builtin
        ? '<span class="tag tag-muted">builtin</span>'
        : '<span class="tag tag-ok">aprobado</span>';
      const action = a.builtin
        ? ''
        : `<button type="button" class="btn-icon eq-delete" data-name="${escapeHtml(a.nombre)}" title="Borrar">🗑</button>`;
      return `
        <tr>
          <td>${escapeHtml(a.nombre)}</td>
          <td>${escapeHtml(Blocks.categoryLabel(a.cat))}</td>
          <td>${equiv}</td>
          <td>${source}</td>
          <td>${action}</td>
        </tr>
      `;
    }).join('');

    box.innerHTML = `
      <table class="equiv-table">
        <thead><tr><th>Alimento</th><th>Categoría</th><th>Equivalencia</th><th>Origen</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    box.querySelectorAll('.eq-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const name = btn.dataset.name;
        if (!confirm(`¿Borrar la equivalencia "${name}"?`)) return;
        try {
          await Data.deleteAlias(name);
          Blocks.removeAlias(name);
          toast(`"${name}" borrada`, 'ok');
          renderList();
        } catch (err) {
          toast(err.message, 'err');
        }
      });
    });
  }

  async function onQuery(e) {
    e.preventDefault();
    const name = document.getElementById('ai-name').value.trim();
    const context = document.getElementById('ai-context').value.trim();
    if (!name) return;
    const btn = document.getElementById('ai-submit');
    const box = document.getElementById('ai-result');
    btn.disabled = true;
    btn.textContent = 'Consultando...';
    box.innerHTML = '<p class="muted">La IA está calculando la equivalencia (puede tardar unos segundos)...</p>';
    try {
      const { alias } = await Data.queryAI(name, context || undefined);
      lastProposal = alias;
      renderProposal(alias);
    } catch (err) {
      box.innerHTML = `<div class="status err"><strong>Error:</strong> ${escapeHtml(err.message)}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Consultar IA';
    }
  }

  function renderProposal(a) {
    const box = document.getElementById('ai-result');
    const sources = (a.fuentes || []).map(f =>
      `<li><a href="${escapeHtml(f)}" target="_blank" rel="noopener">${escapeHtml(f)}</a></li>`
    ).join('');

    const catOpts = CATS.map(c =>
      `<option value="${c}" ${c === a.cat ? 'selected' : ''}>${Blocks.categoryLabel(c)}</option>`
    ).join('');

    box.innerHTML = `
      <div class="status ok"><strong>Propuesta de la IA</strong></div>
      <div class="suggestion-box">
        <div class="field">
          <label>Nombre normalizado</label>
          <input type="text" id="p-name" value="${escapeHtml(a.nombre)}" />
        </div>
        <div class="field">
          <label>Categoría</label>
          <select id="p-cat">${catOpts}</select>
        </div>
        <div class="macros-inputs">
          <div class="field">
            <label>g / bloque</label>
            <input type="number" step="0.1" id="p-gpb" value="${a.gPorBloque ?? ''}" />
          </div>
          <div class="field">
            <label>unidades / bloque</label>
            <input type="number" step="0.1" id="p-ub" value="${a.unidadBloque ?? ''}" />
          </div>
          <div class="field">
            <label>g / unidad</label>
            <input type="number" step="0.1" id="p-gpu" value="${a.gramosPorUnidad ?? ''}" />
          </div>
        </div>
        <div class="field">
          <label><input type="checkbox" id="p-free" ${a.libre ? 'checked' : ''}/> Libre (sin bloques)</label>
        </div>
        <div class="field">
          <label>Justificación</label>
          <textarea id="p-just" rows="3">${escapeHtml(a.justificacion || '')}</textarea>
        </div>
        ${sources ? `<div class="field"><label>Fuentes</label><ul class="issues">${sources}</ul></div>` : ''}
        <div class="actions">
          <button type="button" class="btn btn-success" id="p-approve">Aprobar y guardar</button>
        </div>
      </div>
    `;
    document.getElementById('p-approve').addEventListener('click', approve);
  }

  async function approve() {
    const entry = {
      nombre: document.getElementById('p-name').value.trim(),
      cat: document.getElementById('p-cat').value,
      gPorBloque: numOrNull(document.getElementById('p-gpb').value),
      unidadBloque: numOrNull(document.getElementById('p-ub').value),
      gramosPorUnidad: numOrNull(document.getElementById('p-gpu').value),
      libre: document.getElementById('p-free').checked,
      justificacion: document.getElementById('p-just').value.trim(),
      fuentes: lastProposal?.fuentes || [],
    };
    if (!entry.nombre || !entry.cat) return toast('Nombre y categoría son obligatorios', 'err');
    try {
      await Data.saveAlias(entry);
      Blocks.mergeAliases([entry]);
      toast('Equivalencia guardada', 'ok');
      document.getElementById('ai-result').innerHTML = '';
      document.getElementById('ai-name').value = '';
      document.getElementById('ai-context').value = '';
      renderList();
    } catch (err) {
      toast(err.message, 'err');
    }
  }

  function numOrNull(v) {
    if (v === '' || v == null) return null;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }

  return { init, refresh: renderList };
})();
