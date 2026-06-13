const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadBlocks } = require('../helpers');

const Blocks = loadBlocks();

test('normalize: lowercases, strips accents and trims', () => {
  assert.equal(Blocks.normalize('  Salmón '), 'salmon');
  assert.equal(Blocks.normalize('Plátano'), 'platano');
});

test('parseQuantity: grams, units, range average and free', () => {
  // Note: objects come from the vm realm, so we compare fields individually
  // instead of deepStrictEqual (which also compares prototypes).
  const eq = (q, value, unit) => { assert.equal(q.value, value); assert.equal(q.unit, unit); };
  eq(Blocks.parseQuantity('120 g'), 120, 'g');
  eq(Blocks.parseQuantity('1 unidad'), 1, 'unidad');
  eq(Blocks.parseQuantity('150-200 g'), 175, 'g');
  eq(Blocks.parseQuantity('libre'), null, 'libre');
  eq(Blocks.parseQuantity('1 kg'), 1000, 'g');
});

test('calcIngredientBlocks: grams over gPorBloque', () => {
  const d = Blocks.calcIngredientBlocks({ nombre: 'arroz', cantidad: '90 g' });
  assert.equal(d.recognized, true);
  assert.equal(d.category, 'carbohidratos');
  assert.equal(d.blocks, 3); // 90 / 30
});

test('calcIngredientBlocks: egg unit = 1 block', () => {
  const d = Blocks.calcIngredientBlocks({ nombre: 'huevo', cantidad: '2 unidades' });
  assert.equal(d.category, 'proteinas_grasas');
  assert.equal(d.blocks, 2);
});

test('calcIngredientBlocks: free vegetables and unknown', () => {
  const veg = Blocks.calcIngredientBlocks({ nombre: 'lechuga', cantidad: 'libre' });
  assert.equal(veg.free, true);
  assert.equal(veg.blocks, 0);

  const unknown = Blocks.calcIngredientBlocks({ nombre: 'xyz raro', cantidad: '100 g' });
  assert.equal(unknown.recognized, false);
});

test('validateRecipe: a balanced dinner fits the pattern', () => {
  const res = Blocks.validateRecipe({
    tipo_comida: 'cena',
    ingredientes: [
      { nombre: 'arroz', cantidad: '90 g' },        // 3 carbs
      { nombre: 'aceite de oliva', cantidad: '10 g' }, // 1 fat
      { nombre: 'pollo', cantidad: '200 g' },        // 2 lean protein
      { nombre: 'lechuga', cantidad: 'libre' },
    ],
  });
  assert.equal(res.valid, true);
  assert.equal(res.fits, true);
  const carbs = res.comparisons.find(c => c.category === 'carbohidratos');
  assert.equal(carbs.current, 3);
  assert.equal(carbs.target, 3);
});

test('validateRecipe: flags deviations and unknown ingredients', () => {
  const res = Blocks.validateRecipe({
    tipo_comida: 'cena',
    ingredientes: [{ nombre: 'arroz', cantidad: '300 g' }, { nombre: 'cosa rara', cantidad: '10 g' }],
  });
  assert.equal(res.fits, false);
  assert.ok(res.issues.some(i => i.level === 'warn' || i.level === 'err'));
});

test('adjustQuantities: proposes quantities matching the pattern', () => {
  const { adjusted, notes } = Blocks.adjustQuantities(
    [{ nombre: 'arroz' }, { nombre: 'aceite de oliva' }, { nombre: 'pollo' }],
    'cena',
  );
  const rice = adjusted.find(i => i.nombre === 'arroz');
  assert.equal(rice.cantidad, '90 g'); // 3 blocks * 30g
  assert.ok(Array.isArray(notes));
});

test('mergeAliases + removeAlias: dynamic aliases, builtins protected', () => {
  Blocks.mergeAliases([{ nombre: 'tempeh', cat: 'proteinas_magras', gPorBloque: 100 }]);
  const d = Blocks.calcIngredientBlocks({ nombre: 'tempeh', cantidad: '100 g' });
  assert.equal(d.blocks, 1);
  assert.equal(Blocks.removeAlias('tempeh'), true);
  assert.equal(Blocks.removeAlias('pollo'), false); // builtin cannot be removed
});

test('mergeAliases: ignores prototype-pollution keys', () => {
  Blocks.mergeAliases([{ nombre: '__proto__', cat: 'grasas', gPorBloque: 1 }]);
  assert.equal(({}).polluted, undefined);
});
