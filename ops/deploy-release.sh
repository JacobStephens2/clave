#!/usr/bin/env bash
set -Eeuo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
umask 022

[[ $EUID == 0 && $# == 1 && ${1:-} =~ ^[0-9a-f]{40}$ ]] || {
  echo "Usage: sudo clave-deploy-release COMMIT < verified-release.tgz" >&2
  exit 1
}
commit=$1
root=/opt/clave
database=/var/lib/clave/clave.sqlite
release="$root/releases/$commit"
previous=""
staging=""
service_stopped=false
activated=false
schema_before=""

exec 9> /run/lock/clave-deploy.lock
flock -w 600 9
previous=$(readlink -f "$root/current")

schema_version() {
  runuser -u clave -- node - "$previous/node_modules/better-sqlite3" "$database" <<'NODE'
const Database = require(process.argv[2]);
const db = new Database(process.argv[3], { readonly: true, fileMustExist: true });
console.log(db.pragma('user_version', { simple: true }));
db.close();
NODE
}

point_to() {
  rm -f -- "$root/.current.$$"
  ln -s "$1" "$root/.current.$$"
  mv -Tf "$root/.current.$$" "$root/current"
}

healthy() {
  curl --fail --silent --max-time 3 http://127.0.0.1:8787/healthz \
    | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{try{const h=JSON.parse(s);process.exit(h.ok===true&&h.service==="clave"?0:1)}catch{process.exit(1)}})'
}

release_matches() {
  curl --fail --silent --max-time 5 http://127.0.0.1:8787/release.json \
    | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{try{process.exit(JSON.parse(s).commit===process.argv[1]?0:1)}catch{process.exit(1)}})' "$commit"
}

wait_for_health() {
  local _
  for _ in {1..20}; do
    if systemctl is-active --quiet clave.service && healthy; then return 0; fi
    sleep 1
  done
  return 1
}

cleanup() {
  local status=$?
  trap - EXIT
  set +e
  if (( status != 0 )) && "$service_stopped"; then
    # Never run old application code against a newly migrated database automatically.
    if "$activated" && [[ $(schema_version) != "$schema_before" ]]; then
      systemctl stop clave.service
      echo "Deployment failed after a schema change; manual restore from the verified backup is required." >&2
    else
      echo "Deployment failed; restoring the previous application release." >&2
      systemctl stop clave.service || true
      if "$activated"; then point_to "$previous"; fi
      systemctl start clave.service && wait_for_health || echo "Previous release needs operator attention." >&2
    fi
  fi
  if [[ -n "$staging" ]]; then rm -rf -- "$staging"; fi
  rm -f -- "$root/.current.$$"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 143' TERM HUP
trap 'exit 130' INT

check_release() {
  runuser -u clave-deploy -- node /usr/local/lib/clave/validate-release.mjs "$1" "$commit"
}

if [[ -d "$release" ]]; then
  # Consume stdin so an idempotent retry does not break the sender's upload.
  cat > /dev/null
  check_release "$release"
else
  staging=$(mktemp -d "$root/.prepare-$commit.XXXXXX")
  chown clave-deploy:clave-deploy "$staging"
  runuser -u clave-deploy -- tar -xzf - --no-same-owner --no-same-permissions -C "$staging"
  check_release "$staging"
  # Native SQLite bindings must be installed for the server's Node version and OS.
  runuser -u clave-deploy -- env npm_config_cache=/var/cache/clave-deploy/npm \
    npm ci --omit=dev --prefix "$staging"
  check_release "$staging"
  chown -R --no-dereference root:root "$staging"
  chmod -R a+rX,a-w "$staging"
  mv "$staging" "$release"
  staging=""
fi

if [[ "$previous" == "$release" ]] && healthy && release_matches; then
  echo "Release $commit is already active."
  exit 0
fi

guard() {
  runuser -u clave -- env CLAVE_DB_PATH="$database" \
    node "$previous/packages/server/dist/deploy-guard.js"
}
guard
schema_before=$(schema_version)
service_stopped=true
systemctl stop clave.service
# Close the guard/stop race: an action accepted just before stopping must block deployment.
guard
systemctl start clave-backup.service
[[ $(systemctl show clave-backup.service --property=Result --value) == success ]]
journalctl -u clave-backup.service -n 3 --no-pager
activated=true
point_to "$release"
systemctl start clave.service
wait_for_health
release_matches
service_stopped=false
echo "Deployed $commit; loopback health and release identity verified."
