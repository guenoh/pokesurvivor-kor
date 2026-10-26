const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { audit, hash, refreshBaseline, overlapReport } = require('../kor/upstream-boundary.cjs');

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kor-boundary-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const write = (name, data) => { fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true }); fs.writeFileSync(path.join(dir, name), data); };
  write('js/core/plain.js', 'original\n'); write('js/ui/patched.js', 'original\n');
  const manifest = { upstream: 'baseline', original: { 'js/core/plain.js': hash('original\n'), 'js/ui/patched.js': hash('original\n') }, koreanOwned: ['js/data/lang-ko.js'], patches: { 'js/ui/patched.js': { reviewed: hash('korean\n'), reason: 'Korean adapter', extension: 'kor/ranking.js' } } };
  write('js/ui/patched.js', 'korean\n');
  return { dir, write, manifest };
}

test('approved extension boundary works in a source copy without Git history', t => {
  const { dir, write, manifest } = fixture(t);
  write('js/data/lang-ko.js', '한국어'); write('js/app.min.js', 'generated'); write('js/lang/ko.js', 'generated');
  assert.deepEqual(audit(dir, manifest).errors, []);
});

test('unregistered edits, unreviewed changes, missing files and new core files block CI', t => {
  const { dir, write, manifest } = fixture(t);
  write('js/core/plain.js', 'unclassified\n'); write('js/ui/patched.js', 'changed adapter\n'); write('js/new.js', 'new\n');
  const errors = audit(dir, manifest).errors.join('\n');
  assert.match(errors, /Unclassified upstream modification/);
  assert.match(errors, /needs compatibility review/);
  assert.match(errors, /Unclassified added source/);
  fs.unlinkSync(path.join(dir, 'js/core/plain.js'));
  assert.match(audit(dir, manifest).errors.join('\n'), /Missing upstream source/);
});

test('returning a core file to upstream removes its patch registration', t => {
  const { dir, write, manifest } = fixture(t);
  write('js/ui/patched.js', 'original\n');
  assert.match(audit(dir, manifest).errors.join('\n'), /Remove obsolete patch entry/);
  delete manifest.patches['js/ui/patched.js'];
  assert.deepEqual(audit(dir, manifest).errors, []);
});

test('upstream baseline refresh reports overlap and never approves a changed adapter', t => {
  const { dir, write, manifest } = fixture(t);
  const git = args => execFileSync('git', args, { cwd: dir, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 'test', GIT_AUTHOR_EMAIL: 'test@example.invalid', GIT_COMMITTER_NAME: 'test', GIT_COMMITTER_EMAIL: 'test@example.invalid' } });
  git(['init', '-q']); write('js/ui/patched.js', 'original\n'); git(['add', '.']); git(['commit', '-qm', 'baseline']);
  manifest.upstream = git(['rev-parse', 'HEAD']).trim();
  write('js/ui/patched.js', 'upstream v2\n'); write('js/core/plain.js', 'upstream v2\n'); write('js/core/new.js', 'new upstream\n');
  git(['add', '.']); git(['commit', '-qm', 'upstream']);
  const report = overlapReport(dir, manifest, 'HEAD');
  assert.match(report, /js\/ui\/patched.js/); assert.match(report, /kor\/ranking.js/); assert.doesNotMatch(report, /js\/core\/plain.js/);
  const next = refreshBaseline(dir, manifest, 'HEAD');
  assert.equal(next.patches['js/ui/patched.js'].reviewed, hash('korean\n'));
  // A clean merge can still change a patched file: that must require review.
  write('js/ui/patched.js', 'upstream v2 + korean\n');
  assert.deepEqual(audit(dir, next).errors, ['Upstream patch needs compatibility review: js/ui/patched.js']);
  next.patches['js/ui/patched.js'].reviewed = hash('upstream v2 + korean\n');
  assert.deepEqual(audit(dir, next).errors, []);
});

test('checked-in Korean game sources match the reviewed extension boundary', () => {
  const manifest = require('../kor/upstream-boundary.json');
  assert.deepEqual(audit(path.join(__dirname, '..'), manifest).errors, []);
});
