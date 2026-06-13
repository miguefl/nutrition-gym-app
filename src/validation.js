// ======================================================================
// API input validation and sanitization.
// Each function returns { ok: true, value } with a NEW object holding only
// the whitelisted fields, or { ok: false, error }.
// Note: JSON/wire keys and enum values stay in Spanish on purpose (they mirror
// the persisted data model, which is left untouched). User-facing error
// messages are also Spanish. Only the code identifiers are in English.
// ======================================================================

const CATEGORIES = [
  'carbohidratos',
  'proteinas_magras',
  'proteinas_grasas',
  'grasas',
  'fruta',
  'verduras',
];

const MEAL_TYPES = ['desayuno', 'comida', 'merienda', 'cena'];
const MACRO_LEVELS = ['bajo', 'medio', 'alto'];
const WEEK_DAYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const LOG_STATES = ['ok', 'fallo'];

const MAX_NAME = 100;
const MAX_QUANTITY = 50;
const MAX_TYPE = 50;
const MAX_CONTEXT = 300;
const MAX_JUSTIFICATION = 1000;
const MAX_INGREDIENTS = 30;
const MAX_SOURCES = 10;
const MAX_URL = 300;
const MAX_SUGGESTION_INGREDIENTS = 15;

function isStr(v, max) {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= max;
}

function numOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined; // undefined = invalid
}

function fail(error) {
  return { ok: false, error };
}

// ---------- Recipe ----------
function validateRecipe(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail('Cuerpo inválido: se esperaba un objeto receta.');
  }
  if (!isStr(body.nombre, MAX_NAME)) {
    return fail(`"nombre" es obligatorio (string, máx. ${MAX_NAME} caracteres).`);
  }
  if (!MEAL_TYPES.includes(body.tipo_comida)) {
    return fail(`"tipo_comida" debe ser uno de: ${MEAL_TYPES.join(', ')}.`);
  }
  if (!Array.isArray(body.ingredientes) || body.ingredientes.length === 0) {
    return fail('"ingredientes" debe ser un array no vacío.');
  }
  if (body.ingredientes.length > MAX_INGREDIENTS) {
    return fail(`Demasiados ingredientes (máx. ${MAX_INGREDIENTS}).`);
  }

  const ingredients = [];
  for (const ing of body.ingredientes) {
    if (!ing || typeof ing !== 'object' || !isStr(ing.nombre, MAX_NAME)) {
      return fail(`Cada ingrediente necesita "nombre" (string, máx. ${MAX_NAME}).`);
    }
    const clean = { nombre: ing.nombre.trim() };
    if (ing.cantidad !== undefined && ing.cantidad !== '') {
      if (typeof ing.cantidad !== 'string' || ing.cantidad.length > MAX_QUANTITY) {
        return fail(`"cantidad" de "${clean.nombre}" inválida (string, máx. ${MAX_QUANTITY}).`);
      }
      clean.cantidad = ing.cantidad.trim();
    }
    if (ing.tipo !== undefined && ing.tipo !== '') {
      if (typeof ing.tipo !== 'string' || ing.tipo.length > MAX_TYPE) {
        return fail(`"tipo" de "${clean.nombre}" inválido (string, máx. ${MAX_TYPE}).`);
      }
      clean.tipo = ing.tipo.trim();
    }
    ingredients.push(clean);
  }

  const macros = {};
  if (body.macros !== undefined) {
    if (typeof body.macros !== 'object' || body.macros === null || Array.isArray(body.macros)) {
      return fail('"macros" debe ser un objeto.');
    }
    for (const key of ['carbohidratos', 'grasas', 'proteinas']) {
      const v = body.macros[key];
      if (v === undefined || v === '') continue;
      if (!MACRO_LEVELS.includes(v)) {
        return fail(`macros.${key} debe ser uno de: ${MACRO_LEVELS.join(', ')}.`);
      }
      macros[key] = v;
    }
  }

  return {
    ok: true,
    value: {
      nombre: body.nombre.trim(),
      tipo_comida: body.tipo_comida,
      ingredientes: ingredients,
      macros,
    },
  };
}

// ---------- Alias / equivalence ----------
function isHttpUrl(s) {
  if (typeof s !== 'string' || s.length > MAX_URL) return false;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function validateAlias(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail('Cuerpo inválido: se esperaba un objeto alias.');
  }
  if (!isStr(body.nombre, MAX_NAME)) {
    return fail(`"nombre" es obligatorio (string, máx. ${MAX_NAME} caracteres).`);
  }
  if (!CATEGORIES.includes(body.cat)) {
    return fail(`"cat" debe ser una de: ${CATEGORIES.join(', ')}.`);
  }

  const gPorBloque = numOrNull(body.gPorBloque);
  const unidadBloque = numOrNull(body.unidadBloque);
  const gramosPorUnidad = numOrNull(body.gramosPorUnidad);
  if (gPorBloque === undefined) return fail('"gPorBloque" debe ser un número positivo o null.');
  if (unidadBloque === undefined) return fail('"unidadBloque" debe ser un número positivo o null.');
  if (gramosPorUnidad === undefined) return fail('"gramosPorUnidad" debe ser un número positivo o null.');

  const libre = !!body.libre;
  if (!libre && gPorBloque === null && unidadBloque === null) {
    return fail('Indica gPorBloque o unidadBloque (o marca el alimento como libre).');
  }

  let justificacion = '';
  if (body.justificacion !== undefined && body.justificacion !== '') {
    if (typeof body.justificacion !== 'string' || body.justificacion.length > MAX_JUSTIFICATION) {
      return fail(`"justificacion" inválida (string, máx. ${MAX_JUSTIFICATION}).`);
    }
    justificacion = body.justificacion.trim();
  }

  let fuentes = [];
  if (body.fuentes !== undefined) {
    if (!Array.isArray(body.fuentes) || body.fuentes.length > MAX_SOURCES) {
      return fail(`"fuentes" debe ser un array (máx. ${MAX_SOURCES}).`);
    }
    fuentes = body.fuentes.filter(isHttpUrl);
  }

  return {
    ok: true,
    value: {
      nombre: body.nombre.trim().toLowerCase(),
      cat: body.cat,
      gPorBloque,
      unidadBloque,
      gramosPorUnidad,
      libre,
      justificacion,
      fuentes,
    },
  };
}

// ---------- AI query ----------
function validateAIQuery(body) {
  if (!body || typeof body !== 'object') {
    return fail('Cuerpo inválido.');
  }
  if (!isStr(body.nombre, MAX_NAME)) {
    return fail(`"nombre" es obligatorio (string, máx. ${MAX_NAME} caracteres).`);
  }
  let contexto;
  if (body.contexto !== undefined && body.contexto !== '') {
    if (typeof body.contexto !== 'string' || body.contexto.length > MAX_CONTEXT) {
      return fail(`"contexto" inválido (string, máx. ${MAX_CONTEXT}).`);
    }
    contexto = body.contexto.trim();
  }
  return { ok: true, value: { nombre: body.nombre.trim(), contexto } };
}

// ---------- Weekly plan ----------
function validatePlan(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail('Cuerpo inválido: se esperaba un objeto plan.');
  }
  const plan = {};
  for (const day of WEEK_DAYS) {
    const d = body[day];
    plan[day] = {};
    if (d !== undefined && (typeof d !== 'object' || d === null || Array.isArray(d))) {
      return fail(`"${day}" debe ser un objeto { comida: receta|null }.`);
    }
    for (const meal of MEAL_TYPES) {
      const v = d?.[meal];
      if (v === undefined || v === null || v === '') {
        plan[day][meal] = null;
      } else if (isStr(v, MAX_NAME)) {
        plan[day][meal] = v.trim();
      } else {
        return fail(`${day}.${meal} debe ser el nombre de una receta (string, máx. ${MAX_NAME}) o null.`);
      }
    }
  }
  return { ok: true, value: plan };
}

// ---------- Adherence log ----------
function validateLogEntry(date, body) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    return fail('Fecha inválida: usa el formato YYYY-MM-DD.');
  }
  if (!body || typeof body !== 'object') return fail('Cuerpo inválido.');
  if (!MEAL_TYPES.includes(body.comida)) {
    return fail(`"comida" debe ser una de: ${MEAL_TYPES.join(', ')}.`);
  }
  const state = body.estado === null || body.estado === undefined || body.estado === ''
    ? null
    : body.estado;
  if (state !== null && !LOG_STATES.includes(state)) {
    return fail(`"estado" debe ser "ok", "fallo" o null (para borrar la marca).`);
  }
  return { ok: true, value: { fecha: date, comida: body.comida, estado: state } };
}

// ---------- AI recipe suggestion ----------
function validateRecipeSuggestion(body) {
  if (!body || typeof body !== 'object') return fail('Cuerpo inválido.');
  if (!MEAL_TYPES.includes(body.tipo_comida)) {
    return fail(`"tipo_comida" debe ser uno de: ${MEAL_TYPES.join(', ')}.`);
  }
  if (!Array.isArray(body.ingredientes) || body.ingredientes.length === 0) {
    return fail('"ingredientes" debe ser un array no vacío de nombres.');
  }
  if (body.ingredientes.length > MAX_SUGGESTION_INGREDIENTS) {
    return fail(`Demasiados ingredientes (máx. ${MAX_SUGGESTION_INGREDIENTS}).`);
  }
  const ingredients = [];
  for (const ing of body.ingredientes) {
    if (!isStr(ing, MAX_NAME)) {
      return fail(`Cada ingrediente debe ser un string (máx. ${MAX_NAME} caracteres).`);
    }
    ingredients.push(ing.trim());
  }
  let contexto;
  if (body.contexto !== undefined && body.contexto !== '') {
    if (typeof body.contexto !== 'string' || body.contexto.length > MAX_CONTEXT) {
      return fail(`"contexto" inválido (string, máx. ${MAX_CONTEXT}).`);
    }
    contexto = body.contexto.trim();
  }
  return { ok: true, value: { tipo_comida: body.tipo_comida, ingredientes: ingredients, contexto } };
}

// ---------- Name route param ----------
function validateNameParam(name) {
  if (!isStr(name, MAX_NAME)) {
    return fail(`Nombre inválido (string, máx. ${MAX_NAME} caracteres).`);
  }
  return { ok: true, value: name.trim() };
}

module.exports = {
  CATEGORIES,
  MEAL_TYPES,
  WEEK_DAYS,
  validateRecipe,
  validateAlias,
  validateAIQuery,
  validatePlan,
  validateLogEntry,
  validateRecipeSuggestion,
  validateNameParam,
};
