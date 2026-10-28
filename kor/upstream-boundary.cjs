// Build-time guard only. Never loaded by the game or connected to player data.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const manifestPath = path.join(__dirname, 'upstream-boundary.json');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const sourcePath = name => name === 'dev.html' || /^(js|css)\/.*\.(js|css)$/.test(name) && name !== 'js/app.min.js' && !name.startsWith('js/lang/');
const git = (dir, args, buffer = false) => execFileSync('git', args, { cwd: dir, encoding: buffer ? undefined : 'utf8' });

function sourceFiles(dir, prefix = '') {
  const result = [];
  for (const entry of fs.readdirSync(path.join(dir, prefix), { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isDirectory() && (name === 'js' || name === 'css' || prefix.startsWith('js/') || prefix.startsWith('css/'))) result.push(...sourceFiles(dir, name + '/'));
    else if (entry.isFile() && sourcePath(name)) result.push(name);
  }
  return result.sort();
}

function audit(dir, manifest) {
  const errors = [], changed = [];
  for (const [name, original] of Object.entries(manifest.original)) {
    const file = path.join(dir, name), patch = manifest.patches[name];
    if (!fs.existsSync(file)) { errors.push('Missing upstream source: ' + name); continue; }
    const actual = hash(fs.readFileSync(file));
    if ((manifest.pristineEngine || []).includes(name) && actual !== original) errors.push('Pristine upstream engine must not be edited: ' + name);
    if (actual === original) {
      if (patch) errors.push('Remove obsolete patch entry: ' + name);
      continue;
    }
    changed.push(name);
    if (!patch?.reason || !patch?.extension) errors.push('Unclassified upstream modification: ' + name);
    else if (patch.reviewed !== actual) errors.push('Upstream patch needs compatibility review: ' + name);
  }
  for (const name of Object.keys(manifest.patches)) if (!manifest.original[name]) errors.push('Patch has no upstream baseline: ' + name);
  for (const name of sourceFiles(dir)) if (!manifest.original[name] && !manifest.koreanOwned.includes(name)) errors.push('Unclassified added source: ' + name);
  return { errors, changed };
}

function refreshBaseline(dir, manifest, ref) {
  // Baselines may advance automatically; reviewed Korean patch hashes never do.
  const commit = git(dir, ['rev-parse', '--verify', ref + '^{commit}']).trim();
  const names = git(dir, ['ls-tree', '-r', '--name-only', commit, '--', 'js', 'css', 'dev.html']).trim().split('\n').filter(sourcePath);
  const original = Object.fromEntries(names.map(name => [name, hash(git(dir, ['show', commit + ':' + name], true))]));
  return { ...manifest, upstream: commit, original };
}

function overlapReport(dir, manifest, ref) {
  const names = git(dir, ['diff', '--name-only', manifest.upstream, ref, '--']).trim().split('\n');
  const boundaries = { ...manifest.extensions, ...manifest.patches };
  const overlap = names.filter(name => boundaries[name]);
  return '\n### Korean extension compatibility\n\n' + (overlap.length
    ? 'Upstream changed these extension boundaries or directly patched files. Review the Korean extension and its regression tests before approving. A clean Git merge alone is not compatibility proof.\n\n' + overlap.map(name => '- `' + name + '` — ' + boundaries[name].reason + ' → `' + boundaries[name].extension + '`').join('\n')
    : 'No upstream changes overlap the registered Korean extension boundaries.') + '\n';
}

if (require.main === module) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (process.argv[2] === '--refresh-baseline' && process.argv[3]) {
    fs.writeFileSync(manifestPath, JSON.stringify(refreshBaseline(root, manifest, process.argv[3]), null, 2) + '\n');
  } else if (process.argv[2] === '--report' && process.argv[3]) {
    process.stdout.write(overlapReport(root, manifest, process.argv[3]));
  } else if (process.argv.length === 2) {
    const result = audit(root, manifest);
    if (result.errors.length) { console.error(result.errors.join('\n')); process.exitCode = 1; }
    else console.log('Korean extension boundary verified: ' + result.changed.length + ' reviewed core patches; upstream ' + manifest.upstream.slice(0, 12));
  } else { console.error('Usage: node kor/upstream-boundary.cjs [--report|--refresh-baseline upstream-commit]'); process.exitCode = 1; }
}
module.exports = { audit, hash, refreshBaseline, overlapReport };
