import { detectWsl } from "./lib/wsl-host.js";
import * as core from "./lib/expose.js";

export const name = "dsh-wsl-expose";
export const inject = ["tools", "systemPrompt"];

export function apply(ctx, config = {}) {
  const timeoutMs = positive(config.timeoutMs, 15_000);
  const wsl = detectWsl();

  ctx.systemPrompt.section({
    name: "tool:wsl_expose",
    order: 113,
    text: "Use wsl_expose when Windows cannot reach a WSL port. For dsh web prefer kit restart-dsh-web.sh → http://127.0.0.1:3081/ (never dsh --host 0.0.0.0). Portproxy is optional/LAN.",
  });

  ctx.tools.register({
    name: "wsl_expose",
    description: "Advise/apply Windows portproxy for a WSL port; prefers :3081 relay for dsh and reads .wslconfig networkingMode.",
    parameters: core.parameters(config),
    output: {
      schema: core.outputSchema(),
      render: (_args, value) => [{ type: "text", text: core.format(value) }],
    },
    timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args) {
      if (!wsl) return core.notWsl ? core.notWsl() : { ok: false, error: "not running in WSL" };
      return core.execute(args, config);
    },
    presentCall: () => ({ card: "generic", title: "wsl_expose" }),
    presentResult: (_args, result) => (
      result.isError
        ? { card: "generic", title: "wsl_expose failed", content: result.content }
        : { card: "generic", title: "wsl_expose", content: result.content }
    ),
  });
}

function positive(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
