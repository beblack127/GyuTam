#!/bin/sh
# PreToolUse: 위험한 셸 명령을 검사한다.
# - git commit/push: 스테이징된 변경에 비밀 정보나 실제 리뷰 원문이 있으면 막는다 (exit 2).
# - cdk deploy/destroy, git push --force: 사용자 확인을 요청한다.
input=$(cat)
secret='AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|aws_secret_access_key[[:space:]":=]+[A-Za-z0-9/+]{40}|-----BEGIN [A-Z ]*PRIVATE KEY-----|ghp_[A-Za-z0-9]{36}'

if printf '%s' "$input" | grep -qE 'git (commit|push)'; then
  if git diff --cached | grep -E '^\+' | grep -qE "$secret"; then
    echo "스테이징된 변경에 비밀 정보로 보이는 값이 있어 커밋을 막았습니다." >&2
    exit 2
  fi
  if git diff --cached --name-only | grep -q '^scripts/eval/data/'; then
    echo "scripts/eval/data/(실제 리뷰 원문)는 커밋할 수 없습니다 (fairness.md)." >&2
    exit 2
  fi
fi

if printf '%s' "$input" | grep -qE 'cdk (deploy|destroy)|push (-f|--force)'; then
  echo '{"hookSpecificOutput":{"permissionDecision":"ask","permissionDecisionReason":"AWS 배포나 강제 push는 사람이 확인해야 합니다 (hackathon.md: 배포·권한 작업은 Supervised)."}}'
fi
exit 0
