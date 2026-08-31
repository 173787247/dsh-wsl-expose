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
    text: "Use wsl_expose for WSL/Windows interop: Advise or apply allowlisted Windows portproxy for exposing a WSL port.",
  });

  ctx.tools.register({
    name: "wsl_expose",
    description: "Advise or apply allowlisted Windows portproxy for exposing a WSL port.",
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
