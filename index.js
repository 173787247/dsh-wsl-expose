import { detectWsl } from "./lib/wsl-host.js";
import {
  applyPortProxy,
  buildExposePlan,
  exposeStatus,
  formatExpose,
  hostnameIps,
  normalizePort,
  removePortProxy,
} from "./lib/expose.js";

export const name = "dsh-wsl-expose";
export const inject = ["tools", "systemPrompt"];

export function apply(ctx, config = {}) {
  const timeoutMs = positive(config.timeoutMs, 15_000);
  const defaultPort = normalizePort(config.defaultPort, 3080);
  const listenAddress = typeof config.listenAddress === "string" && config.listenAddress.trim()
    ? config.listenAddress.trim()
    : "0.0.0.0";
  const allowApply = config.allowApply === true;
  const wsl = detectWsl();

  ctx.systemPrompt.section({
    name: "tool:wsl_expose",
    order: 122,
    text: [
      "Use wsl_expose carefully when the user needs LAN access to a WSL-hosted port.",
      "Prefer action=plan first. apply/remove only work when config.allowApply=true (default false).",
      "Exposing ports to the LAN increases risk; require explicit user intent.",
    ].join(" "),
  });

  ctx.tools.register({
    name: "wsl_expose",
    description: "Plan or (opt-in) apply Windows portproxy/firewall to expose a WSL TCP port to the LAN.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["action"],
      properties: {
        action: {
          type: "string",
          enum: ["status", "plan", "apply", "remove"],
          description: "status | plan | apply | remove",
        },
        port: {
          type: "integer",
          description: `TCP port (default ${defaultPort}).`,
        },
        connectAddress: {
          type: "string",
          description: "Windows portproxy connect address (default: first WSL IP or 127.0.0.1).",
        },
      },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: true,
        properties: {
          ok: { type: "boolean" },
          wsl: { type: "boolean" },
          action: { type: "string" },
          error: { type: "string" },
        },
      },
      render: (_args, value) => [{ type: "text", text: formatExpose(value) }],
    },
    timeoutMs,
    isConcurrencySafe: () => false,
    async execute(args) {
      const action = String(args?.action || "").toLowerCase();
      if (!wsl) {
        return { ok: false, wsl: false, action, error: "not running in WSL" };
      }
      const port = Number.isInteger(args?.port) ? args.port : defaultPort;
      try {
        if (action === "status") {
          const status = await exposeStatus({ port, timeoutMs });
          return { wsl: true, action, allowApply, ...status };
        }
        if (action === "plan") {
          const ips = await hostnameIps();
          const connectAddress = typeof args?.connectAddress === "string" && args.connectAddress.trim()
            ? args.connectAddress.trim()
            : (ips[0] || "127.0.0.1");
          const plan = buildExposePlan({ port, listenAddress, connectAddress });
          return { wsl: true, action, allowApply, ...plan };
        }
        if (action === "apply") {
          const ips = await hostnameIps();
          const connectAddress = typeof args?.connectAddress === "string" && args.connectAddress.trim()
            ? args.connectAddress.trim()
            : (ips[0] || "127.0.0.1");
          const result = await applyPortProxy({
            port,
            listenAddress,
            connectAddress,
            allowApply,
            timeoutMs,
          });
          return { wsl: true, action, allowApply, ...result };
        }
        if (action === "remove") {
          const result = await removePortProxy({
            port,
            listenAddress,
            allowApply,
            timeoutMs,
          });
          return { wsl: true, action, allowApply, ...result };
        }
        return { ok: false, wsl: true, action, error: "unknown action" };
      } catch (err) {
        return {
          ok: false,
          wsl: true,
          action,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
    presentCall: () => ({ card: "generic", title: "WSL expose" }),
    presentResult: (_args, result) => (
      result.isError
        ? { card: "generic", title: "WSL expose failed", content: result.content }
        : { card: "generic", title: "WSL expose", content: result.content }
    ),
  });
}

function positive(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
