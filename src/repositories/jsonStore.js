// JSON file access with atomic writes, versioning and a per-file queue.
// This is the only layer that touches the filesystem.
const fs = require('fs/promises');
const { existsSync } = require('fs');
const path = require('path');
const config = require('../config');

async function read(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

// Before overwriting, store a timestamped copy and prune the old ones.
async function snapshot(filePath) {
  try {
    // Nothing to version if the file does not exist yet (first write).
    if (!existsSync(filePath)) return;
    const base = path.basename(filePath, '.json');
    const dir = path.join(config.versionsDir, base);
    await fs.mkdir(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await fs.copyFile(filePath, path.join(dir, `${stamp}.json`));
    const versions = (await fs.readdir(dir)).filter(f => f.endsWith('.json')).sort();
    for (const old of versions.slice(0, Math.max(0, versions.length - config.maxVersions))) {
      await fs.unlink(path.join(dir, old));
    }
  } catch (e) {
    // Versioning must never block the main write.
    console.error('Could not version', filePath, e.message);
  }
}

// Atomic write: write to a temp file and rename, so a crash mid-write never
// leaves the JSON corrupted.
async function write(filePath, data) {
  await snapshot(filePath);
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  await fs.rename(tmp, filePath);
}

// Serializes read-modify-write per file to avoid race conditions between
// concurrent requests.
const queues = new Map();
function withLock(filePath, fn) {
  const prev = queues.get(filePath) || Promise.resolve();
  const next = prev.then(fn, fn);
  queues.set(filePath, next.catch(() => {}));
  return next;
}

// Runs `mutator(data)` over the file contents exclusively.
// The mutator returns { data?, ...rest }: if it includes `data`, it is
// persisted; `rest` is returned to the caller.
function update(filePath, mutator) {
  return withLock(filePath, async () => {
    const current = await read(filePath);
    const { data, ...rest } = (await mutator(current)) || {};
    if (data !== undefined) await write(filePath, data);
    return rest;
  });
}

module.exports = { read, write, update };
