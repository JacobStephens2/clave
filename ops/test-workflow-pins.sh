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

if ! grep -Eq '^[[:space:]]*node-version: \$\{\{ matrix.node \}\}[[:space:]]*$' "$workflow"; then
  echo "CI must select node-version from \${{ matrix.node }}." >&2
  fail=1
fi

# Keep exact release pins while covering both the current and next host runtime.
versions=$(sed -nE 's/^[[:space:]]*node: \[([^]]*)\][[:space:]]*$/\1/p' "$workflow")
IFS=',' read -ra node_versions <<< "$versions"
node_22=0
node_26=0
for value in "${node_versions[@]}"; do
  value=${value//[[:space:]\"\']/}
  if [[ "$value" =~ ^22\.[0-9]+\.[0-9]+$ ]]; then
    node_22=1
  elif [[ "$value" =~ ^26\.[0-9]+\.[0-9]+$ ]]; then
    node_26=1
  else
    echo "matrix.node must use exact Node 22 and 26 releases, not: ${value}" >&2
    fail=1
  fi
done

if [[ "$node_22" -ne 1 || "$node_26" -ne 1 ]]; then
  echo "CI matrix must cover both Node 22 and Node 26." >&2
  fail=1
fi

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi

echo "CI workflow pin checks passed."
