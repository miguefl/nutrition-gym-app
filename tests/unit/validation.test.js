const { test } = require('node:test');
const assert = require('node:assert/strict');
const v = require('../../src/validation');

test('validateRecipe: accepts a valid recipe and whitelists fields', () => {
  const r = v.validateRecipe({
    nombre: '  Arroz con pollo ',
    tipo_comida: 'comida',
    ingredientes: [{ nombre: 'pollo', cantidad: '100 g', tipo: 'carne blanca', extra: 'x' }],
    macros: { proteinas: 'alto', basura: 'nope' },
    hack: true,
  });
  assert.equal(r.ok, true);
  assert.equal(r.value.nombre, 'Arroz con pollo'); // trimmed
  assert.deepEqual(Object.keys(r.value).sort(), ['ingredientes', 'macros', 'nombre', 'tipo_comida']);
  assert.equal(r.value.ingredientes[0].extra, undefined); // unknown field dropped
  assert.equal(r.value.macros.basura, undefined);
});

test('validateRecipe: rejects bad meal type and empty ingredients', () => {
  assert.equal(v.validateRecipe({ nombre: 'x', tipo_comida: 'brunch', ingredientes: [{ nombre: 'a' }] }).ok, false);
  assert.equal(v.validateRecipe({ nombre: 'x', tipo_comida: 'cena', ingredientes: [] }).ok, false);
  assert.equal(v.validateRecipe({ tipo_comida: 'cena', ingredientes: [{ nombre: 'a' }] }).ok, false);
});

test('validateRecipe: rejects oversized name', () => {
  const long = 'a'.repeat(101);
  assert.equal(v.validateRecipe({ nombre: long, tipo_comida: 'cena', ingredientes: [{ nombre: 'a' }] }).ok, false);
});

test('validateAlias: numbers, enum and source URLs', () => {
  const ok = v.validateAlias({ nombre: 'Kefir', cat: 'proteinas_magras', gPorBloque: 200, fuentes: ['https://x.com', 'javascript:alert(1)'] });
  assert.equal(ok.ok, true);
  assert.equal(ok.value.nombre, 'kefir'); // lowercased
  assert.deepEqual(ok.value.fuentes, ['https://x.com']); // non-http dropped

  assert.equal(v.validateAlias({ nombre: 'x', cat: 'bad', gPorBloque: 1 }).ok, false);
  assert.equal(v.validateAlias({ nombre: 'x', cat: 'grasas', gPorBloque: '<b>' }).ok, false);
  // neither quantity nor free → invalid
  assert.equal(v.validateAlias({ nombre: 'x', cat: 'grasas' }).ok, false);
  // free is acceptable without quantities
  assert.equal(v.validateAlias({ nombre: 'x', cat: 'verduras', libre: true }).ok, true);
});

test('validatePlan: normalizes days/meals and validates references shape', () => {
  const ok = v.validatePlan({ lunes: { desayuno: 'Tostadas', comida: '' }, basura: { x: 1 } });
  assert.equal(ok.ok, true);
  assert.equal(ok.value.lunes.desayuno, 'Tostadas');
  assert.equal(ok.value.lunes.comida, null);
  assert.equal(ok.value.basura, undefined); // unknown day dropped
  assert.ok('domingo' in ok.value); // all days present
});

test('validateLogEntry: date format and state enum', () => {
  assert.equal(v.validateLogEntry('2026-06-13', { comida: 'desayuno', estado: 'ok' }).ok, true);
  assert.equal(v.validateLogEntry('2026-06-13', { comida: 'desayuno', estado: null }).value.estado, null);
  assert.equal(v.validateLogEntry('13-06-2026', { comida: 'desayuno', estado: 'ok' }).ok, false);
  assert.equal(v.validateLogEntry('2026-06-13', { comida: 'brunch', estado: 'ok' }).ok, false);
  assert.equal(v.validateLogEntry('2026-06-13', { comida: 'cena', estado: 'maybe' }).ok, false);
});

test('validateRecipeSuggestion: array of ingredient names', () => {
  assert.equal(v.validateRecipeSuggestion({ tipo_comida: 'cena', ingredientes: ['pollo', 'arroz'] }).ok, true);
  assert.equal(v.validateRecipeSuggestion({ tipo_comida: 'cena', ingredientes: [] }).ok, false);
  assert.equal(v.validateRecipeSuggestion({ tipo_comida: 'cena', ingredientes: [{ nombre: 'x' }] }).ok, false);
});

test('validateNameParam', () => {
  assert.equal(v.validateNameParam('  Pollo ').value, 'Pollo');
  assert.equal(v.validateNameParam('').ok, false);
});
