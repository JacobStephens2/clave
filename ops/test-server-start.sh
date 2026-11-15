#!/usr/bin/env bash
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
fixture=$(mktemp -d)
server_pid=
cleanup() {
  local status=$?
  if [[ -n "$server_pid" ]]; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
  if [[ "$status" -ne 0 ]]; then
    cat "$fixture/server.log" >&2
  fi
  rm -rf "$fixture"
}
trap cleanup EXIT
cd "$root"

# Ask the OS for a free loopback port so concurrent checkouts can run the smoke check.
port=$(node --input-type=module <<'NODE'
import { createServer } from 'node:net';
const server = createServer();
server.listen(0, '127.0.0.1', () => {
  console.log(server.address().port);
  server.close();
});
NODE
)

HOST=127.0.0.1 PORT="$port" CLAVE_DB_PATH="$fixture/clave.sqlite" \
  node --trace-deprecation packages/server/dist/index.js > "$fixture/server.log" 2>&1 &
server_pid=$!
curl --fail --silent --show-error --retry 10 --retry-connrefused --retry-delay 1 \
  --max-time 2 --retry-max-time 15 "http://127.0.0.1:$port/healthz" > "$fixture/health.json"
jq -e '.ok == true and .service == "clave"' "$fixture/health.json" > /dev/null
curl --fail --silent --show-error --max-time 2 "http://127.0.0.1:$port/" > "$fixture/index.html"
grep -q '<!doctype html>' "$fixture/index.html"
kill "$server_pid"
wait "$server_pid"
server_pid=

if grep -q 'DeprecationWarning' "$fixture/server.log"; then
  echo "Server startup emitted a deprecation warning." >&2
  exit 1
fi
echo "Server startup, /healthz and / passed without deprecation warnings on $(node --version)."
