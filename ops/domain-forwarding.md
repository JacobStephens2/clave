# playclave.com forwarding

Configuration saved on 2026-10-15; public 301 behavior verified on 2026-10-16.
The canonical game URL is <https://clave.dance>. Porkbun URL forwarding sends traffic from
`playclave.com` and its subdomains to that URL.

## Current configuration

| Setting                    | Value                                             |
| -------------------------- | ------------------------------------------------- |
| Managed at                 | Porkbun: playclave.com → Details → URL Forwarding |
| Hostname                   | Root domain (blank host field)                    |
| Destination                | `https://clave.dance`                             |
| Redirect type              | Permanent (301), saved in Porkbun                 |
| Wildcard forwarding        | Enabled, including `www.playclave.com`            |
| Include requested URI path | Enabled                                           |

The destination previously pointed to `https://stephens.page`. The initial
destination update retained the existing 302 and no-path behavior. Jacob then
approved a permanent 301 with path preservation; Porkbun's Current Forwards
table now shows `permanent`, Include Path `yes`, and Wildcard `yes`.

Porkbun remains authoritative for this domain and serves its redirect.
This change did not require an application deployment, a new server virtual
host, or moving the domain to the fleet's Terraform configuration.
`ops/Caddyfile` describes an alternative server-managed redirect; it is not
the configuration serving the current Porkbun forwarding.

## Public verification and propagation

HEAD requests verified the destination update before the permanent/path change:

```text
http://playclave.com/       302  https://clave.dance
https://playclave.com/      302  https://clave.dance
http://www.playclave.com/   302  https://clave.dance
https://www.playclave.com/  302  https://clave.dance
```

Opening `https://playclave.com` in a browser reached the Clave game at
`https://clave.dance/` with no certificate warning.

Immediately after Porkbun saved the 301/path configuration on 2026-10-15, all
eight public HEAD checks still returned the previous `302` and
`Location: https://clave.dance`, without a path. [Porkbun's forwarding guide](https://kb.porkbun.com/article/39-how-to-set-up-url-forwarding)
says changes should take effect within 10–15 minutes.

On 2026-10-16, HEAD requests observed the saved settings publicly on every
source host and scheme:

```text
http://playclave.com/                               301  https://clave.dance/
http://playclave.com/healthz?redirect-check=1       301  https://clave.dance/healthz?redirect-check=1
http://www.playclave.com/                           301  https://clave.dance/
http://www.playclave.com/healthz?redirect-check=1   301  https://clave.dance/healthz?redirect-check=1
https://playclave.com/                              301  https://clave.dance/
https://playclave.com/healthz?redirect-check=1      301  https://clave.dance/healthz?redirect-check=1
https://www.playclave.com/                          301  https://clave.dance/
https://www.playclave.com/healthz?redirect-check=1  301  https://clave.dance/healthz?redirect-check=1
```

## Launch status

FR-14 in `docs/plans/clave-plan.md` calls for a **301** redirect. The observed
responses above satisfy it, including path and query preservation. The broader
Phase 5 device, playtest and operational gates remain separate in
`tasks/todo.md`.
