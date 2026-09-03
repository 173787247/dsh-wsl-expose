# dsh-wsl-expose

> **套件安装：** 见 [dsh-wsl-kit](https://github.com/173787247/dsh-wsl-kit)。推荐 `KIT_SET=daily` | `llm` | `github` | `full`。故障树：[TROUBLESHOOTING.zh.md](https://github.com/173787247/dsh-wsl-kit/blob/master/docs/TROUBLESHOOTING.zh.md)。

工具 **`wsl_expose`**：白名单内建议/执行 Windows portproxy。对 **dsh web** 优先 `restart-dsh-web.sh` → **http://127.0.0.1:3081/**（dsh 只绑 `127.0.0.1:3080`）。会读 `.wslconfig` 的 `networkingMode`。

[English → README.md](./README.md)

```sh
dsh plugin --profile web add github:173787247/dsh-wsl-expose
npm test
```

MIT
