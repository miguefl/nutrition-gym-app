const store = require('./jsonStore');
const { paths } = require('../config');

function get() {
  return store.read(paths.plan);
}

function replace(plan) {
  return store.update(paths.plan, () => ({ data: plan }));
}

module.exports = { get, replace };
