#!/bin/sh
# PreToolUse: 파일 쓰기 내용에 비밀 정보가 있으면 막는다 (exit 2).
# stdin으로 도구 입력 JSON을 받는다.
input=$(cat)
pattern='AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|aws_secret_access_key[[:space:]":=]+[A-Za-z0-9/+]{40}|-----BEGIN [A-Z ]*PRIVATE KEY-----|ghp_[A-Za-z0-9]{36}|xox[baprs]-[A-Za-z0-9-]{10,}'
if printf '%s' "$input" | grep -qE "$pattern"; then
  echo "비밀 정보로 보이는 값이 있어 쓰기를 막았습니다. 키는 Lambda 환경 변수나 .env에만 두세요 (tech.md 보안 규칙)." >&2
  exit 2
fi
exit 0
