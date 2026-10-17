#!/usr/bin/env bash
set -euo pipefail

[[ $EUID == 0 && $# == 1 ]] || { echo "Usage: sudo install-deployment.sh PUBLIC_KEY_FILE" >&2; exit 1; }
scripts=$(cd "$(dirname "$0")" && pwd)
public_key=$(cat "$1")
[[ "$public_key" =~ ^ssh-ed25519\ [A-Za-z0-9+/=]+(\ .*)?$ ]] || {
  echo "Expected one Ed25519 public key." >&2
  exit 1
}

if ! id clave-deploy >/dev/null 2>&1; then
  useradd --system --user-group --home-dir /var/lib/clave-deploy --shell /bin/bash clave-deploy
fi
install -d -o root -g root -m 0755 /var/lib/clave-deploy /var/lib/clave-deploy/.ssh
install -d -o clave-deploy -g clave-deploy -m 0700 /var/cache/clave-deploy
install -o root -g root -m 0755 "$scripts/deploy-release.sh" /usr/local/sbin/clave-deploy-release
install -o root -g root -m 0755 "$scripts/receive-release.sh" /usr/local/sbin/clave-receive-release

temporary=$(mktemp -d)
trap 'rm -rf "$temporary"' EXIT
printf 'restrict,command="/usr/local/sbin/clave-receive-release" %s\n' "$public_key" > "$temporary/authorized_keys"
install -o root -g root -m 0644 "$temporary/authorized_keys" /var/lib/clave-deploy/.ssh/authorized_keys
printf 'clave-deploy ALL=(root) NOPASSWD: /usr/local/sbin/clave-deploy-release *\n' > "$temporary/sudoers"
visudo -cf "$temporary/sudoers"
install -o root -g root -m 0440 "$temporary/sudoers" /etc/sudoers.d/clave-deploy
echo "Installed the restricted Clave deployment account and root-owned helpers."
