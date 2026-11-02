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
# Inspect origin/main before touching the merge branch. The upstream now sometimes
# publishes only its bundle; merging that would remove our development baseline.
git switch --detach origin/main
boundary="$PWD/kor/upstream-boundary.cjs"
if [[ -f "$boundary" ]] && ! node "$boundary" --require-sources "$upstream_sha" 2> /tmp/upstream-missing-sources.txt; then
  reviewed=$(node -e 'const fs=require("node:fs");const p="kor/upstream-review.json";if(fs.existsSync(p)){const r=JSON.parse(fs.readFileSync(p));if(r.schema===1&&r.disposition==="no-runtime-port"&&/^[a-f0-9]{40}$/.test(r.commit))process.stdout.write(r.commit)}')
  if [[ "$reviewed" == "$upstream_sha" ]]; then
    echo "Upstream ${upstream_sha:0:12} was selectively reviewed; no runtime port required."
    exit 0
  fi
  title="Upstream selective review: ${upstream_sha:0:12}"
  {
    printf '# 원작 업데이트 별도 검토 필요\n\n원작 커밋: https://github.com/JPTER78/pokesurvivor/commit/%s\n\n' "$upstream_sha"
    printf '원작에서 기존 개발 소스가 빠졌습니다. 압축 실행 파일을 한국판에 덮어쓰지 않았고, 원본 기준·한국어·독립 서버·회원 데이터는 변경하지 않았습니다.\n\n공개 변경을 비교한 뒤 적용할 부분만 별도 PR로 반영해 주세요. 이 감지 작업은 게임을 배포하지 않습니다.\n\n누락된 개발 소스:\n```text\n'
    cat /tmp/upstream-missing-sources.txt
    printf '```\n'
  } > /tmp/upstream-selective-review.md
  existing=$(gh issue list --repo "$expected" --state all --search "$title in:title" --json number --jq '.[0].number // empty')
  if [[ -z "$existing" ]]; then gh issue create --repo "$expected" --title "$title" --body-file /tmp/upstream-selective-review.md; fi
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then cat /tmp/upstream-selective-review.md >> "$GITHUB_STEP_SUMMARY"; fi
  echo 'Upstream detected; selective review required. No merge branch, baseline or deployment changed.'
  exit 0
fi
git switch -C sync/upstream origin/main
# Report overlapping extension points even when Git can merge without conflicts.
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
