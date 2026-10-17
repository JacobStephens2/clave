#!/usr/bin/env bash
set -euo pipefail

# Installed root-owned as the forced command on the deployment account's SSH key.
if [[ ${SSH_ORIGINAL_COMMAND:-} =~ ^deploy\ ([0-9a-f]{40})$ ]]; then
  exec /usr/bin/sudo -n /usr/local/sbin/clave-deploy-release "${BASH_REMATCH[1]}"
fi
echo "Only deploy followed by a full commit SHA is permitted." >&2
exit 1
