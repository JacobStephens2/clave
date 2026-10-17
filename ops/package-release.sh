#!/usr/bin/env bash
set -euo pipefail

commit=${1:?Usage: package-release.sh COMMIT OUTPUT.tgz}
output=${2:?Usage: package-release.sh COMMIT OUTPUT.tgz}
[[ "$commit" =~ ^[0-9a-f]{40}$ ]] || { echo "Expected a full commit SHA." >&2; exit 1; }
[[ $(git rev-parse HEAD) == "$commit" ]] || { echo "Build checkout does not match the release." >&2; exit 1; }

staging=$(mktemp -d)
trap 'rm -rf "$staging"' EXIT
git archive "$commit" | tar -x -C "$staging"
for package in content engine client server; do
  test -d "packages/$package/dist"
  cp -R "packages/$package/dist" "$staging/packages/$package/dist"
done
printf '{"commit":"%s"}\n' "$commit" > "$staging/packages/client/dist/release.json"
tar -czf "$output" -C "$staging" .
