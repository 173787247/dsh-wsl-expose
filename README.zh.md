# dsh-wsl-expose

DeepSeek Harness 工具：**`wsl_expose`** — 规划（可选执行）Windows `netsh` portproxy / 防火墙规则，把 WSL TCP 端口暴露到局域网。

对应社区 [jack-ranbo/dsh-wsl-expose](https://github.com/jack-ranbo/dsh-wsl-expose) 的自有实现。

属于 **[dsh-wsl-kit](https://github.com/173787247/dsh-wsl-kit)**。

[English → README.md](./README.md)

---

## 安全优先

- 默认 **`allowApply: false`**，只做 `plan` / `status`。
- `apply` / `remove` 需显式开启 `config.allowApply: true`。
- `netsh` 通常需要**管理员**权限；失败时会提示提权。
- 向局域网暴露端口会增大攻击面——仅在用户明确要求时使用。

## 工具参数

| 参数 | 必需 | 含义 |
|------|------|------|
| `action` | 是 | `status` \| `plan` \| `apply` \| `remove` |
| `port` | 否 | TCP 端口（默认 3080） |
| `connectAddress` | 否 | portproxy 连接地址（默认首个 WSL IP） |

## 安装

```sh
dsh plugin --profile web add github:173787247/dsh-wsl-expose
```

## 配置

```yaml
- id: dsh-wsl-expose
  name: dsh-wsl-expose
  config:
    timeoutMs: 15000
    defaultPort: 3080
    allowApply: false
    listenAddress: 0.0.0.0
```

## 测试

```sh
npm test
```

## 许可

MIT
