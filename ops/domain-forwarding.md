# playclave.com forwarding

Verified on 2026-10-15. The canonical game URL is
<https://clave.dance>. Porkbun URL forwarding sends traffic from
`playclave.com` and its subdomains to that URL.

## Current configuration

| Setting | Value |
| --- | --- |
| Managed at | Porkbun: playclave.com → Details → URL Forwarding |
| Hostname | Root domain (blank host field) |
| Destination | `https://clave.dance` |
| Redirect type | Temporary (302) |
| Wildcard forwarding | Enabled, including `www.playclave.com` |
| Include requested URI path | Disabled |

The destination previously pointed to `https://stephens.page`. Only the
destination was changed; the existing redirect type, wildcard behavior and
path setting were retained.

Porkbun remains authoritative for this domain and serves its redirect.
This change did not require an application deployment, a new server virtual
host, or moving the domain to the fleet's Terraform configuration.
`ops/Caddyfile` describes an alternative server-managed redirect; it is not
the configuration serving the current Porkbun forwarding.

## Verification

HEAD requests returned the following status and Location header:

```text
http://playclave.com/       302  https://clave.dance
https://playclave.com/      302  https://clave.dance
http://www.playclave.com/   302  https://clave.dance
https://www.playclave.com/  302  https://clave.dance
```

Opening `https://playclave.com` in a browser reached the Clave game at
`https://clave.dance/` with no certificate warning.

## Remaining launch work

FR-14 in `docs/plans/clave-plan.md` calls for a **301** redirect. The current
302 works but does not yet satisfy that permanent-redirect requirement.
Choose the redirect type and path behavior explicitly when changing the
configuration; a destination-only update does not establish either.

After a change, verify the status and destination for HTTP and HTTPS
on both the apex and `www`, plus a non-root path if path preservation is enabled,
and update this record. The broader Phase 5 device, playtest and operational
gates remain separate in `tasks/todo.md`.
