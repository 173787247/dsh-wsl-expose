import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyPortProxy,
  buildExposePlan,
  formatExpose,
  normalizePort,
  removePortProxy,
} from "../lib/expose.js";

describe("wsl_expose", () => {
  it("normalizes ports", () => {
    assert.equal(normalizePort(3080), 3080);
    assert.equal(normalizePort(99999, 3080), 3080);
  });

  it("plan includes listen, portproxy, firewall", () => {
    const plan = buildExposePlan({ port: 3080, connectAddress: "172.20.0.2" });
    assert.equal(plan.ok, true);
    const ids = plan.commands.map((c) => c.id);
    assert.ok(ids.includes("portproxy-add"));
    assert.ok(ids.includes("firewall-add"));
    assert.match(plan.commands.find((c) => c.id === "portproxy-add").command, /172\.20\.0\.2/);
    assert.ok(plan.warning.some((w) => /allowApply/i.test(w)));
  });

  it("blocks apply/remove when allowApply=false", async () => {
    const a = await applyPortProxy({ port: 3080, allowApply: false });
    assert.equal(a.ok, false);
    assert.match(a.error, /allowApply/);
    const r = await removePortProxy({ port: 3080, allowApply: false });
    assert.equal(r.ok, false);
  });

  it("apply runs netsh when allowApply and captures result", async () => {
    const calls = [];
    const result = await applyPortProxy({
      port: 3080,
      allowApply: true,
      connectAddress: "1.2.3.4",
      runPs: async (script) => {
        calls.push(script);
        return { stdout: "Ok.", stderr: "" };
      },
    });
    assert.equal(result.ok, true);
    assert.ok(calls[0].includes("portproxy add"));
  });

  it("formats", () => {
    assert.match(
      formatExpose({ action: "plan", port: 3080, commands: [{ id: "x", role: "wsl", description: "d", command: "echo" }] }),
      /commands:/,
    );
  });
});
