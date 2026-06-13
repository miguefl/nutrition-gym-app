const store = require('./jsonStore');
const { paths } = require('../config');

function findAll() {
  return store.read(paths.equivalences);
}

module.exports = { findAll };
