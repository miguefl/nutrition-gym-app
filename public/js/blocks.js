// ======================================================================
// Block-method engine: equivalences, block math and recipe validation.
//
// Core idea: each food belongs to a category (carbohidratos, proteinas_magras,
// proteinas_grasas, grasas, fruta, verduras). Each category defines how many
// grams equal "1 block". A recipe is validated by summing blocks per category
// and comparing them with the target pattern for that meal type.
//
// Domain values (category names, meal types, food keys) and UI messages stay
// in Spanish on purpose; only the code identifiers are in English.
// ======================================================================

const Blocks = (() => {
  // ---------- Target pattern per meal type ----------
  // Derived from the user's current menu. These are the "ideal" blocks per
  // category. The validator allows small deviations.
  const PATTERN = {
    desayuno: {
      carbohidratos: 3,
      grasas: 1,
      proteinas: 1, // lean + fat
    },
    comida: {
      carbohidratos: 3,
      grasas: 1,
      proteinas: 2,
    },
    cena: {
      carbohidratos: 3,
      grasas: 1,
      proteinas: 2,
    },
    merienda: {
      proteinas: 1,
      fruta: 1,
    },
  };

  // Block tolerance (max deviation accepted without a warning).
  const TOLERANCE = 0.4;

  // ---------- Ingredient → equivalence mapping ----------
  // When a name does not match an entry in equivalencias.json we use these
  // aliases. `cat` = category; the rest is the reference used to compute
  // blocks (grams or units per 1 block).
  const ALIASES = {
    'pan': { cat: 'carbohidratos', gPorBloque: 40 },
    'tortilla de trigo': { cat: 'carbohidratos', gPorBloque: 40 },
    'arroz': { cat: 'carbohidratos', gPorBloque: 30 },
    'pasta': { cat: 'carbohidratos', gPorBloque: 30 },
    'quinoa': { cat: 'carbohidratos', gPorBloque: 30 },
    'lentejas': { cat: 'carbohidratos', gPorBloque: 30 },
    'garbanzos': { cat: 'carbohidratos', gPorBloque: 30 },
    'alubias': { cat: 'carbohidratos', gPorBloque: 30 },
    'patata': { cat: 'carbohidratos', gPorBloque: 120 },
    'boniato': { cat: 'carbohidratos', gPorBloque: 120 },

    'pollo': { cat: 'proteinas_magras', gPorBloque: 100 },
    'pavo': { cat: 'proteinas_magras', gPorBloque: 100 },
    'ternera magra': { cat: 'proteinas_magras', gPorBloque: 100 },
    'carne picada': { cat: 'proteinas_magras', gPorBloque: 100 },
    'lomo de cerdo': { cat: 'proteinas_magras', gPorBloque: 90 },
    'seitan': { cat: 'proteinas_magras', gPorBloque: 90 },
    'seitán': { cat: 'proteinas_magras', gPorBloque: 90 },
    'atun natural': { cat: 'proteinas_magras', gPorBloque: 100 },
    'atún natural': { cat: 'proteinas_magras', gPorBloque: 100 },
    'atun': { cat: 'proteinas_magras', gPorBloque: 100 },
    'atún': { cat: 'proteinas_magras', gPorBloque: 100 },
    'merluza': { cat: 'proteinas_magras', gPorBloque: 120 },
    'bacalao': { cat: 'proteinas_magras', gPorBloque: 120 },
    'pescado blanco': { cat: 'proteinas_magras', gPorBloque: 120 },
    'gambas': { cat: 'proteinas_magras', gPorBloque: 120 },
    'marisco': { cat: 'proteinas_magras', gPorBloque: 120 },
    'pulpo': { cat: 'proteinas_magras', gPorBloque: 120 },
    'queso fresco batido 0%': { cat: 'proteinas_magras', gPorBloque: 250 },
    'queso fresco batido': { cat: 'proteinas_magras', gPorBloque: 250 },
    'high protein pudding': { cat: 'proteinas_magras', gPorBloque: 250 },
    'queso fresco burgos': { cat: 'proteinas_magras', gPorBloque: 150 },
    'queso burgos': { cat: 'proteinas_magras', gPorBloque: 150 },

    'salmon': { cat: 'proteinas_grasas', gPorBloque: 50 },
    'salmón': { cat: 'proteinas_grasas', gPorBloque: 50 },
    'jamon serrano': { cat: 'proteinas_grasas', gPorBloque: 50 },
    'jamón serrano': { cat: 'proteinas_grasas', gPorBloque: 50 },
    'jamon iberico': { cat: 'proteinas_grasas', gPorBloque: 50 },
    'queso curado': { cat: 'proteinas_grasas', gPorBloque: 25 },
    'parmesano': { cat: 'proteinas_grasas', gPorBloque: 25 },
    'tofu': { cat: 'proteinas_grasas', gPorBloque: 100 },
    'huevo': { cat: 'proteinas_grasas', gPorBloque: null, unidadBloque: 1, gramosPorUnidad: 60 },
    'carne kebab': { cat: 'proteinas_grasas', gPorBloque: 50 },

    'aceite de oliva': { cat: 'grasas', gPorBloque: 10 },
    'aceite': { cat: 'grasas', gPorBloque: 10 },
    'frutos secos': { cat: 'grasas', gPorBloque: 15 },
    'almendras': { cat: 'grasas', gPorBloque: 15 },
    'nueces': { cat: 'grasas', gPorBloque: 15 },
    'aguacate': { cat: 'grasas', gPorBloque: 50 },
    'guacamole': { cat: 'grasas', gPorBloque: 50 },
    'mantequilla de cacahuete': { cat: 'grasas', gPorBloque: 15 },
    'chocolate 85%': { cat: 'grasas', gPorBloque: 20 },
    'salsa': { cat: 'grasas', gPorBloque: 10 },

    'fruta': { cat: 'fruta', gPorBloque: 175 }, // average of "small fruits"
    'manzana': { cat: 'fruta', gPorBloque: null, unidadBloque: 1, gramosPorUnidad: 180 },
    'plátano': { cat: 'fruta', gPorBloque: null, unidadBloque: 1, gramosPorUnidad: 120 },
    'platano': { cat: 'fruta', gPorBloque: null, unidadBloque: 1, gramosPorUnidad: 120 },
    'naranja': { cat: 'fruta', gPorBloque: null, unidadBloque: 1, gramosPorUnidad: 180 },
    'pera': { cat: 'fruta', gPorBloque: null, unidadBloque: 1, gramosPorUnidad: 180 },
    'kiwi': { cat: 'fruta', gPorBloque: null, unidadBloque: 2, gramosPorUnidad: 80 },
    'fresa': { cat: 'fruta', gPorBloque: 175 },
    'fresas': { cat: 'fruta', gPorBloque: 175 },
    'arandanos': { cat: 'fruta', gPorBloque: 175 },
    'arándanos': { cat: 'fruta', gPorBloque: 175 },
    'frambuesas': { cat: 'fruta', gPorBloque: 175 },
    'moras': { cat: 'fruta', gPorBloque: 175 },

    'berenjena': { cat: 'verduras', libre: true },
    'calabacin': { cat: 'verduras', libre: true },
    'calabacín': { cat: 'verduras', libre: true },
    'pimiento': { cat: 'verduras', libre: true },
    'tomate': { cat: 'verduras', libre: true },
    'cebolla': { cat: 'verduras', libre: true },
    'lechuga': { cat: 'verduras', libre: true },
    'espinacas': { cat: 'verduras', libre: true },
    'brócoli': { cat: 'verduras', libre: true },
    'brocoli': { cat: 'verduras', libre: true },
    'champiñones': { cat: 'verduras', libre: true },
    'champinones': { cat: 'verduras', libre: true },
    'zanahoria': { cat: 'verduras', libre: true },
  };

  // Maps the ingredient "tipo" field (in recetas.json) to a category.
  const TYPE_TO_CATEGORY = {
    'cereales': 'carbohidratos',
    'legumbres': 'carbohidratos',
    'tuberculos': 'carbohidratos',
    'tubérculos': 'carbohidratos',
    'carne blanca': 'proteinas_magras',
    'pescado blanco': 'proteinas_magras',
    'pescado azul': 'proteinas_grasas',
    'marisco': 'proteinas_magras',
    'lacteos proteicos': 'proteinas_magras',
    'lácteos proteicos': 'proteinas_magras',
    'carne procesada': 'proteinas_grasas',
    'huevo': 'proteinas_grasas',
    'carne roja': 'proteinas_magras', // assume lean cuts; mark fat ones by hand
    'lacteos grasos': 'proteinas_grasas',
    'lácteos grasos': 'proteinas_grasas',
    'grasas': 'grasas',
    'grasas vegetales': 'grasas',
    'fruta': 'fruta',
    'verdura': 'verduras',
    'verduras': 'verduras',
  };

  // ---------- Helpers ----------
  function normalize(str) {
    return String(str || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .trim();
  }

  function parseQuantity(str) {
    // "120 g" → { value: 120, unit: 'g' }
    // "1 unidad" → { value: 1, unit: 'unidad' }
    // "150-200 g" → { value: 175, unit: 'g' } (average)
    // "libre" → { value: null, unit: 'libre' }
    if (!str) return { value: null, unit: null };
    const s = String(str).toLowerCase().trim();
    if (s === 'libre') return { value: null, unit: 'libre' };
    const range = s.match(/([\d.]+)\s*-\s*([\d.]+)\s*([a-z]+)/);
    if (range) {
      const a = parseFloat(range[1]);
      const b = parseFloat(range[2]);
      return { value: (a + b) / 2, unit: range[3] };
    }
    const m = s.match(/([\d.]+)\s*([a-z]+)?/);
    if (!m) return { value: null, unit: null };
    const value = parseFloat(m[1]);
    let unit = m[2] || 'g';
    if (unit.startsWith('unid')) unit = 'unidad';
    if (unit === 'u') unit = 'unidad';
    if (unit === 'kg') return { value: value * 1000, unit: 'g' };
    return { value, unit };
  }

  function findAlias(name, type) {
    const key = normalize(name);
    if (ALIASES[key]) return ALIASES[key];
    // substring: "jamón serrano de bodega" → jamón serrano
    const keys = Object.keys(ALIASES).sort((a, b) => b.length - a.length);
    const hit = keys.find(k => key.includes(k));
    if (hit) return ALIASES[hit];
    // fallback by type
    if (type) {
      const cat = TYPE_TO_CATEGORY[normalize(type)];
      if (cat === 'verduras') return { cat, libre: true };
      if (cat) return { cat, gPorBloque: null, unknown: true };
    }
    return null;
  }

  // ---------- Block computation ----------
  function calcIngredientBlocks(ing) {
    const alias = findAlias(ing.nombre, ing.tipo);
    if (!alias) {
      return { recognized: false, category: null, blocks: 0, name: ing.nombre };
    }
    if (alias.libre) {
      return { recognized: true, category: alias.cat, blocks: 0, free: true, name: ing.nombre };
    }
    const q = parseQuantity(ing.cantidad);
    if (q.value == null) {
      return { recognized: true, category: alias.cat, blocks: 0, name: ing.nombre, error: 'Cantidad inválida' };
    }
    let blocks = 0;
    if (q.unit === 'unidad' && alias.unidadBloque) {
      blocks = q.value / alias.unidadBloque;
    } else if (q.unit === 'unidad' && alias.gramosPorUnidad && alias.gPorBloque == null) {
      // egg: 1 unit = 1 block
      blocks = q.value;
    } else if (alias.gPorBloque) {
      // If units were given but we expect grams, convert via gramosPorUnidad
      let grams = q.value;
      if (q.unit === 'unidad' && alias.gramosPorUnidad) {
        grams = q.value * alias.gramosPorUnidad;
      }
      blocks = grams / alias.gPorBloque;
    } else if (alias.unknown) {
      // Known category but unknown quantity/equivalence
      return { recognized: true, category: alias.cat, blocks: 0, name: ing.nombre, unknown: true };
    }
    return {
      recognized: true,
      category: alias.cat,
      blocks: Math.round(blocks * 100) / 100,
      parsedQuantity: q,
      alias,
      name: ing.nombre,
    };
  }

  // ---------- Aggregate blocks per recipe ----------
  function summarizeBlocks(ingredients) {
    const summary = {
      carbohidratos: 0,
      proteinas_magras: 0,
      proteinas_grasas: 0,
      grasas: 0,
      fruta: 0,
      verduras: 0,
    };
    const details = [];
    const sourcesByCat = {}; // to detect mixes
    for (const ing of ingredients) {
      const d = calcIngredientBlocks(ing);
      details.push(d);
      if (!d.category) continue;
      summary[d.category] = (summary[d.category] || 0) + (d.blocks || 0);
      if (!d.free && d.blocks > 0) {
        sourcesByCat[d.category] = sourcesByCat[d.category] || new Set();
        sourcesByCat[d.category].add(normalize(d.name));
      }
    }
    summary.proteinas_total = round2(summary.proteinas_magras + summary.proteinas_grasas);
    Object.keys(summary).forEach(k => { summary[k] = round2(summary[k]); });
    return { summary, details, sourcesByCat };
  }

  // ---------- Validate recipe against pattern ----------
  function validateRecipe(recipe) {
    const { summary, details, sourcesByCat } = summarizeBlocks(recipe.ingredientes || []);
    const pattern = PATTERN[recipe.tipo_comida];
    const issues = [];

    if (!pattern) {
      issues.push({ level: 'err', msg: `Tipo de comida desconocido: "${recipe.tipo_comida}"` });
    }

    // Unrecognized ingredients
    details.forEach(d => {
      if (!d.recognized) {
        issues.push({ level: 'warn', msg: `Ingrediente no reconocido: "${d.name}". Añádelo como alias o indica su tipo.` });
      } else if (d.unknown) {
        issues.push({ level: 'warn', msg: `No sé cuántos gramos son 1 bloque de "${d.name}". Calcula bloques manualmente.` });
      } else if (d.error) {
        issues.push({ level: 'err', msg: `"${d.name}": ${d.error}` });
      }
    });

    // Comparison against pattern
    const comparisons = [];
    if (pattern) {
      for (const cat of Object.keys(pattern)) {
        let current;
        if (cat === 'proteinas') current = summary.proteinas_total;
        else current = summary[cat] || 0;
        const target = pattern[cat];
        const diff = round2(current - target);
        const abs = Math.abs(diff);
        const state = abs <= TOLERANCE ? 'ok' : (abs <= TOLERANCE * 2 ? 'warn' : 'err');
        comparisons.push({ category: cat, current, target, diff, state });
        if (state !== 'ok') {
          const direction = diff > 0 ? 'te pasas' : 'te falta';
          issues.push({
            level: state,
            msg: `${categoryLabel(cat)}: ${current} bloques (objetivo ${target}). ${direction} ${Math.abs(diff)} bloques.`,
          });
        }
      }
    }

    // Global rules (do not mix sources)
    const forbiddenMixes = ['carbohidratos', 'grasas'];
    for (const cat of forbiddenMixes) {
      const n = sourcesByCat[cat]?.size || 0;
      if (n > 1) {
        const sources = [...sourcesByCat[cat]].join(', ');
        issues.push({
          level: 'warn',
          msg: `Mezclas varias fuentes de ${categoryLabel(cat)}: ${sources}. La regla dice usar solo una por comida.`,
        });
      }
    }

    // Snack: fruit and lean protein are key
    if (recipe.tipo_comida === 'merienda') {
      if (summary.proteinas_grasas > 0.2) {
        issues.push({ level: 'warn', msg: 'En merienda suele usarse proteína magra (no grasa).' });
      }
    }

    // Too much fat protein in lunch/dinner
    if (['comida', 'cena'].includes(recipe.tipo_comida)) {
      if (summary.proteinas_grasas > 0 && summary.proteinas_magras > 0) {
        issues.push({
          level: 'warn',
          msg: 'Mezclas proteína magra y grasa. Se suele elegir una fuente principal.',
        });
      }
    }

    const valid = !issues.some(i => i.level === 'err');
    const fits = !issues.some(i => i.level === 'err' || i.level === 'warn');

    return { valid, fits, summary, details, comparisons, issues };
  }

  // ---------- Auto-fix quantities ----------
  // Given ingredients + meal type, compute the ideal quantities proportionally
  // to the pattern. Strategy: group ingredients by category, split the target
  // blocks among that category's ingredients evenly, then convert blocks to
  // grams/units via the alias.
  function adjustQuantities(ingredients, mealType) {
    const pattern = PATTERN[mealType];
    if (!pattern) return { error: `Tipo de comida desconocido: "${mealType}"` };

    const groups = {};
    ingredients.forEach((ing, idx) => {
      const alias = findAlias(ing.nombre, ing.tipo);
      const cat = alias?.cat;
      if (!cat) {
        groups._unrecognized = groups._unrecognized || [];
        groups._unrecognized.push({ ...ing, idx });
        return;
      }
      groups[cat] = groups[cat] || [];
      groups[cat].push({ ...ing, idx, alias });
    });

    const adjusted = ingredients.map(i => ({ ...i }));
    const notes = [];

    for (const [patternCat, targetBlocks] of Object.entries(pattern)) {
      const cats = patternCat === 'proteinas'
        ? ['proteinas_magras', 'proteinas_grasas']
        : [patternCat];
      // Take the ingredients of any of those categories
      const catIngs = cats.flatMap(c => groups[c] || []);
      if (catIngs.length === 0) {
        notes.push(`Falta fuente de ${categoryLabel(patternCat)}: el menú espera ${targetBlocks} bloques.`);
        continue;
      }
      // Split evenly
      const blocksPerIng = targetBlocks / catIngs.length;
      catIngs.forEach(ing => {
        const grams = blocksToGrams(blocksPerIng, ing.alias);
        adjusted[ing.idx].cantidad = grams.cantidad;
        adjusted[ing.idx].tipo = adjusted[ing.idx].tipo || inferTypeFromAlias(ing.alias.cat);
      });
      if (cats.includes('proteinas_magras') && cats.includes('proteinas_grasas')) {
        const lean = (groups.proteinas_magras || []).length;
        const fat = (groups.proteinas_grasas || []).length;
        if (lean > 0 && fat > 0) {
          notes.push('Mezclas proteína magra y grasa; considera elegir solo una fuente.');
        }
      }
    }

    // Categories present but not in the pattern (e.g. verduras)
    for (const [cat, ings] of Object.entries(groups)) {
      if (cat === '_unrecognized') continue;
      const inPattern = Object.keys(pattern).some(k =>
        k === cat || (k === 'proteinas' && cat.startsWith('proteinas_'))
      );
      if (!inPattern) {
        ings.forEach(ing => {
          if (ing.alias.libre) {
            adjusted[ing.idx].cantidad = 'libre';
          }
        });
      }
    }

    if (groups._unrecognized) {
      groups._unrecognized.forEach(ing => {
        notes.push(`No reconozco "${ing.nombre}". Indica su tipo para poder ajustarlo.`);
      });
    }

    return { adjusted, notes };
  }

  function blocksToGrams(blocks, alias) {
    if (alias.unidadBloque && alias.gPorBloque == null) {
      // egg: 1 block = 1 unit
      const u = Math.round(blocks * alias.unidadBloque);
      return { cantidad: `${u} unidad${u !== 1 ? 'es' : ''}` };
    }
    if (alias.gPorBloque) {
      const g = Math.round(blocks * alias.gPorBloque);
      return { cantidad: `${g} g` };
    }
    return { cantidad: 'libre' };
  }

  function inferTypeFromAlias(cat) {
    const map = {
      carbohidratos: 'cereales',
      proteinas_magras: 'carne blanca',
      proteinas_grasas: 'carne procesada',
      grasas: 'grasas',
      fruta: 'fruta',
      verduras: 'verdura',
    };
    return map[cat] || '';
  }

  function categoryLabel(cat) {
    const l = {
      carbohidratos: 'Carbohidratos',
      proteinas_magras: 'Proteínas magras',
      proteinas_grasas: 'Proteínas grasas',
      proteinas: 'Proteínas',
      grasas: 'Grasas',
      fruta: 'Fruta',
      verduras: 'Verduras',
    };
    return l[cat] || cat;
  }

  function round2(n) { return Math.round(n * 100) / 100; }

  // Mark the "builtin" aliases on load, to tell them apart from the dynamic
  // aliases added by the user.
  const BUILTIN_KEYS = new Set(Object.keys(ALIASES));

  // Merge dynamic aliases (approved by the user via AI).
  // Each entry: { nombre, cat, gPorBloque?, unidadBloque?, gramosPorUnidad?, libre? }
  const VALID_CATS = new Set([
    'carbohidratos', 'proteinas_magras', 'proteinas_grasas',
    'grasas', 'fruta', 'verduras',
  ]);
  const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

  function positive(v) {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function mergeAliases(list) {
    if (!Array.isArray(list)) return;
    for (const a of list) {
      if (!a || typeof a.nombre !== 'string' || !VALID_CATS.has(a.cat)) continue;
      const key = normalize(a.nombre);
      if (!key || FORBIDDEN_KEYS.has(key)) continue;
      ALIASES[key] = {
        cat: a.cat,
        gPorBloque: positive(a.gPorBloque),
        unidadBloque: positive(a.unidadBloque) ?? undefined,
        gramosPorUnidad: positive(a.gramosPorUnidad) ?? undefined,
        libre: !!a.libre,
      };
    }
  }

  // Removes a dynamic alias (builtins cannot be removed).
  function removeAlias(name) {
    const key = normalize(name);
    if (BUILTIN_KEYS.has(key)) return false;
    return delete ALIASES[key];
  }

  // Returns all current aliases in a uniform shape for the UI.
  function listAliases() {
    return Object.entries(ALIASES).map(([nombre, a]) => ({
      nombre,
      cat: a.cat,
      gPorBloque: a.gPorBloque ?? null,
      unidadBloque: a.unidadBloque ?? null,
      gramosPorUnidad: a.gramosPorUnidad ?? null,
      libre: !!a.libre,
      builtin: BUILTIN_KEYS.has(nombre),
    }));
  }

  return {
    PATTERN,
    validateRecipe,
    summarizeBlocks,
    calcIngredientBlocks,
    adjustQuantities,
    parseQuantity,
    categoryLabel,
    normalize,
    mergeAliases,
    removeAlias,
    listAliases,
    TYPE_TO_CATEGORY,
    ALIASES,
  };
})();
