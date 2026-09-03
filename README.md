# dsh-wsl-expose
> **Install set:** part of [dsh-wsl-kit](https://github.com/173787247/dsh-wsl-kit).

Tool **`wsl_expose`**: advise/apply Windows portproxy. For **dsh web** prefer kit `restart-dsh-web.sh` → **http://127.0.0.1:3081/** (never `dsh --host 0.0.0.0`). Reads `.wslconfig` `networkingMode`.

[中文说明 → README.zh.md](./README.zh.md)

```sh
dsh plugin --profile web add github:173787247/dsh-wsl-expose
npm test
```

MIT
