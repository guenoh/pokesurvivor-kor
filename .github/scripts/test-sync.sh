#!/usr/bin/env bash
set -euo pipefail
script=$(cd "$(dirname "$0")" && pwd)/sync-upstream.sh
boundary=$(cd "$(dirname "$0")/../../kor" && pwd)/upstream-boundary.cjs
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
export GIT_AUTHOR_NAME=test GIT_AUTHOR_EMAIL=test@example.invalid
export GIT_COMMITTER_NAME=test GIT_COMMITTER_EMAIL=test@example.invalid
export GITHUB_REPOSITORY=guenoh/pokesurvivor-kor
export SYNC_TEST_LOG="$tmp/gh.log"
mkdir -p "$tmp/bin"
cat > "$tmp/bin/gh" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$SYNC_TEST_LOG"
if [[ "$1 $2" == 'issue list' ]] && [[ "$*" == *'Upstream selective review:'* ]] && [[ -f "$SYNC_TEST_LOG.selective" ]]; then printf '17\n'; fi
if [[ "$1 $2" == 'issue create' ]] && [[ "$*" == *'Upstream selective review:'* ]]; then touch "$SYNC_TEST_LOG.selective"; fi
STUB
chmod +x "$tmp/bin/gh"
export PATH="$tmp/bin:$PATH"
git init -q -b main "$tmp/upstream"
printf 'base\n' > "$tmp/upstream/source.txt"
mkdir -p "$tmp/upstream/js/ui"
printf 'original\n' > "$tmp/upstream/js/ui/patched.js"
git -C "$tmp/upstream" add .
git -C "$tmp/upstream" commit -qm baseline
git clone -q --bare "$tmp/upstream" "$tmp/origin.git"
git clone -q "$tmp/origin.git" "$tmp/ours"
git -C "$tmp/ours" remote add upstream "$tmp/upstream"
cd "$tmp/ours"
mkdir kor
cp "$boundary" kor/upstream-boundary.cjs
printf 'korean\n' > js/ui/patched.js
node - <<'NODE'
const fs = require('node:fs'), {hash} = require('./kor/upstream-boundary.cjs');
const {execFileSync} = require('node:child_process');
fs.writeFileSync('kor/upstream-boundary.json', JSON.stringify({upstream:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),original:{'js/ui/patched.js':hash('original\n')},koreanOwned:[],patches:{'js/ui/patched.js':{reviewed:hash('korean\n'),reason:'Korean fixture',extension:'kor/fixture.js'}}}));
NODE
git add .; git commit -qm 'Korean extension boundary'
git push -q origin main
bash "$script"
test -z "$(git ls-remote origin refs/heads/sync/upstream)"
printf 'feature\n' > "$tmp/upstream/feature.txt"
mkdir -p "$tmp/upstream/js/core"
printf 'new original\n' > "$tmp/upstream/js/core/new.js"
git -C "$tmp/upstream" add .
git -C "$tmp/upstream" commit -qm feature
bash "$script"
git fetch -q origin sync/upstream
test "$(git show FETCH_HEAD:feature.txt)" = feature
node kor/upstream-boundary.cjs
node -e "if (!require('./kor/upstream-boundary.json').original['js/core/new.js']) process.exit(1)"
grep -q 'pr create' "$SYNC_TEST_LOG"
grep -q 'workflow run ci.yml' "$SYNC_TEST_LOG"
published=$(git ls-remote origin refs/heads/sync/upstream | cut -f1)
git switch -q main
printf 'korean\n' > source.txt
git add .; git commit -qm korean
git push -q origin main
printf 'upstream\n' > "$tmp/upstream/source.txt"
printf 'upstream\n' > "$tmp/upstream/js/ui/patched.js"
git -C "$tmp/upstream" commit -qam conflict
if bash "$script"; then echo 'Expected merge conflict' >&2; exit 1; fi
grep -q 'issue create' "$SYNC_TEST_LOG"
grep -q 'js/ui/patched.js' /tmp/upstream-conflict.md
grep -q 'Korean fixture' /tmp/upstream-conflict.md
test "$(git ls-remote origin refs/heads/sync/upstream | cut -f1)" = "$published"
# A published bundle must be reported before any merge or baseline refresh.
git -C "$tmp/upstream" rm -qr js
mkdir -p "$tmp/upstream/js"
printf 'compressed release\n' > "$tmp/upstream/js/app.min.js"
git -C "$tmp/upstream" add .
git -C "$tmp/upstream" commit -qm 'distribution only'
before=$(git show origin/main:kor/upstream-boundary.json)
dispatches=$(grep -c 'workflow run ci.yml' "$SYNC_TEST_LOG")
bash "$script"
test "$(cat kor/upstream-boundary.json)" = "$before"
test "$(cat js/ui/patched.js)" = korean
test "$(git ls-remote origin refs/heads/sync/upstream | cut -f1)" = "$published"
grep -q 'js/ui/patched.js' /tmp/upstream-selective-review.md
test "$(grep -c 'workflow run ci.yml' "$SYNC_TEST_LOG")" = "$dispatches"
bash "$script"
test "$(grep -c 'issue create.*Upstream selective review:' "$SYNC_TEST_LOG")" = 1
# A completed review acknowledges only its exact commit, not future releases.
git switch -q main
reviewed=$(git -C "$tmp/upstream" rev-parse HEAD)
printf '{"schema":1,"commit":"%s","disposition":"no-runtime-port"}\n' "$reviewed" > kor/upstream-review.json
git add kor/upstream-review.json; git commit -qm 'record selective review'; git push -q origin main
bash "$script"
test "$(grep -c 'issue list.*Upstream selective review:' "$SYNC_TEST_LOG")" = 2
printf 'another bundle\n' > "$tmp/upstream/js/app.min.js"
git -C "$tmp/upstream" commit -qam 'next published release'
bash "$script"
test "$(grep -c 'issue list.*Upstream selective review:' "$SYNC_TEST_LOG")" = 3
test "$(git ls-remote origin refs/heads/sync/upstream | cut -f1)" = "$published"
echo 'Upstream sync: source merges, conflicts, distribution-only detection, deduplication and exact review acknowledgement passed.'
