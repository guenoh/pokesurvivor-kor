#!/usr/bin/env bash
set -euo pipefail
expected=guenoh/pokesurvivor-kor
[[ "$GITHUB_REPOSITORY" == "$expected" ]] || { echo 'Repository guard failed'; exit 1; }
git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git remote add upstream https://github.com/JPTER78/pokesurvivor.git 2>/dev/null || true
git fetch upstream main
upstream_sha=$(git rev-parse upstream/main)
if git merge-base --is-ancestor "$upstream_sha" origin/main; then
  echo 'No upstream changes'; exit 0
fi
git switch -C sync/upstream origin/main
# Report overlapping extension points even when Git can merge without conflicts.
boundary="$PWD/kor/upstream-boundary.cjs"
: > /tmp/upstream-boundary.md
if [[ -f "$boundary" ]]; then node "$boundary" --report "$upstream_sha" > /tmp/upstream-boundary.md; fi
if ! git merge --no-ff --no-commit upstream/main; then
  # Generated output is rebuilt by CI. Only generated files may be resolved automatically.
  while IFS= read -r file; do
    case "$file" in
      index.html|js/app.min.js|version.json|js/lang/*.js)
        git checkout --ours -- "$file"; git add -- "$file" ;;
    esac
  done < <(git diff --name-only --diff-filter=U)
  conflicts=$(git diff --name-only --diff-filter=U)
  if [[ -n "$conflicts" ]]; then
    title="Upstream merge conflict: ${upstream_sha:0:12}"
    printf 'Upstream commit: %s\n\nManual conflict resolution is required. No branch was overwritten and no deployment was triggered.\n\nConflicting paths:\n```\n%s\n```\n' "$upstream_sha" "$conflicts" > /tmp/upstream-conflict.md
    cat /tmp/upstream-boundary.md >> /tmp/upstream-conflict.md
    existing=$(gh issue list --repo "$expected" --state open --search "$title in:title" --json number --jq '.[0].number // empty')
    if [[ -z "$existing" ]]; then gh issue create --repo "$expected" --title "$title" --body-file /tmp/upstream-conflict.md; fi
    git merge --abort
    exit 1
  fi
fi
# Advance original hashes, but never automatically approve changed Korean patches.
if [[ -f "$boundary" ]]; then
  node "$boundary" --refresh-baseline "$upstream_sha"
  git add kor/upstream-boundary.json
fi
git commit -m "Merge JPTER78/pokesurvivor at ${upstream_sha:0:12} for review"
git push --force-with-lease origin sync/upstream
printf 'Merge upstream commit `%s` into the independent Korean edition.\n\nCI must pass. Review source, Korean overrides, license changes and backend contract before merging. Deployment requires a separate manual run and production approval.\n' "$upstream_sha" > /tmp/upstream-pr.md
cat /tmp/upstream-boundary.md >> /tmp/upstream-pr.md
existing=$(gh pr list --repo "$expected" --head sync/upstream --base main --state open --json number --jq '.[0].number // empty')
if [[ -z "$existing" ]]; then
  gh pr create --repo "$expected" --base main --head sync/upstream --title 'Sync upstream PokéSurvivor' --body-file /tmp/upstream-pr.md
else
  gh pr edit "$existing" --repo "$expected" --body-file /tmp/upstream-pr.md
fi
# Explicit dispatch works even when the branch and PR were created using GITHUB_TOKEN.
gh workflow run ci.yml --repo "$expected" --ref sync/upstream
