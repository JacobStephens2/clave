#!/usr/bin/env bash
set -euo pipefail

script=$(cd "$(dirname "$0")" && pwd)/package-release.sh
fixture=$(mktemp -d)
trap 'rm -rf "$fixture"' EXIT
cd "$fixture"
git init -q
git config user.name "Deployment test"
git config user.email "deployment-test@example.invalid"
printf 'tracked source\n' > source.txt
for package in content engine client server; do
  mkdir -p "packages/$package"
  printf '{}\n' > "packages/$package/package.json"
done
git add .
git commit -qm fixture
commit=$(git rev-parse HEAD)

for package in content engine client server; do
  mkdir -p "packages/$package/dist"
  printf 'built %s\n' "$package" > "packages/$package/dist/index.js"
done
mkdir -p node_modules
printf 'must not ship\n' > node_modules/untracked.txt
bash "$script" "$commit" "$fixture/release.tgz"
mkdir unpacked
tar -xzf release.tgz -C unpacked
cmp source.txt unpacked/source.txt
for package in content engine client server; do
  cmp "packages/$package/dist/index.js" "unpacked/packages/$package/dist/index.js"
done
grep -Fq "\"commit\":\"$commit\"" unpacked/packages/client/dist/release.json
test ! -e unpacked/node_modules
test ! -e unpacked/.git

if bash "$script" aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa "$fixture/wrong.tgz" 2>/dev/null; then
  echo "Packaging accepted a different commit." >&2
  exit 1
fi
rm -rf packages/server/dist
if bash "$script" "$commit" "$fixture/missing.tgz" 2>/dev/null; then
  echo "Packaging accepted a missing build." >&2
  exit 1
fi
echo "Release packaging checks passed."
