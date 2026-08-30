# dsh-wsl-expose

DeepSeek Harness tool: **`wsl_expose`** â€?plan (and optionally apply) Windows `netsh` portproxy / firewall rules to expose a WSL TCP port to the LAN.

Counterpart (own implementation) to community [jack-ranbo/dsh-wsl-expose](https://github.com/jack-ranbo/dsh-wsl-expose).

Part of **[dsh-wsl-kit](https://github.com/173787247/dsh-wsl-kit)**.

[ä¸­æ–‡è¯´æ˜Ž â†?README.zh.md](./README.zh.md)

---

## Safety first

- Default **`allowApply: false`** â€?`plan` / `status` only.
- `apply` / `remove` require explicit `config.allowApply: true`.
- `netsh` usually needs an **Administrator** shell; failures return elevation advice.
- Exposing ports to the LAN increases attack surface â€?only when the user asks.

## Tool

| Arg | Required | Meaning |
|-----|----------|---------|
| `action` | yes | `status` \| `plan` \| `apply` \| `remove` |
| `port` | no | TCP port (default 3080) |
| `connectAddress` | no | portproxy connect IP (default first WSL IP) |

## Install

```sh
dsh plugin --profile web add github:173787247/dsh-wsl-expose
```

## Config

```yaml
- id: dsh-wsl-expose
  name: dsh-wsl-expose
  config:
    timeoutMs: 15000
    defaultPort: 3080
    allowApply: false
    listenAddress: 0.0.0.0
```

## Test

```sh
npm test
```

## License

MIT

Restart `dsh web` after installing so Tools lists the new plugin.
