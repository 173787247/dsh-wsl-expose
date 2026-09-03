import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildExposeAdvice,
  format,
  readNetworkingMode,
} from "../lib/expose.js";

describe("readNetworkingMode", () => {
  it("parses .wslconfig via injected fs", () => {
    const mode = readNetworkingMode({
      env: { WINDOWS_USER: "rchua" },
      exists: (p) => p.endsWith("/rchua/.wslconfig"),
      readFile: () => "[wsl2]\nnetworkingMode=mirrored\n",
    });
    assert.equal(mode, "mirrored");
  });
});

describe("buildExposeAdvice", () => {
  it("forbids dsh 0.0.0.0 and prefers 3081", () => {
    const tips = buildExposeAdvice({ networkingMode: "nat", port: 3080 });
    assert.ok(tips.some((t) => /MUST stay on 127\.0\.0\.1/i.test(t)));
    assert.ok(tips.some((t) => /3081/i.test(t)));
    assert.ok(!tips.some((t) => /Bind dsh web to 0\.0\.0\.0/i.test(t)));
  });

  it("notes mirrored may skip portproxy", () => {
    const tips = buildExposeAdvice({ networkingMode: "mirrored", port: 8080 });
    assert.ok(tips.some((t) => /portproxy may be unnecessary/i.test(t)));
  });
});

describe("format", () => {
  it("includes browserHint", () => {
    const text = format({
      ok: true,
      action: "advise",
      port: 3080,
      networkingMode: "mirrored",
      browserHint: "http://127.0.0.1:3081/",
      advice: ["tip"],
    });
    assert.match(text, /browserHint: http:\/\/127\.0\.0\.1:3081\//);
    assert.match(text, /tip/);
  });
});
