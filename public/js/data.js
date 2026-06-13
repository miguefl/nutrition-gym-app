// Thin client for the backend API + in-memory cache.
// JSON payload keys stay in Spanish (they mirror the persisted data model).
const Data = (() => {
  let _recipes = null;
  let _equivalences = null;
  let _aliases = null;
  let _plan = null;
  let _log = null;

  async function fetchJson(url, opts) {
    const res = await fetch(url, opts);
    if (res.status === 401) {
      // Session expired or missing: notify the login gate.
      document.dispatchEvent(new CustomEvent('auth:expired'));
      throw new Error('Sesión no válida. Inicia sesión de nuevo.');
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `${res.status} ${res.statusText}`);
    }
    return res.json();
  }

  // ---------- Authentication ----------
  async function session() {
    return fetchJson('/api/auth/me');
  }

  async function login(username, password) {
    return fetchJson('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
  }

  async function logout() {
    return fetchJson('/api/auth/logout', { method: 'POST' });
  }

  async function changeCredentials(payload) {
    return fetchJson('/api/auth/change', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  // ---------- Recipes ----------
  async function recipes(force = false) {
    if (!_recipes || force) {
      _recipes = await fetchJson('/api/recipes');
    }
    return _recipes;
  }

  async function saveRecipe(recipe) {
    const saved = await fetchJson('/api/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(recipe),
    });
    _recipes = null;
    return saved;
  }

  async function updateRecipe(originalName, recipe) {
    const saved = await fetchJson(`/api/recipes/${encodeURIComponent(originalName)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(recipe),
    });
    _recipes = null;
    return saved;
  }

  async function deleteRecipe(name) {
    const res = await fetch(`/api/recipes/${encodeURIComponent(name)}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `${res.status} ${res.statusText}`);
    }
    _recipes = null;
  }

  // ---------- Equivalences & aliases ----------
  async function equivalences() {
    if (!_equivalences) {
      _equivalences = await fetchJson('/api/equivalences');
    }
    return _equivalences;
  }

  async function aliases(force = false) {
    if (!_aliases || force) {
      _aliases = await fetchJson('/api/aliases');
    }
    return _aliases;
  }

  async function saveAlias(a) {
    const saved = await fetchJson('/api/aliases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(a),
    });
    _aliases = null;
    return saved;
  }

  async function deleteAlias(name) {
    const res = await fetch(`/api/aliases/${encodeURIComponent(name)}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `${res.status} ${res.statusText}`);
    }
    _aliases = null;
  }

  // ---------- Weekly plan ----------
  async function plan(force = false) {
    if (!_plan || force) {
      _plan = await fetchJson('/api/plan');
    }
    return _plan;
  }

  async function savePlan(p) {
    const saved = await fetchJson('/api/plan', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    });
    _plan = saved;
    return saved;
  }

  // ---------- Adherence log ----------
  async function log(force = false) {
    if (!_log || force) {
      _log = await fetchJson('/api/log');
    }
    return _log;
  }

  async function markLog(date, meal, state) {
    const saved = await fetchJson(`/api/log/${encodeURIComponent(date)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comida: meal, estado: state }),
    });
    _log = null;
    return saved;
  }

  // ---------- AI ----------
  async function queryAI(name, context) {
    return fetchJson('/api/ai/equivalence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: name, contexto: context }),
    });
  }

  async function suggestRecipeAI(mealType, ingredients, context) {
    return fetchJson('/api/ai/recipe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo_comida: mealType, ingredientes: ingredients, contexto: context }),
    });
  }

  return {
    recipes, equivalences, aliases, plan, log,
    saveRecipe, updateRecipe, deleteRecipe,
    saveAlias, deleteAlias,
    savePlan, markLog,
    queryAI, suggestRecipeAI,
    session, login, logout, changeCredentials,
  };
})();
