const repo = require('../repositories/logRepository');

function get() {
  return repo.get();
}

async function mark(date, meal, state) {
  await repo.setEntry(date, meal, state);
  return { fecha: date, comida: meal, estado: state };
}

module.exports = { get, mark };
