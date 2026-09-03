import { existsSync, readFileSync } from "node:fs";
import { hostnameIps } from "./expose-net.js";
import { runPowerShell } from "./wsl-host.js";

function windowsUserFromEnv(env = process.env) {
  return (
    env.WINDOWS_USER ||
    (env.PATH || "").match(/\/mnt\/c\/Users\/([^/\\]+)/)?.[1] ||
    ""
  );
}

/** networkingMode lives in Windows %UserProfile%\.wslconfig, not /etc/wsl.conf. */
export function readNetworkingMode({
  env = process.env,
  exists = existsSync,
  readFile = readFileSync,
} = {}) {
  const user = windowsUserFromEnv(env);
  const candidates = [];
  if (user) candidates.push(`/mnt/c/Users/${user}/.wslconfig`);
  for (const p of candidates) {
    if (!exists(p)) continue;
    try {
      const text = readFile(p, "utf8");
      const m = text.match(/^\s*networkingMode\s*=\s*(\w+)/im);
      if (m) return m[1].toLowerCase();
    } catch {
      /* ignore */
    }
  }
  return "unknown";
}

export function buildExposeAdvice({ networkingMode = "unknown", port = 3080 } = {}) {
  const tips = [];
  tips.push(
    "DeepSeek Harness dsh web MUST stay on 127.0.0.1 (no --host 0.0.0.0). From Windows use kit scripts/restart-dsh-web.sh → http://127.0.0.1:3081/ (relay to WSL :3080).",
  );
  if (port === 3080 || port === 3081) {
    tips.push(
      `You asked about port ${port}: for local UI prefer the :3081 relay over netsh portproxy. Portproxy is for LAN exposure of a non-dsh service or when mirrored/localhost fails.`,
    );
  }
  if (networkingMode === "mirrored") {
    tips.push(
      "networkingMode=mirrored (.wslconfig): Windows localhost often reaches WSL directly — portproxy may be unnecessary for same-machine browser access.",
    );
  } else if (networkingMode === "nat") {
    tips.push(
      "networkingMode=nat: Windows browser usually cannot hit WSL 127.0.0.1. Prefer mirrored, or keep the :3081 Python relay; use portproxy only when you need a published Windows listen address.",
    );
  } else {
    tips.push(
      "networkingMode unknown — run wslconfig_hint. Without mirrored, rely on restart-dsh-web.sh (:3081) rather than guessing portproxy.",
    );
  }
  tips.push("apply/remove require an elevated Windows shell; prefer advise + run yourself when unsure.");
  tips.push("Do not expose beyond your LAN without TLS and auth.");
  return tips;
}

export function notWsl() {
  return { ok: false, error: "not running in WSL", advice: [] };
}

export function parameters(config = {}) {
  const p = Number(config.defaultPort) > 0 ? Number(config.defaultPort) : 3080;
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      action: {
        type: "string",
        enum: ["advise", "apply", "remove"],
        description: "advise = print commands; apply/remove = run allowlisted portproxy (needs admin on Windows).",
      },
      port: { type: "integer", description: `WSL listen port (default ${p}). For dsh UI prefer :3081 relay, not portproxy.` },
      listenAddress: {
        type: "string",
        description: "Windows listen address for portproxy (default 0.0.0.0).",
      },
    },
  };
}

export function outputSchema() {
  return { type: "object", additionalProperties: true };
}

export function format(v) {
  const lines = [`wsl_expose action=${v.action || "?"} ok=${v.ok} port=${v.port}`];
  if (v.networkingMode) lines.push(`networkingMode: ${v.networkingMode}`);
  if (v.wslIp) lines.push(`wslIp: ${v.wslIp}`);
  if (v.browserHint) lines.push(`browserHint: ${v.browserHint}`);
  for (const c of v.commands || []) lines.push(`$ ${c}`);
  for (const a of v.advice || []) lines.push(`- ${a}`);
  if (v.error) lines.push(`error: ${v.error}`);
  return lines.join("\n");
}

export async function execute(args, config = {}, deps = {}) {
  const action = ["advise", "apply", "remove"].includes(args?.action) ? args.action : "advise";
  const port = Number.isInteger(args?.port) ? args.port : (Number(config.defaultPort) || 3080);
  if (port < 1 || port > 65535) return { ok: false, action, port, error: "invalid port" };
  const listen = typeof args?.listenAddress === "string" && args.listenAddress.trim()
    ? args.listenAddress.trim()
    : "0.0.0.0";
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(listen) && listen !== "0.0.0.0") {
    return { ok: false, action, port, error: "listenAddress must be IPv4" };
  }
  const ips = await (deps.hostnameIps || hostnameIps)();
  const wslIp = ips[0] || "";
  const commands = [
    `netsh interface portproxy add v4tov4 listenaddress=${listen} listenport=${port} connectaddress=${wslIp || "<WSL_IP>"} connectport=${port}`,
    `netsh advfirewall firewall add rule name="DSH WSL ${port}" dir=in action=allow protocol=TCP localport=${port}`,
    `netsh interface portproxy delete v4tov4 listenaddress=${listen} listenport=${port}`,
  ];
  const networkingMode = (deps.readNetworkingMode || readNetworkingMode)();
  const advice = buildExposeAdvice({ networkingMode, port });
  const browserHint = "http://127.0.0.1:3081/ (kit relay; dsh binds 127.0.0.1:3080 only)";
  if (action === "advise") {
    return {
      ok: true,
      action,
      port,
      listenAddress: listen,
      wslIp,
      commands,
      advice,
      networkingMode,
      browserHint,
    };
  }
  if (!wslIp) {
    return { ok: false, action, port, error: "could not detect WSL IP", advice, networkingMode, browserHint };
  }
  const ps = deps.runPowerShell || runPowerShell;
  try {
    if (action === "apply") {
      await ps(
        `netsh interface portproxy add v4tov4 listenaddress=${listen} listenport=${port} connectaddress=${wslIp} connectport=${port}`,
        { timeoutMs: 20_000 },
      );
    } else {
      await ps(
        `netsh interface portproxy delete v4tov4 listenaddress=${listen} listenport=${port}`,
        { timeoutMs: 20_000 },
      );
    }
    return {
      ok: true,
      action,
      port,
      listenAddress: listen,
      wslIp,
      commands,
      advice,
      networkingMode,
      browserHint,
    };
  } catch (err) {
    return {
      ok: false,
      action,
      port,
      wslIp,
      commands,
      advice,
      networkingMode,
      browserHint,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
