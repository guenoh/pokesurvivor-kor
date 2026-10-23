#!/usr/bin/env bash
set -euo pipefail
script=$(cd "$(dirname "$0")" && pwd)/sync-upstream.sh
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
STUB
chmod +x "$tmp/bin/gh"
export PATH="$tmp/bin:$PATH"
git init -q -b main "$tmp/upstream"
printf 'base\n' > "$tmp/upstream/source.txt"
git -C "$tmp/upstream" add .
git -C "$tmp/upstream" commit -qm baseline
git clone -q --bare "$tmp/upstream" "$tmp/origin.git"
git clone -q "$tmp/origin.git" "$tmp/ours"
git -C "$tmp/ours" remote add upstream "$tmp/upstream"
cd "$tmp/ours"
bash "$script"
test -z "$(git ls-remote origin refs/heads/sync/upstream)"
printf 'feature\n' > "$tmp/upstream/feature.txt"
git -C "$tmp/upstream" add .
git -C "$tmp/upstream" commit -qm feature
bash "$script"
git fetch -q origin sync/upstream
test "$(git show FETCH_HEAD:feature.txt)" = feature
grep -q 'pr create' "$SYNC_TEST_LOG"
grep -q 'workflow run ci.yml' "$SYNC_TEST_LOG"
published=$(git ls-remote origin refs/heads/sync/upstream | cut -f1)
git switch -q main
printf 'korean\n' > source.txt
git add .; git commit -qm korean
git push -q origin main
printf 'upstream\n' > "$tmp/upstream/source.txt"
git -C "$tmp/upstream" commit -qam conflict
if bash "$script"; then echo 'Expected merge conflict' >&2; exit 1; fi
grep -q 'issue create' "$SYNC_TEST_LOG"
test "$(git ls-remote origin refs/heads/sync/upstream | cut -f1)" = "$published"
echo 'Upstream sync: no-op, PR/CI creation, and conflict preservation passed.'
