# dsh-wsl-expose

DeepSeek Harness plugin: Advise or apply allowlisted Windows portproxy/firewall steps to expose a WSL listen port.

Part of **[dsh-wsl-kit](https://github.com/173787247/dsh-wsl-kit)**.

[中文说明 → README.zh.md](./README.zh.md)

## Install

```sh
dsh plugin --profile web add github:173787247/dsh-wsl-expose
# or local:
dsh plugin --profile web add /absolute/path/to/dsh-wsl-expose
```

Restart `dsh web` and open a **new** session. Tool: `wsl_expose`.

## License

MIT
