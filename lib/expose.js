import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { runPowerShell } from "./wsl-host.js";

const execFileAsync = promisify(execFile);

export function normalizePort(port, fallback = 3080) {
  const n = Number(port);
  if (!Number.isInteger(n) || n < 1 || n > 65535) return fallback;
  return n;
}

export async function hostnameIps({ execFileFn = execFileAsync } = {}) {
  try {
    const { stdout } = await execFileFn("hostname", ["-I"], { encoding: "utf8", timeout: 5_000 });
    return String(stdout || "").trim().split(/\s+/).filter(Boolean);
  } catch {
    return [];
  }
}

export async function checkListening(port, { execFileFn = execFileAsync } = {}) {
  const p = normalizePort(port, 0);
  if (!p) return { ok: false, error: "invalid port" };
  try {
    const { stdout } = await execFileFn("ss", ["-ltn"], { encoding: "utf8", timeout: 5_000 });
    const text = String(stdout || "");
    const listening = text.includes(`:${p} `) || text.includes(`:${p}\n`) || text.includes(`:${p}\r`);
    return { ok: true, listening, port: p };
  } catch (err) {
    return { ok: false, port: p, error: err instanceof Error ? err.message : String(err) };
  }
}

export function buildExposePlan({
  port,
  listenAddress = "0.0.0.0",
  connectAddress,
  ruleName = "dsh-wsl-expose",
} = {}) {
  const p = normalizePort(port);
  const listen = listenAddress || "0.0.0.0";
  const connect = connectAddress || "127.0.0.1";
  const commands = [
    {
      id: "linux-listen",
      role: "wsl",
      description: "Ensure the app listens on all interfaces inside WSL (example).",
      command: `# bind your server to ${listen}:${p} (e.g. dsh web / host 0.0.0.0)`,
    },
    {
      id: "portproxy-add",
      role: "windows-admin",
      description: "Forward Windows LAN port to WSL connect address (needs Admin).",
      command: `netsh interface portproxy add v4tov4 listenaddress=${listen} listenport=${p} connectaddress=${connect} connectport=${p}`,
    },
    {
      id: "firewall-add",
      role: "windows-admin",
      description: "Allow inbound TCP on the listen port (needs Admin).",
      command: `netsh advfirewall firewall add rule name="${ruleName}" dir=in action=allow protocol=TCP localport=${p}`,
    },
    {
      id: "portproxy-show",
      role: "windows",
      description: "Inspect current portproxy rules.",
      command: "netsh interface portproxy show all",
    },
    {
      id: "portproxy-delete",
      role: "windows-admin",
      description: "Remove the portproxy rule.",
      command: `netsh interface portproxy delete v4tov4 listenaddress=${listen} listenport=${p}`,
    },
    {
      id: "firewall-delete",
      role: "windows-admin",
      description: "Remove the firewall rule.",
      command: `netsh advfirewall firewall delete rule name="${ruleName}"`,
    },
  ];
  return {
    ok: true,
    port: p,
    listenAddress: listen,
    connectAddress: connect,
    warning: [
      "Exposing WSL ports to the Windows LAN increases attack surface.",
      "Default allowApply=false — plan only unless you explicitly enable apply.",
      "netsh portproxy / firewall changes usually require an elevated Administrator shell.",
    ],
    commands,
  };
}

export async function queryPortProxy({ timeoutMs = 15_000, runPs = runPowerShell } = {}) {
  try {
    const { stdout, stderr } = await runPs(
      "& netsh.exe interface portproxy show all | Out-String",
      { timeoutMs },
    );
    return { ok: true, output: String(stdout || "").trim(), stderr: String(stderr || "").trim() };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      advice: "Run `netsh interface portproxy show all` in an elevated PowerShell if access was denied.",
    };
  }
}

export async function exposeStatus({
  port,
  timeoutMs = 15_000,
  check = checkListening,
  ips = hostnameIps,
  proxy = queryPortProxy,
} = {}) {
  const p = normalizePort(port);
  const [listen, wslIps, portproxy] = await Promise.all([
    check(p),
    ips(),
    proxy({ timeoutMs }),
  ]);
  return {
    ok: true,
    port: p,
    listen,
    wslIps,
    portproxy,
    advice: portproxy.ok
      ? []
      : [portproxy.advice || "portproxy query failed — Admin rights may be required."],
  };
}

export async function applyPortProxy({
  port,
  listenAddress = "0.0.0.0",
  connectAddress,
  allowApply = false,
  timeoutMs = 15_000,
  runPs = runPowerShell,
} = {}) {
  if (!allowApply) {
    return {
      ok: false,
      error: "apply blocked: set config.allowApply=true to run netsh (Admin usually required)",
    };
  }
  const plan = buildExposePlan({ port, listenAddress, connectAddress });
  const add = plan.commands.find((c) => c.id === "portproxy-add");
  try {
    const { stdout, stderr } = await runPs(add.command, { timeoutMs });
    return {
      ok: true,
      ran: add.command,
      stdout: String(stdout || "").trim(),
      stderr: String(stderr || "").trim(),
      hint: "If access denied, re-run the netsh command in an elevated Administrator terminal.",
    };
  } catch (err) {
    return {
      ok: false,
      ran: add.command,
      error: err instanceof Error ? err.message : String(err),
      hint: "netsh failed — open Admin PowerShell and run the plan commands manually.",
    };
  }
}

export async function removePortProxy({
  port,
  listenAddress = "0.0.0.0",
  allowApply = false,
  timeoutMs = 15_000,
  runPs = runPowerShell,
} = {}) {
  if (!allowApply) {
    return {
      ok: false,
      error: "remove blocked: set config.allowApply=true to run netsh delete",
    };
  }
  const plan = buildExposePlan({ port, listenAddress });
  const del = plan.commands.find((c) => c.id === "portproxy-delete");
  try {
    const { stdout, stderr } = await runPs(del.command, { timeoutMs });
    return {
      ok: true,
      ran: del.command,
      stdout: String(stdout || "").trim(),
      stderr: String(stderr || "").trim(),
    };
  } catch (err) {
    return {
      ok: false,
      ran: del.command,
      error: err instanceof Error ? err.message : String(err),
      hint: "Delete may need Administrator elevation.",
    };
  }
}

export function formatExpose(value) {
  if (value?.error && value.ok === false && !value.commands && !value.listen) {
    return `wsl_expose failed: ${value.error}`;
  }
  const lines = [`wsl_expose ${value.action || "result"}`];
  if (value.port) lines.push(`port: ${value.port}`);
  if (value.listen) {
    lines.push(`listening: ${value.listen.listening ?? "?"}`);
    if (value.listen.error) lines.push(`ss: ${value.listen.error}`);
  }
  if (value.wslIps?.length) lines.push(`wsl_ips: ${value.wslIps.join(", ")}`);
  if (value.portproxy) {
    lines.push(`portproxy_ok: ${value.portproxy.ok}`);
    if (value.portproxy.output) lines.push("--- portproxy ---", value.portproxy.output);
    if (value.portproxy.error) lines.push(`portproxy_error: ${value.portproxy.error}`);
  }
  if (Array.isArray(value.commands)) {
    lines.push("commands:");
    for (const c of value.commands) {
      lines.push(`# ${c.id} (${c.role}): ${c.description}`);
      lines.push(c.command);
    }
  }
  for (const w of value.warning || []) lines.push(`warning: ${w}`);
  for (const a of value.advice || []) lines.push(`- ${a}`);
  if (value.ran) lines.push(`ran: ${value.ran}`);
  if (value.hint) lines.push(value.hint);
  if (value.error) lines.push(`error: ${value.error}`);
  return lines.join("\n");
}
