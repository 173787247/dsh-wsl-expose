import { readFileSync } from "node:fs";
import { hostnameIps } from "./expose-net.js";
import { runPowerShell } from "./wsl-host.js";

function readWslNetworkingMode() {
  try {
    const text = readFileSync("/etc/wsl.conf", "utf8");
    const m = text.match(/^\s*networkingMode\s*=\s*(\w+)/im);
    if (m) return m[1].toLowerCase();
  } catch {
    /* ignore */
  }
  return "unknown";
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
      port: { type: "integer", description: `WSL listen port (default ${p}).` },
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
  if (v.wslIp) lines.push(`wslIp: ${v.wslIp}`);
  for (const c of v.commands || []) lines.push(`$ ${c}`);
  for (const a of v.advice || []) lines.push(`- ${a}`);
  if (v.error) lines.push(`error: ${v.error}`);
  return lines.join("\n");
}

export async function execute(args, config = {}) {
  const action = ["advise", "apply", "remove"].includes(args?.action) ? args.action : "advise";
  const port = Number.isInteger(args?.port) ? args.port : (Number(config.defaultPort) || 3080);
  if (port < 1 || port > 65535) return { ok: false, action, port, error: "invalid port" };
  const listen = typeof args?.listenAddress === "string" && args.listenAddress.trim()
    ? args.listenAddress.trim()
    : "0.0.0.0";
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(listen) && listen !== "0.0.0.0") {
    return { ok: false, action, port, error: "listenAddress must be IPv4" };
  }
  const ips = await hostnameIps();
  const wslIp = ips[0] || "";
  const commands = [
    `netsh interface portproxy add v4tov4 listenaddress=${listen} listenport=${port} connectaddress=${wslIp || "<WSL_IP>"} connectport=${port}`,
    `netsh advfirewall firewall add rule name="DSH WSL ${port}" dir=in action=allow protocol=TCP localport=${port}`,
    `netsh interface portproxy delete v4tov4 listenaddress=${listen} listenport=${port}`,
  ];
  const networkingMode = readWslNetworkingMode();
  const advice = [
    "Bind dsh web to 0.0.0.0 inside WSL if needed; Windows portproxy forwards to the WSL eth0 IP.",
    "apply/remove require an elevated Windows shell; prefer advise + run yourself when unsure.",
    "Do not expose beyond your LAN without TLS and auth.",
  ];
  if (networkingMode === "mirrored") {
    advice.unshift(
      "WSL networkingMode=mirrored: Windows 127.0.0.1 often reaches WSL services directly — portproxy may be unnecessary for local browser access.",
    );
  } else if (networkingMode === "nat" || networkingMode === "unknown") {
    advice.unshift(
      "Classic NAT/mirror-unknown WSL: browsers on Windows may need portproxy (this tool) or host IP forwarding; local LLM on Windows may need OLLAMA_HOST=0.0.0.0 (see host_reach).",
    );
  }
  if (action === "advise") {
    return { ok: true, action, port, listenAddress: listen, wslIp, commands, advice, networkingMode };
  }
  if (!wslIp) return { ok: false, action, port, error: "could not detect WSL IP", advice, networkingMode };
  try {
    if (action === "apply") {
      await runPowerShell(
        `netsh interface portproxy add v4tov4 listenaddress=${listen} listenport=${port} connectaddress=${wslIp} connectport=${port}`,
        { timeoutMs: 20_000 },
      );
    } else {
      await runPowerShell(
        `netsh interface portproxy delete v4tov4 listenaddress=${listen} listenport=${port}`,
        { timeoutMs: 20_000 },
      );
    }
    return { ok: true, action, port, listenAddress: listen, wslIp, commands, advice, networkingMode };
  } catch (err) {
    return {
      ok: false,
      action,
      port,
      wslIp,
      commands,
      advice,
      networkingMode,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
