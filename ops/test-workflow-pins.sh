#!/usr/bin/env bash
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
workflow="$root/.github/workflows/ci.yml"
fail=0

if [[ ! -f "$workflow" ]]; then
  echo "Missing CI workflow: $workflow" >&2
  exit 1
fi

check_action() {
  local name=$1
  local found=0
  local line number body
  while IFS= read -r line; do
    [[ -n "$line" ]] || continue
    found=1
    number=${line%%:*}
    body=${line#*:}
    if [[ ! "$body" =~ ^[[:space:]]*(-[[:space:]]+)?uses:[[:space:]]+actions/${name}@[0-9a-fA-F]{40}[[:space:]]#[[:space:]]v[0-9]+\.[0-9]+\.[0-9]+[[:space:]]*$ ]]; then
      echo "actions/${name} on line ${number} must be a full commit SHA with a version comment: ${body}" >&2
      fail=1
    fi
  done < <(grep -nE "uses:[[:space:]]*actions/${name}@" "$workflow" || true)
  if [[ "$found" -eq 0 ]]; then
    echo "CI workflow does not use actions/${name}." >&2
    fail=1
  fi
}

check_action checkout
check_action setup-node

node_found=0
while IFS= read -r line; do
  [[ -n "$line" ]] || continue
  node_found=1
  number=${line%%:*}
  body=${line#*:}
  value=${body#*node-version:}
  value=${value%%#*}
  value=${value#"${value%%[![:space:]]*}"}
  value=${value%"${value##*[![:space:]]}"}
  if [[ "$value" == \"*\" && "$value" == *\" ]]; then
    value=${value:1:${#value}-2}
  elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
    value=${value:1:${#value}-2}
  fi
  if [[ ! "$value" =~ ^22\.[0-9]+\.[0-9]+$ ]]; then
    echo "node-version on line ${number} must be an exact Node 22 release, not: ${value}" >&2
    fail=1
  fi
done < <(grep -nE '^[[:space:]]*node-version:' "$workflow" || true)

if [[ "$node_found" -eq 0 ]]; then
  echo "CI workflow does not set node-version." >&2
  fail=1
fi

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi

echo "CI workflow pin checks passed."
