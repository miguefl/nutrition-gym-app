const store = require('./jsonStore');
const { paths } = require('../config');

// Keep at most ~2 years of log so the file does not grow without bound.
const MAX_DAYS = 730;

function get() {
  return store.read(paths.log);
}

// state: 'ok' | 'fallo' | null (null removes the mark).
function setEntry(date, meal, state) {
  return store.update(paths.log, (log) => {
    const data = { ...log };
    const day = { ...(data[date] || {}) };
    if (state === null) delete day[meal]; else day[meal] = state;
    if (Object.keys(day).length === 0) delete data[date]; else data[date] = day;

    const dates = Object.keys(data).sort();
    for (const old of dates.slice(0, Math.max(0, dates.length - MAX_DAYS))) {
      delete data[old];
    }
    return { data };
  });
}

module.exports = { get, setEntry };
